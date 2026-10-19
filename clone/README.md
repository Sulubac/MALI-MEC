# Planifier (clone)

Application de prise de rendez-vous : Next.js 15, Postgres, e-mails via Resend.

## Démarrer en local

```bash
cp .env.example .env.local        # puis renseignez DATABASE_URL (un Postgres local suffit)
npm install
npm run migrate                    # applique db/migrations/*.sql
node --experimental-strip-types --env-file-if-exists=.env.local scripts/seed.mjs   # compte de démonstration (jamais en production)
npm run dev                        # http://localhost:3000
```

Hors production et sans `RESEND_API_KEY`, les e-mails sont écrits dans la table `email_outbox` (`select * from email_outbox;`) : c'est là qu'on récupère les liens de confirmation en local.

## Tests

```bash
# TEST_DATABASE_URL : une base dédiée, déjà migrée. Elle est vidée à chaque test.
TEST_DATABASE_URL=postgres://… npm test
```

Sans `TEST_DATABASE_URL`, les tests Postgres sont ignorés (les tests de calcul et de validation tournent quand même).

## Production

Voir `../replica/backend.md` : variables, domaine d'envoi, planificateur de la file de tâches, limites connues.

## Tests de bout en bout (Playwright)

```bash
# Base jetable et migrée : elle est vidée à chaque lancement. Le nom doit contenir « e2e » ou « test ».
export E2E_DATABASE_URL=postgres://…/scheduling_e2e
npm run e2e                        # construit l'application puis lance les 80 tests (≈ 3 min)
# Si Chromium est déjà installé quelque part : CHROMIUM_PATH=/chemin/vers/chrome npm run e2e
```

Chaque test échoue sur une erreur JavaScript, une erreur de console ou une réponse 5xx, et les écrans sont contrôlés avec axe (WCAG 2.1 AA).
Le plan de test et les bugs trouvés sont dans `../replica/test-plan.md` et `../replica/bugs.md`.

## Google Agenda

Optionnel : voir `.env.example` (variables `GOOGLE_*` et `TOKEN_ENCRYPTION_KEY`) et `../replica/backend.md` (section « Google Agenda »). Les tests utilisent un faux serveur Google (`e2e/fake-google.ts`) : ils ne remplacent pas un essai avec un vrai compte.
