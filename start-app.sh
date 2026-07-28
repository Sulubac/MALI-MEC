#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   MALI-MEC — Revenue Agent System                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Install Flask if needed
if ! python3 -c "import flask" 2>/dev/null; then
  echo "→ Installation de Flask..."
  pip install flask --quiet
fi

# Create outputs dir if missing
mkdir -p "$ROOT/outputs"

echo "→ Démarrage du serveur..."
echo "→ Ouvre dans ton navigateur : http://localhost:5050"
echo ""

cd "$ROOT"
python3 app/server.py
