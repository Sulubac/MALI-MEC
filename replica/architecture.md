> **Mise à jour (replica-backend)** : comptes gérés par l'application et contrôle d'accès dans la couche de données (au lieu de Supabase Auth et RLS) ; migration dans `clone/db/migrations/001_init.sql`. Détails et écarts : `replica/backend.md`.

# Architecture : clone de planification (reconstruction des fonctions principales de Calendly)

Basé sur `replica/recon.md` (déduite de sources secondaires : à recouper avec des captures réelles avant de figer le schéma).

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | Next.js (App Router) + TypeScript | une seule base de code pour pages publiques (SEO, rapides) et tableau de bord |
| styling | Tailwind, tokens de replica-design | tokens partagés |
| database | Postgres sur Supabase | contrainte d'exclusion pour l'anti-double-réservation, RLS, un seul service |
| ORM | Drizzle | SQL explicite, migrations simples |
| auth | Supabase Auth (e-mail + Google) | OAuth Google déjà là, lié au calendrier |
| calendrier | API Google Calendar et Microsoft Graph, avec les clés du propriétaire | API publiques seulement |
| email | Resend | confirmations, rappels, annulations |
| jobs | table `jobs` + Vercel Cron (chaque minute) ou Inngest | pas de worker à gérer au départ |
| payments | hors périmètre pour l'instant | Stripe Checkout plus tard |
| hosting | Vercel | zéro ops à zéro utilisateur |

Une base, pas de microservices.

## Schema

9 tables : `profiles`, `calendar_connections`, `availability_rules`, `availability_overrides`, `event_types`, `event_type_questions`, `bookings`, `webhook_endpoints`, `jobs` (voir `replica/schema.sql`).
Accès : **RLS Postgres** pour le tableau de bord ; les pages publiques passent par des routes serveur (service role) qui n'exposent que les champs nécessaires.
Hard constraint : `no_double_booking` (exclusion gist sur `host_id` + `tstzrange(start_at, end_at)` pour les réservations confirmées). Deux invités qui cliquent en même temps : le second reçoit une erreur 409, et l'UI propose d'autres créneaux.

## API

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| POST /auth/* | inscription, connexion | public | email/OAuth | session | F01 |
| GET /api/calendar/connect/:provider | démarre OAuth | hôte | provider | redirect | F01 |
| GET /api/calendar/callback/:provider | stocke le jeton chiffré | hôte | code | 302 /event_types | F01 |
| GET/POST/PATCH/DELETE /api/event-types | CRUD types d'événement | hôte | champs du type | type | F01 |
| PUT /api/availability | remplace règles et exceptions | hôte | rules[], overrides[] | ok | F01 |
| GET /api/public/:username | types actifs de l'hôte | public | username | liste | F02 |
| GET /api/public/:username/:slug/slots | créneaux libres | public | range, tz invité | slots[] (UTC) | F02 |
| POST /api/public/:username/:slug/book | crée une réservation | public | start, nom, email, tz, answers | booking + manage_token | F02 |
| GET /api/bookings/manage/:token | lit sa réservation | invité (token) | token | booking | F03 |
| POST /api/bookings/manage/:token/cancel | annule | invité (token) | reason | ok | F03 |
| POST /api/bookings/manage/:token/reschedule | replanifie | invité (token) | new start | booking | F03 |
| GET /api/bookings | réunions de l'hôte | hôte | filtre | liste | F04 |
| POST /api/bookings/:id/cancel | annulation par l'hôte | hôte | reason | ok | F04 |
| CRUD /api/webhooks | gère les webhooks sortants | hôte | url, events | endpoint | plus tard |

Webhooks in : notifications push Google/Microsoft de changement de calendrier (invalidation du cache d'occupation).
Webhooks out : `booking.created`, `booking.cancelled` signés HMAC.
Jobs : `email_confirmation` (immédiat), `email_reminder` (24 h et 1 h avant), `calendar_write` (après réservation), `webhook` (retry exponentiel), nettoyage des jobs terminés (quotidien).

## The parts that bite

- **Fuseaux et heure d'été :** règles stockées en heure locale de l'hôte + son fuseau IANA ; créneaux calculés en convertissant chaque jour séparément (jamais en ajoutant 24 h). Tout est renvoyé en UTC, affiché dans le fuseau de l'invité.
- **Calcul de disponibilité :** règles − exceptions − occupations calendrier − réservations existantes (+ tampons) − préavis minimum − limites jour/semaine. Une fonction pure, avec des tests sur DST.
- **Courses :** vérification et insertion dans la même transaction ; la contrainte d'exclusion fait foi. Les tampons sont appliqués dans le calcul des créneaux, la contrainte ne couvre que le chevauchement strict.
- **Idempotence :** `jobs.idempotency_key` unique (une confirmation par réservation), webhooks entrants dédupliqués.
- **Jetons OAuth :** chiffrés au repos, révocation gérée (`status = 'revoked'`) avec avertissement à l'hôte.
- **Cache d'occupation :** appels calendrier limités par quotas ; cache court (1–5 min) plus invalidation par push.
- **Délivrabilité e-mail :** SPF/DKIM sur le domaine d'envoi.
- **RGPD :** suppression d'un invité = effacement de `guest_*` et `answers` ; export des réservations.
- **Sécurité des liens de gestion :** `manage_token` aléatoire, limite de débit sur les routes publiques.

## Build order

1. **Vertical slice :** S01, S03, S05 (minimal), S06 (une plage), S08, S09, S10 ; tables `profiles`, `availability_rules`, `event_types`, `bookings` ; routes event-types, slots, book. Pas de calendrier externe, e-mail brut. Prouve la pile et l'anti-double-réservation.
2. **Must-haves :** S02 (connexion calendrier), fuseaux, préavis, S11 (annuler/replanifier), S12 (liste), e-mails de confirmation et rappels.
3. **Should-haves :** exceptions de date, tampons, limites, formulaire invité (`event_type_questions`).
4. **Could-haves :** redirection de confirmation, webhooks, puis group/round robin.
5. **Fixes de replica-entrepreneur** une fois lancé.

## Risques principaux

1. Calcul de disponibilité (fuseaux, DST, tampons, limites).
2. OAuth et synchro calendrier (quotas, jetons révoqués).
3. Anti-double-réservation sous concurrence (contrainte d'exclusion + messages d'erreur clairs).
