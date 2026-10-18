# Recon map: Calendly (web)

Scope: boucle principale de planification : créer un type d'événement, définir ses disponibilités, partager un lien, un invité réserve, annulation/replanification, notifications.
Hors périmètre de cette passe : routage d'équipe avancé, workflows, paiements, SSO/admin.
For: à préciser (usage interne, niche ou produit à vendre)
Date: 2026-10-18

## Limites de cette recon (à lire d'abord)

- calendly.com / help.calendly.com / developer.calendly.com n'étaient **pas joignables** via WebFetch dans cette session (getaddrinfo ENOTFOUND). Tout ce qui suit vient de résultats de recherche web (extraits de l'aide officielle, blogs tiers, docs de connecteurs).
- Aucune capture d'écran dans `screens/` : les écrans ci-dessous sont **déduits**, pas observés. Pour les états réels (vide, erreur, mobile), il faut que l'utilisateur parcoure son propre compte et partage des captures.
- Prix et limites du plan gratuit : sources tierces qui divergent. À vérifier sur la page tarifs.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | aide : mise en place d'un type d'événement | https://calendly.com/help/how-to-set-up-an-event-type | via extrait de recherche |
| 2 | aide : réglages de disponibilité | https://calendly.com/help/how-to-fine-tune-your-availability-settings | via extrait |
| 3 | aide : limites de réunions et tampons | https://calendly.com/help/how-to-set-meeting-limits.html | via extrait |
| 4 | aide : personnaliser les types d'événements | https://calendly.com/help/how-to-customize-your-event-types | via extrait |
| 5 | aide : webhooks | https://calendly.com/help/webhooks-overview | via extrait |
| 6 | blog : nouvel éditeur d'événements | https://calendly.com/blog/redesigned-nav-event-types | via extrait |
| 7 | tarifs (tiers) | https://withorb.com/blog/calendly-pricing , https://www.spendflo.com/blog/calendly-pricing-guide | non officiel |
| 8 | API v2 (tiers) | https://jentic.com/apis/calendly | non officiel, chemins à vérifier |
| 9 | pricing officiel, docs développeur | calendly.com/pricing, developer.calendly.com | **inaccessible, à lire** |

## Core loop

L'hôte publie un lien de réservation qui respecte ses disponibilités réelles (calendrier connecté), et l'invité choisit un créneau sans échange d'e-mails.

## Screens (déduits, confiance moyenne)

| ID | screen | route / accès | purpose | key components | états à enregistrer |
| --- | --- | --- | --- | --- | --- |
| S01 | Inscription / connexion | /login | créer le compte | email, Google/Microsoft SSO | erreur, e-mail déjà utilisé |
| S02 | Connexion du calendrier | onboarding | lire les plages occupées, écrire les réservations | choix Google/Outlook, consentement | refus, échec |
| S03 | Liste des types d'événements (Scheduling) | /event_types | voir, créer, activer/désactiver, copier le lien | cartes, bouton + Create, toggle, copier lien | vide, plan gratuit à la limite |
| S04 | Création : choix du type | modale | One-on-one, Group, Collective, Round robin | cartes de choix | rôles bloqués par le plan |
| S05 | Éditeur de type d'événement | /event_types/:id | nom, couleur, durée, lieu, hôtes, disponibilités, limites/tampons, formulaire invité, notifications, page de confirmation | panneau latéral + aperçu | brouillon, erreur de validation |
| S06 | Disponibilités | /availability | plages hebdomadaires, fuseau, exceptions par date | grille par jour, date picker | vide, chevauchement |
| S07 | Page d'accueil publique de l'hôte | /:username | l'invité choisit parmi les types actifs | liste de types | aucun type actif |
| S08 | Page de réservation : choix du créneau | /:username/:slug | calendrier + créneaux | calendrier mensuel, liste d'heures, sélecteur de fuseau | aucun créneau, créneau pris, mobile |
| S09 | Formulaire invité | même page | nom, e-mail, questions personnalisées, invités additionnels | champs, bouton Schedule | erreurs de champ, créneau pris pendant la saisie |
| S10 | Confirmation | /invitees/:id | récapitulatif, ajout au calendrier, lien annuler/replanifier | boutons .ics/Google/Outlook | redirection externe (option) |
| S11 | Annulation / replanification (invité) | lien dans l'e-mail | annuler avec motif ou reprendre S08 | champ motif | déjà annulé, trop tard |
| S12 | Réunions planifiées (hôte) | /scheduled_events | à venir, passées, annuler | tableau, filtres | vide |
| S13 | Intégrations / webhooks | /integrations | API, webhooks | liste, token | non connecté |

