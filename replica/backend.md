# Backend : état et checklist

Application : `clone/`. Périmètre de cette étape : Postgres, comptes, e-mails, file de tâches. Paiements : hors périmètre (aucune ligne de la matrice ne les exige). Google Calendar et connexion Google : **pas encore faits** (voir plus bas).

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

## Intégrations restantes

- **Connexion Google** et **Google Calendar** (lecture des plages occupées, écriture des réservations) : non commencées. Il faut un projet Google Cloud à vous, un écran de consentement et des identifiants OAuth. Les portées sensibles du calendrier demandent la **vérification OAuth de Google avant le lancement public, ce qui prend des semaines** : à démarrer tôt. Portées minimales à viser : lecture libre/occupé et écriture d'événements créés par l'application (à confirmer dans la documentation Google au moment de l'implémenter).
- Webhooks sortants : table `webhook_endpoints` créée, pas de code d'envoi.
- Paiements (Stripe) : non requis par la matrice.

## Vérification (réalisée)

- 48 tests (`TEST_DATABASE_URL=… npm test`) sur un vrai Postgres 16 : 10 réservations simultanées du même créneau = 1 réussite ; limite par jour exacte sous concurrence ; cloisonnement entre deux comptes ; suppression de compte en cascade ; jetons à usage unique, expirés, invalidés par un nouveau lien ; file de tâches (rappel non envoyé trop tôt, annulation, idempotence, nouvelle tentative puis lettre morte) ; requête Resend (API simulée).
- 55 vérifications navigateur de bout en bout (inscription, vérification, connexion, réservation, e-mails, annulation, mot de passe oublié, sessions, limites de débit, suppression), plus le parcours de réservation et les écrans de gestion repris sur la nouvelle base (29 + parcours de base) : 0 erreur console, pas de débordement à 390 px.
- **Non vérifié** : un envoi réel via Resend (pas de clé), un déploiement réel, Google.

## Checklist de sécurité

- [x] secrets uniquement en variables d'environnement, `.env*` ignoré par git (sauf `.env.example`), rien dans les bundles client
- [x] entrées validées côté serveur sur chaque action (`lib/validate.ts`, tests dédiés ; la réservation publique valide dans `bookAction`)
- [x] autorisation vérifiée à chaque lecture/écriture, testée avec un deuxième utilisateur (niveau base et navigateur)
- [x] limites de débit : connexion (IP et adresse), inscription, renvoi de lien, mot de passe oublié, réinitialisation, vérification, suppression de compte, réservation publique (IP et adresse invitée)
- [x] webhooks : aucun entrant à ce jour ; les futurs devront vérifier la signature (rien à vérifier pour l'instant)
- [x] envois : pas de téléversement de fichiers dans l'application
- [~] données utilisateur dans les URLs : les jetons à usage unique de vérification/réinitialisation sont dans l'URL des e-mails (inévitable) ; le lien `/booking/<jeton>` est un secret partagé avec l'invité. Les journaux ne contiennent pas d'adresses e-mail ; `Referrer-Policy: strict-origin-when-cross-origin`.
- [~] dépendances auditées : `npm audit` = 9 alertes (1 moyenne directe sur `next`, via le `postcss` embarqué ; le reste vient de `tailwindcss` 3, outil de build). Aucune n'est atteignable à l'exécution (le CSS traité est le nôtre). Correctifs = montées majeures (Next 16, Tailwind 4), à planifier.
- [ ] page de confidentialité listant les sous-traitants : à écrire (voir ci-dessus)
- [x] en-têtes : `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`
- [x] pas d'énumération de comptes : inscription, « mot de passe oublié » et renvoi de lien répondent à l'identique, durée de calcul égalisée à l'inscription
- [x] les liens de vérification et de réinitialisation ne se consomment qu'au clic (un analyseur de liens de messagerie ne les « use » pas)

## Limites connues

- **Livraison au moins une fois** : si l'envoi réussit mais que la mise à jour de la tâche échoue, l'e-mail peut partir deux fois.
- **Adresse IP** : lue dans `x-forwarded-for`. Valable derrière une plateforme qui pose cet en-tête (Vercel…) ; en direct sur Internet, elle est falsifiable et les limites par IP perdent leur sens (celles par adresse restent).
- **Rappels** : envoyés à la minute près seulement si le planificateur tourne chaque minute.
- Limite par mois (type d'événement) et délai limite d'annulation : non gérés.
