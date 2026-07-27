# Djibouti Event Intelligence & Management Platform — Espace de travail partagé

Version **serveur** de la plateforme : une seule base de données partagée pour toute
l'équipe, avec comptes, rôles et validation humaine. Contrairement au fichier HTML
autonome (démo mono-poste), cette version permet à **plusieurs utilisateurs de
travailler sur les mêmes données en temps réel**.

- **Backend** : Node.js + Express + SQLite (base de données fichier, aucune installation externe)
- **Auth** : mots de passe chiffrés (bcrypt) + jetons de session (JWT)
- **Rôles** : écriture protégée côté serveur (le rôle « Lecteur » est en lecture seule)
- **Sécurité des clés** : toutes les clés API restent côté serveur, jamais exposées au navigateur
- **IA** : les 12 agents fonctionnent en mode simulé, ou avec un vrai modèle si `ANTHROPIC_API_KEY` est fourni

---

## 1. Prérequis

- **Node.js 18 ou plus** — https://nodejs.org (téléchargez la version « LTS » et installez-la)

Pour vérifier, ouvrez un terminal et tapez :

```bash
node -v
```

## 2. Installation (une seule fois)

Dans un terminal, placez-vous dans ce dossier `platform/` puis :

```bash
npm install
```

## 3. (Optionnel) Configuration

```bash
cp .env.example .env
```

Ouvrez `.env` et, en production, changez `JWT_SECRET` par une longue chaîne aléatoire.
Pour activer les agents IA en temps réel, ajoutez votre `ANTHROPIC_API_KEY`.

## 4. Démarrer le serveur

```bash
npm start
```

Vous verrez notamment la ligne de l'adresse à ouvrir, par exemple :

```
   ➜  Ouvrez :  http://localhost:4300
```

Ouvrez **exactement l'adresse affichée** dans votre terminal.

> Le port par défaut est **4300** (et non 3000, pour éviter les conflits avec
> d'autres applications comme un CRM déjà en cours). Si 4300 est occupé, le serveur
> passe automatiquement au port suivant (4301, 4302, …) et affiche la bonne adresse.
> Pour forcer un port précis : `PORT=8080 npm start`.

## 5. Comptes de démonstration

Mot de passe pour tous : **demo1234**

| Email | Rôle | Droits |
|---|---|---|
| `dg@djib-events.dj` | Directeur Général | Tout + réinitialisation |
| `commercial@djib-events.dj` | Commercial | Lecture + écriture |
| `finance@djib-events.dj` | Responsable Financier | Lecture + écriture |
| `admin@djib-events.dj` | Super administrateur | Tout |
| `lecteur@djib-events.dj` | Lecteur | Lecture seule |

---

## Partager avec toute l'équipe

Le serveur écoute sur votre machine (`localhost`). Pour que vos collègues y accèdent,
choisissez l'une de ces options :

1. **Réseau local** : ils ouvrent `http://VOTRE-IP-LOCALE:4300` (même Wi-Fi/bureau).
2. **Hébergement cloud** : déployez ce dossier sur un service Node (Render, Railway,
   un VPS, etc.). Définissez alors `JWT_SECRET` et servez en HTTPS.

> Chaque utilisateur se connecte avec son propre compte ; tous partagent la **même
> base de données** `data.sqlite`. Les changements des uns apparaissent chez les autres
> (rafraîchissement automatique toutes les ~12 s).

## Gestion des données

- Toutes les données vivent dans le fichier **`data.sqlite`** (créé au premier démarrage).
- **Sauvegarde** : copiez ce fichier.
- **Réinitialiser la démo** : bouton « Réinitialiser » dans Paramètres (DG/admin), ou
  supprimez `data.sqlite` et redémarrez.

## Structure

```
platform/
├── server.js            API Express + auth + endpoints agents
├── db.js                Schéma SQLite + données de démo + comptes
├── public/index.html    Interface (rebranchée sur l'API)
├── package.json
├── .env.example
└── data.sqlite          (généré au 1er lancement — non versionné)
```

## Notes de sécurité / conformité

- Aucun email, devis, proposition ou message externe n'est envoyé sans **validation
  humaine** (l'agent Compliance bloque tant que les contrôles ne sont pas au vert).
- Les rôles en lecture seule ne peuvent rien modifier (refus côté serveur, HTTP 403).
- Avant une mise en production réelle : activez HTTPS, changez `JWT_SECRET`, et
  branchez les intégrations (email/WhatsApp/paiement) via leurs API officielles.
