# Backend : état et checklist

Application : `clone/`. Périmètre de cette étape : Postgres, comptes, e-mails, file de tâches. Paiements : hors périmètre (aucune ligne de la matrice ne les exige). Google Agenda : **construit mais non vérifié avec le vrai Google** (voir « Google Agenda »). Connexion par Google : pas faite.

## Ce qui est construit

| Domaine | Réalisation |
| --- | --- |
| Base | Postgres, migration `clone/db/migrations/001_init.sql` (9 tables d'origine + `users`, `sessions`, `email_tokens`, `rate_limits`, `email_outbox`), runner `npm run migrate`, seed `scripts/seed.mjs` |
| Anti-double-réservation | contrainte d'exclusion `no_double_booking` + verrou par hôte dans la transaction (les limites jour/semaine restent exactes sous concurrence) |
| Comptes | inscription e-mail + mot de passe avec vérification, connexion, déconnexion, déconnexion partout, mot de passe oublié, suppression de compte |
| Sessions | jeton aléatoire de 256 bits, **seul son SHA-256 est stocké**, cookie `HttpOnly` + `SameSite=Lax` + `Secure` + préfixe `__Host-` en production, 30 jours |
| Mots de passe | scrypt (N=16384, r=8, p=1), sel aléatoire, comparaison à temps constant, 10 à 128 caractères |
| E-mails | Resend (API officielle, clé du propriétaire) ; hors production sans clé : table `email_outbox`. Modèles en texte brut, écrits pour ce produit |
| File de tâches | table `jobs` : verrou de ligne, 5 tentatives avec attente (2, 4, 8, 16 min), tâches `failed` conservées avec `last_error` (lettres mortes), clé d'idempotence |
| Envoi | confirmation invité, notification hôte, annulation (2 e-mails), rappel 24 h avant ; déclenchés juste après l'action, relancés par `GET /api/cron/jobs` |
| Accès aux données | chaque fonction du `store` filtre par propriétaire (contrôle dans la requête) ; les serveurs d'actions appellent `requireHost()` |

Choix qui diffèrent de `architecture.md` : comptes gérés par l'application (au lieu de Supabase Auth) et contrôle d'accès dans la couche de données (au lieu de RLS), ce qui rend le tout testable sur n'importe quel Postgres. Le schéma Supabase d'origine reste dans `replica/schema.sql` (remplacé par la migration).

## Ce que vous devez faire (je ne crée ni compte ni clé)

1. **Postgres** : créez une base (Supabase, Neon ou autre) et mettez son URL dans `DATABASE_URL`. Vérifiez que les sauvegardes quotidiennes de l'hébergeur sont activées. Lancez `npm run migrate`.
2. **Resend** : créez un compte, ajoutez et vérifiez **votre domaine** (enregistrements SPF et DKIM, DMARC recommandé), puis renseignez `RESEND_API_KEY` et `EMAIL_FROM`. Sans domaine vérifié, les e-mails partiront en indésirables ou seront refusés.
3. **Planificateur** : appelez `GET /api/cron/jobs` avec `Authorization: Bearer <CRON_SECRET>` (Vercel Cron toutes les minutes sur un plan qui l'autorise, ou un planificateur externe toutes les 5 minutes). Sans lui, les confirmations partent quand même, mais **les rappels et les relances ne partent pas**.
4. **Secrets** : `CRON_SECRET` (`openssl rand -base64 32`), `APP_URL` publique. Voir `clone/.env.example`.
5. **Page de confidentialité** (à écrire avant le lancement, `replica-launch`) : elle doit citer chaque sous-traitant : l'hébergeur de l'application, l'hébergeur Postgres, Resend.

## Google Agenda

**Construit** (écran S02 « Calendrier », `clone/lib/google.ts`, `calendar.ts`, migration `002_calendar.sql`) :

| Sujet | Réalisation |
| --- | --- |
| Connexion | OAuth 2.0 code + **PKCE (S256)**, `access_type=offline`, `prompt=consent`. État et vérificateur dans un cookie `HttpOnly`, `SameSite=Lax`, limité à `/api/google`, valable 10 minutes, supprimé après le retour. Le retour exige la session de l'utilisateur et un état identique. |
| Jetons | seul le jeton de rafraîchissement est stocké, **chiffré AES-256-GCM** (clé `TOKEN_ENCRYPTION_KEY`, lié à l'identifiant de l'utilisateur : recopié sur une autre ligne il ne se lit plus). Jetons d'accès : mémoire seulement, jamais en base. |
| Lecture | `freeBusy` sur l'agenda principal : uniquement les plages occupées (jamais les titres). Cache de 30 s pour l'affichage ; **contrôle sans cache au moment de réserver**. Les événements « libres » de Google ne bloquent rien. |
| Écriture | un événement par réservation (identifiant dérivé de la réservation : rejouer ne duplique pas), supprimé à l'annulation, ancien supprimé et nouveau créé à la replanification, via la file de tâches (nouvelles tentatives, lettres mortes). `sendUpdates=none` : Google n'envoie rien aux invités, nos e-mails restent la seule source. |
| Consentement partiel | l'utilisateur peut refuser l'écriture : connexion en lecture seule, option d'écriture désactivée et expliquée. Refuser la lecture : refus explicite. |
| Déconnexion | accès révoqué chez Google (meilleur effort), ligne supprimée. Reconnecter révoque aussi l'ancien jeton. Les événements déjà ajoutés restent dans l'agenda. Même révocation à la suppression du compte (après vérification du mot de passe). |

**Politique en cas de panne** (choix explicites, à connaître) :

- **Google injoignable ou en erreur temporaire (5xx, 429, délai) au moment de réserver : la réservation est refusée** avec un message clair (« Impossible de vérifier l'agenda… »), plutôt que de risquer une double réservation. Sur la page publique, les créneaux restent affichés (dernier état connu) ; la lecture de l'agenda y est limitée à 2,5 s pour ne pas faire attendre l'invité (6 s pour le contrôle final).
- **Accès révoqué chez Google, jeton illisible (clé de chiffrement perdue ou changée), ou erreur durable (403 : API Calendar non activée ou autorisation insuffisante ; 400 ; 401 persistant) : la connexion passe en « révoquée », l'hôte reçoit un e-mail, et les réservations continuent sans l'agenda** (sinon une erreur de configuration bloquerait définitivement ses réservations). Le risque est une double réservation tant que l'hôte n'a pas reconnecté : l'écran S02 et l'e-mail le disent.
- Ne perdez pas `TOKEN_ENCRYPTION_KEY` : tous les utilisateurs devraient reconnecter leur agenda.

**Limites connues** : agenda principal uniquement ; Google seulement (pas Outlook) ; pas de notification push de Google (lecture à la demande) ; en cas d'annulation, le créneau reste bloqué côté Google jusqu'à la suppression de l'événement (quelques secondes, ou plus si Google est en panne) ; l'écriture et la lecture peuvent diverger de quelques secondes ; un événement ajouté par un autre moyen entre l'affichage et la réservation est détecté au contrôle final, mais il reste une courte fenêtre entre ce contrôle et l'enregistrement.

### Ce que vous devez faire pour Google (je ne peux ni créer le projet ni tester contre le vrai Google)

1. **Projet Google Cloud** à vous : activer « Google Calendar API ».
2. **Écran de consentement OAuth** : nom, e-mail d'assistance, domaine, lien vers la politique de confidentialité (à écrire).
3. **Identifiant OAuth « Application Web »** avec l'URI de redirection `<APP_URL>/api/google/callback`.
4. Renseigner `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` (voir `.env.example`).
5. **Essayer avec votre propre compte Google** (en mode « test » du projet, ce qui ne demande pas de vérification) : connecter, vérifier qu'un événement bloque un créneau, qu'une réservation crée l'événement, qu'une annulation le supprime. **C'est la seule façon de valider ce qui n'a été testé que contre mon faux Google** : noms de portées, réponses réelles, comportement du consentement.
6. **Vérification OAuth de Google avant d'ouvrir à d'autres utilisateurs : plusieurs semaines.** Les portées de Calendar sont dites « sensibles » : sans vérification, l'écran de consentement affiche un avertissement et le nombre d'utilisateurs est plafonné (100). À lancer tôt, avec une vidéo de démonstration et la politique de confidentialité.
7. **Mode « Test » du projet** : je crois (à confirmer dans la documentation Google) que les jetons de rafraîchissement y expirent après 7 jours. Pendant vos essais, l'application affichera donc la reconnexion nécessaire une fois par semaine : c'est le comportement prévu, pas une panne.
8. Portées par défaut : `calendar.freebusy` et `calendar.events`. `calendar.events` donne accès en lecture et écriture à tous les événements ; une portée plus étroite (`calendar.events.owned`, limitée aux agendas dont l'utilisateur est propriétaire) peut exister : vérifiez son nom exact dans la documentation Google, puis renseignez `GOOGLE_CALENDAR_SCOPES` (restreindre les portées facilite la vérification).

## Intégrations restantes

- **Connexion par Google** (se connecter à l'application avec Google) : pas faite. L'infrastructure OAuth existe désormais ; il restera le lien entre un compte Google et un compte local, avec ses propres règles de sécurité (fusion de comptes, adresse non vérifiée…).
- Webhooks sortants : table `webhook_endpoints` créée, pas de code d'envoi.
- Paiements (Stripe) : non requis par la matrice.

## Vérification (réalisée)

- 48 tests (`TEST_DATABASE_URL=… npm test`) sur un vrai Postgres 16 : 10 réservations simultanées du même créneau = 1 réussite ; limite par jour exacte sous concurrence ; cloisonnement entre deux comptes ; suppression de compte en cascade ; jetons à usage unique, expirés, invalidés par un nouveau lien ; file de tâches (rappel non envoyé trop tôt, annulation, idempotence, nouvelle tentative puis lettre morte) ; requête Resend (API simulée).
- 55 vérifications navigateur de bout en bout (inscription, vérification, connexion, réservation, e-mails, annulation, mot de passe oublié, sessions, limites de débit, suppression), plus le parcours de réservation et les écrans de gestion repris sur la nouvelle base (29 + parcours de base) : 0 erreur console, pas de débordement à 390 px.
- **Non vérifié** : un envoi réel via Resend (pas de clé), un déploiement réel, Google.

## Checklist de sécurité (Google Agenda inclus)

- [x] Google : jetons chiffrés au repos (AES-256-GCM, lié à l'utilisateur), état OAuth + PKCE, cookie d'état HttpOnly, retour exigeant la session, aucune adresse de redirection dérivée de l'entrée, pas de jeton ni de corps de réponse Google dans les journaux
- [x] secrets uniquement en variables d'environnement, `.env*` ignoré par git (sauf `.env.example`), rien dans les bundles client
- [x] entrées validées côté serveur sur chaque action (`lib/validate.ts`, tests dédiés ; la réservation publique valide dans `bookAction`)
- [x] autorisation vérifiée à chaque lecture/écriture, testée avec un deuxième utilisateur (niveau base et navigateur)
- [x] limites de débit : connexion (IP et adresse), inscription, renvoi de lien, mot de passe oublié, réinitialisation, vérification, suppression de compte, réservation publique (IP et adresse invitée)
- [x] webhooks : aucun entrant à ce jour ; les futurs devront vérifier la signature (rien à vérifier pour l'instant)
- [x] envois : pas de téléversement de fichiers dans l'application
- [~] données utilisateur dans les URLs : les jetons à usage unique de vérification/réinitialisation sont dans l'URL des e-mails (inévitable) ; le lien `/booking/<jeton>` est un secret partagé avec l'invité. Les journaux ne contiennent pas d'adresses e-mail ; `Referrer-Policy: strict-origin-when-cross-origin`.
- [~] dépendances auditées : `npm audit` = 9 alertes (1 moyenne directe sur `next`, via le `postcss` embarqué ; le reste vient de `tailwindcss` 3, outil de build). Aucune n'est atteignable à l'exécution (le CSS traité est le nôtre). Correctifs = montées majeures (Next 16, Tailwind 4), à planifier.
- [ ] page de confidentialité listant les sous-traitants (Google en plus : agenda lu et écrit) : à écrire, **et exigée par la vérification OAuth de Google**
- [x] en-têtes : `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
- [x] pas d'énumération de comptes : inscription, « mot de passe oublié » et renvoi de lien répondent à l'identique, durée de calcul égalisée à l'inscription
- [x] les liens de vérification et de réinitialisation ne se consomment qu'au clic (un analyseur de liens de messagerie ne les « use » pas)

## Limites connues

- **Livraison au moins une fois** : si l'envoi réussit mais que la mise à jour de la tâche échoue, l'e-mail peut partir deux fois.
- **Adresse IP** : lue dans `x-forwarded-for`. Valable derrière une plateforme qui pose cet en-tête (Vercel…) ; en direct sur Internet, elle est falsifiable et les limites par IP perdent leur sens (celles par adresse restent).
- **Rappels** : envoyés à la minute près seulement si le planificateur tourne chaque minute.
- Limite par mois (type d'événement) et délai limite d'annulation : non gérés.
