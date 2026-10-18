# Journal de construction

Application : `clone/` (Next.js 15, Tailwind 3, TypeScript). Données : couche simulée en mémoire (`clone/lib/store.ts`), mêmes signatures que celles que replica-backend remplacera par Postgres.
Tests : `cd clone && npm test` (11 tests : calcul de disponibilité, heure d'été, double réservation). Parcours navigateur vérifié avec Playwright (1440 et 390 px, clavier seul, 0 erreur console).

| ID | date | état | ce qui manque | plus dur que prévu |
| --- | --- | --- | --- | --- |
| Shell | 2026-10-18 | fait | | |
| S01 | 2026-10-18 | non fait | inscription/connexion : pas d'auth, un hôte de démonstration | |
| S02 | 2026-10-18 | non fait | connexion calendrier (OAuth) | |
| S03 | 2026-10-18 | partiel | modifier/supprimer un type ; état « limite de plan » | |
| S04 | 2026-10-18 | non fait | choix du type d'événement (seul one-on-one existe) | |
| S05 | 2026-10-18 | partiel | pas de réglage préavis/tampons/limites, pas de questions personnalisées, pas d'aperçu en direct | |
| S06 | 2026-10-18 | partiel | une seule plage par jour, pas d'exceptions de date, fuseau de l'hôte non modifiable | |
| S07 | 2026-10-18 | fait | | |
| S08 | 2026-10-18 | fait | | le calcul des créneaux en fuseaux et heure d'été : tests dédiés |
| S09 | 2026-10-18 | partiel | nom et e-mail uniquement | |
| S10 | 2026-10-18 | fait | e-mail de confirmation non envoyé | |
| S11 | 2026-10-18 | fait | délai limite d'annulation non géré | |
| S12 | 2026-10-18 | partiel | pas de filtres ni de tri ; pas de réunions passées séparées | |
| S13 | 2026-10-18 | non fait | webhooks et API | |

## Remarques

- Les écrans reposent sur la recon **déduite** (sans captures de l'original) : états, tailles et textes à confronter à des captures réelles avant de les considérer comme fidèles.
- `replica/clone-screens/` contient les captures du clone (1440 et 390 px) pour replica-diff. Pas de captures de référence à comparer pour l'instant.
- Données en mémoire : tout est perdu au redémarrage du serveur, et plusieurs instances ne partagent pas l'état.
- TypeScript est épinglé à la version 5 : la version 7 installée par défaut empêchait Next 15 de lire `tsconfig.json`.
- Écran S01, S02, S04, S13 non commencés : ils dépendent de l'auth, d'OAuth ou des types multi-hôtes.
