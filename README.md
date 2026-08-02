# NotaryOS Djibouti 🏛️

**Système de Gestion Notariale Intelligent** — Plateforme LegalTech complète pour cabinets notariaux.

## Architecture

```
notaryos-djibouti/
├── apps/
│   ├── frontend/          # Next.js 14 + TypeScript + Tailwind
│   └── backend/           # NestJS + Prisma + PostgreSQL
├── docker/
│   ├── docker-compose.yml
│   └── nginx/
└── packages/
```

## Stack Technologique

| Couche | Technologies |
|--------|-------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, Zustand |
| Backend | NestJS, Prisma ORM, PostgreSQL, Redis, JWT |
| IA | Claude API (Anthropic), OpenAI GPT |
| Déploiement | Docker, Nginx |

## Démarrage rapide

### Prérequis
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (ou Docker)

### 1. Infrastructure (Docker)
```bash
npm run docker:dev
```

### 2. Backend
```bash
cd apps/backend
cp .env.example .env
# Éditer .env avec vos clés API
npm install
npx prisma generate
npx prisma db push
npx prisma db seed
npm run start:dev
```

### 3. Frontend
```bash
cd apps/frontend
cp .env.local.example .env.local
npm install
npm run dev
```

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| Super Admin | admin@cabinet-notarial-djibouti.dj | Admin2024! |
| Notaire Senior | notaire@cabinet-notarial-djibouti.dj | Notaire2024! |
| Assistant Juridique | assistant@cabinet-notarial-djibouti.dj | Assistant2024! |

## Modules

### ✅ Implémentés
- **Dashboard** — KPIs, graphiques, alertes temps réel
- **CRM Clients** — Particuliers, sociétés, KYC, AML, scoring risque
- **Gestion Dossiers** — Workflow complet, timeline, commentaires
- **Documents** — Modèles Handlebars, versioning, signatures électroniques
- **IA Juridique** — Claude API, Q&A droit djiboutien, révision documents
- **Immobilier** — Registre foncier, propriétaires, hypothèques
- **Rendez-vous** — Calendrier, rappels
- **Tâches** — Assignation, priorités, suivi
- **Comptabilité** — Factures, paiements, revenus
- **Rapports** — Analytics, performance, CA mensuel/annuel
- **Audit** — Logs complets, immutables
- **Recherche globale** — Full-text, cross-entités

### 🔄 Roadmap
- OCR automatique des documents
- Notifications SMS/WhatsApp
- Portail client
- Connexion cadastre djiboutien
- Application mobile
- Blockchain timestamping

## API Documentation

Après démarrage du backend: http://localhost:4000/api/docs

## Déploiement Production

```bash
# Configurer .env de production
cp docker/.env.example docker/.env
# Éditer avec les variables de prod

docker-compose -f docker/docker-compose.yml up -d
```

---

*NotaryOS Djibouti — Conforme au droit djiboutien · جمهورية جيبوتي*