## Flows

```
F01 L'hôte met en place son lien
    S01 -> S02 -> S03 -> S04 -> S05 -> S06 -> copier le lien
    clics chemin principal : à mesurer sur compte réel
    edge : plan gratuit limité à 1 type actif (source tierce), calendrier déconnecté

F02 L'invité réserve
    S07 (optionnel) -> S08 -> S09 -> S10
    clics chemin principal : 4 estimés (jour, heure, formulaire, confirmer), à vérifier
    edge : aucun créneau cette semaine, fuseau différent, créneau pris pendant le remplissage, préavis minimum

F03 L'invité annule ou replanifie
    e-mail -> S11 -> (annuler) ou S08 -> S09 -> S10
    edge : annulation tardive, déjà annulé

F04 L'hôte consulte ses réunions
    S12
```

## Components

Boutons (primaire, secondaire, lien), champs texte et e-mail, sélecteur de fuseau, calendrier mensuel, liste de créneaux, toggle, cartes de type d'événement avec couleur, modale, tableau, toasts, navigation latérale, panneau d'aperçu en direct (source 6). Variantes et états : à relever sur captures.

## Inferred data model (confiance indiquée)

```
User            id, name, email, username/slug, timezone, calendar_connections
                evidence: API v2 users, S01/S02   confidence: high
CalendarConn    id, user_id, provider, scopes, busy_check_enabled, add_to_calendar
                evidence: aide (vérifie les plages occupées, ajoute les réunions)   confidence: medium
EventType       id, owner/hosts, name, slug, color, duration, location, kind (one-on-one|group|collective|round_robin), active
                evidence: aide set-up, API /event_types   confidence: high
EventSettings   event_type_id, availability_rule (hebdo ou propre), min_notice, date_range,
                buffer_before/after, limit_per_day/week/month, invitee_form, confirmation (page|redirect)
                evidence: aide limites/tampons/notice   confidence: high
AvailabilitySchedule  user_id, weekly_hours, date_overrides, timezone   evidence: S06   confidence: medium
ScheduledEvent  id, event_type_id, start_at, end_at, status (active|canceled), location, hosts
                evidence: API /scheduled_events   confidence: high
Invitee         id, scheduled_event_id, name, email, timezone, answers (json), status, cancel_reason, reschedule_url
                evidence: API /scheduled_events/{uuid}/invitees   confidence: medium
WebhookSub      id, url, events (invitee.created|invitee.canceled|routing_form_submission.created), scope
                evidence: aide webhooks   confidence: high
RoutingForm / Submission   (hors périmètre, plan Teams)   confidence: low
```

## Hard parts

1. Calcul de disponibilité : plages hebdomadaires + exceptions + occupation du calendrier externe + tampons + préavis + limites + fuseaux et heure d'été.
2. Synchronisation calendriers (OAuth Google/Microsoft) : lecture occupé/libre, écriture d'événements, déconnexions.
3. Anti-double-réservation : verrouillage du créneau entre le choix et la confirmation.
Plus tard : round robin, notifications et workflows, paiements.

## Out of scope / skip

Réseau et marque de Calendly, intégrations partenaires (Salesforce, etc.), SSO entreprise, contenus et textes de Calendly, conformité (SOC2).

## Size

Cœur (S01–S12 sans round robin) : **M** (quelques semaines). Avec équipes, routage et workflows : **L**.
