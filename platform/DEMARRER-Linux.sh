#!/bin/bash
# Lancez ce fichier sur Linux : ./DEMARRER-Linux.sh
cd "$(dirname "$0")"

echo "============================================================"
echo "  Djibouti Event Intelligence - Démarrage"
echo "============================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js n'est pas installé."
  echo "    Installez-le : https://nodejs.org  (ou via votre gestionnaire de paquets)"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Première utilisation : installation des composants..."
  npm install || { echo "[!] Installation échouée."; exit 1; }
fi

echo
echo "Démarrage du serveur... Le navigateur va s'ouvrir automatiquement."
echo "Pour arrêter : Ctrl + C."
echo
npm start
