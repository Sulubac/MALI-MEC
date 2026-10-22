#!/bin/bash
# ============================================================
#  Installation de l'application sur le VPS (à lancer DANS le dossier platform/)
#  Usage :  bash deploy/setup.sh
# ============================================================
set -e
cd "$(dirname "$0")/.."   # se place dans platform/
echo "➜ Dossier : $(pwd)"

# 1) Dépendances Node
echo "➜ Installation des dépendances (npm)..."
npm install --omit=dev

# 2) Fichier .env (créé seulement s'il n'existe pas)
if [ ! -f .env ]; then
  echo "➜ Création du fichier .env avec un JWT_SECRET aléatoire..."
  SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > .env <<EOF
PORT=4300
NODE_ENV=production
JWT_SECRET=$SECRET
# Pour activer les agents IA réels, décommentez et renseignez :
# ANTHROPIC_API_KEY=sk-ant-...
EOF
  echo "  .env créé."
else
  echo "➜ .env déjà présent, conservé."
fi

# 3) PM2 (installé si absent)
if ! command -v pm2 >/dev/null 2>&1; then
  echo "➜ Installation de PM2..."
  npm install -g pm2
fi

# 4) Démarrage / rechargement via PM2
echo "➜ Démarrage de l'application (PM2, port 4300)..."
pm2 start ecosystem.config.js || pm2 reload djevent
pm2 save

echo ""
echo "✅ Application lancée sur le port interne 4300 (PM2 : nom « djevent »)."
echo "   Vérifier :  curl -s http://127.0.0.1:4300/api/health"
echo "   Prochaine étape : configurer Nginx (voir deploy/DEPLOY-VPS.md)."
