# Journal de construction

Application : `clone/` (Next.js 15, Tailwind 3, TypeScript). Données : Postgres (`clone/db/migrations`), comptes et e-mails réels (voir `replica/backend.md`).
Tests : `cd clone && TEST_DATABASE_URL=… npm test` (48 tests sur Postgres : calcul de créneaux, heure d'été, exceptions, limites, validation des formulaires, double réservation, suppression). Parcours navigateur vérifié avec Playwright (1440 et 390 px, clavier seul, 0 erreur console) : 29 vérifications sur les écrans de gestion, le parcours de base, et 55 vérifications sur l'authentification et les e-mails (voir `replica/backend.md`).

| ID | date | état | ce qui manque | plus dur que prévu |
| --- | --- | --- | --- | --- |
| Shell | 2026-10-18 | fait | | |
| S01 | 2026-10-18 | partiel | connexion Google | formulaires React 19 : les champs étaient vidés après une erreur de validation, corrigé (saisie conservée) |
| S02 | 2026-10-19 | partiel | **non vérifié avec le vrai Google** (tout est testé contre un faux serveur Google) ; Outlook ; plusieurs agendas ; pas de notification push de Google (lecture à la demande, cache de 30 s) | plus gros que prévu : trois pannes qui auraient bloqué toutes les réservations d'un hôte (clé de chiffrement perdue, API Calendar désactivée → 403, Google injoignable) ont demandé une politique explicite ; voir `backend.md` |
| S03 | 2026-10-18 | fait | état « limite de plan » (pas de plans) | suppression : refusée s'il existe des réservations, comme `on delete restrict` |
| S04 | 2026-10-18 | non fait | choix du type (group, collective, round robin) : seul one-on-one existe | |
| S05 | 2026-10-18 | fait | | éditeur de questions (liste de choix, ordre) et aperçu en direct |
| S06 | 2026-10-18 | fait | | exceptions de date et plages multiples dans le calcul de créneaux |
| S07 | 2026-10-18 | fait | | |
| S08 | 2026-10-18 | fait | | fuseaux et heure d'été : tests dédiés |
| S09 | 2026-10-18 | fait | | |
| S10 | 2026-10-18 | fait | e-mail de confirmation non envoyé | |
| S11 | 2026-10-18 | fait | délai limite d'annulation non géré | |
| S12 | 2026-10-18 | fait | tri et recherche | |
| S13 | 2026-10-18 | non fait | webhooks et API (replica-backend) | |

## Remarques

- Les écrans reposent sur la recon **déduite** (sans captures de l'original) : états, tailles et textes à confronter à des captures réelles avant de les considérer comme fidèles.
- `replica/clone-screens/` contient les captures du clone (1440 et 390 px) pour replica-diff. Pas de captures de référence à comparer pour l'instant.
- TypeScript est épinglé à la version 5 : la version 7 installée par défaut empêchait Next 15 de lire `tsconfig.json`.
- S04 et S13 non commencés (types multi-hôtes, API). S01 : manque la connexion Google (l'infrastructure OAuth existe désormais, pas la connexion par Google). S02 : voir sa ligne.
- Les champs de date et d'heure natifs prennent le format du navigateur (12 h ou 24 h selon la langue du système) ; aucun format n'est imposé.
