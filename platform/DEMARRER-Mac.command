#!/bin/bash
# Double-cliquez ce fichier sur macOS pour lancer l'application.
cd "$(dirname "$0")"

echo "============================================================"
echo "  Djibouti Event Intelligence - Démarrage"
echo "============================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js n'est pas installé."
  echo "    Téléchargez-le ici : https://nodejs.org  (version LTS)"
  echo "    Puis relancez ce fichier."
  echo
  read -p "Appuyez sur Entrée pour fermer..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Première utilisation : installation des composants..."
  npm install || { echo "[!] Installation échouée."; read -p "Entrée pour fermer..."; exit 1; }
fi

echo
echo "Démarrage du serveur... Le navigateur va s'ouvrir automatiquement."
echo "Laissez cette fenêtre ouverte pendant l'utilisation."
echo "Pour arrêter : Ctrl + C."
echo
npm start
