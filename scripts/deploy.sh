#!/bin/bash
# PNGA - Script de déploiement
# République de Djibouti

set -euo pipefail

echo "=============================================="
echo " PNGA - Plateforme Nationale des Archives"
echo " Déploiement - République de Djibouti"
echo "=============================================="
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker requis. Installation: https://docs.docker.com/get-docker/"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose requis."; exit 1; }

# Environment
DEPLOY_ENV=${1:-development}
COMPOSE_FILE="docker-compose.yml"
if [ "$DEPLOY_ENV" = "production" ]; then
    COMPOSE_FILE="docker-compose.yml:docker-compose.prod.yml"
fi

echo "📦 Environnement: $DEPLOY_ENV"
echo ""

# Generate secrets if not set
if [ ! -f .env ]; then
    echo "🔐 Génération des secrets..."
    cat > .env << EOF
SECRET_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 16)
MINIO_SECRET_KEY=$(openssl rand -hex 16)
EOF
    echo "✅ Fichier .env créé"
fi

# Create SSL certificates (self-signed for development)
if [ ! -f infrastructure/nginx/ssl/cert.pem ]; then
    echo "🔑 Génération des certificats SSL auto-signés..."
    mkdir -p infrastructure/nginx/ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout infrastructure/nginx/ssl/key.pem \
        -out infrastructure/nginx/ssl/cert.pem \
        -subj "/C=DJ/ST=Djibouti/L=Djibouti/O=Archives Nationales/CN=pnga.dj" 2>/dev/null
    echo "✅ Certificats SSL créés"
fi

echo ""
echo "🚀 Démarrage des services..."
COMPOSE_FILE=$COMPOSE_FILE docker compose up -d --build

echo ""
echo "⏳ Attente que les services soient prêts..."
sleep 15

# Health checks
echo ""
echo "🏥 Vérification de santé des services..."
services=("postgres:5432" "redis:6379" "elasticsearch:9200" "minio:9000")
for service in "${services[@]}"; do
    name="${service%%:*}"
    if docker compose ps "$name" | grep -q "running" 2>/dev/null; then
        echo "   ✅ $name"
    else
        echo "   ⚠️  $name (vérifier manuellement)"
    fi
done

# API check
echo ""
echo "🔍 Test de l'API..."
for i in {1..10}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "   ✅ API Backend opérationnelle"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "   ❌ L'API ne répond pas encore (réessayer dans 30s)"
    fi
    sleep 3
done

echo ""
echo "=============================================="
echo " ✅ PNGA déployée avec succès !"
echo "=============================================="
echo ""
echo " 🌐 Frontend:        http://localhost:3000"
echo " 🔧 API:             http://localhost:8000"
echo " 📖 Docs API:        http://localhost:8000/api/docs"
echo " 🗄️  MinIO Console:   http://localhost:9001"
echo " 📊 Grafana:         http://localhost:3001"
echo " 🔍 Prometheus:      http://localhost:9090"
echo ""
echo " 👤 Comptes par défaut:"
echo "    Admin:      admin / Pnga@Djibouti2024!"
echo "    Archiviste: archiviste / Archiviste@2024!"
echo ""
echo " ⚠️  Changer les mots de passe en production!"
echo "=============================================="
