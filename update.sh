#!/usr/bin/env bash
# =============================================================
#  update.sh  –  Alles in einem: GitHub + Server
#  Aufruf: ./update.sh "Commit-Nachricht" root@SERVER_IP
# =============================================================
set -euo pipefail

MSG="${1:-Update}"
SERVER="${2:-root@DEINE_SERVER_IP}"
APP_DIR="/opt/invoiceflow"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1/3 → GitHub Push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git add .
git commit -m "$MSG" || echo "(nichts zu committen)"
git push origin main

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  2/3 → App bauen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm ci --silent
npm run build

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  3/3 → Server deployen"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  ./ "$SERVER:$APP_DIR/"

ssh "$SERVER" "
  cd $APP_DIR
  docker compose build app
  docker compose up -d --remove-orphans
  sleep 4
  docker compose ps
"

echo ""
echo "✅ Fertig — GitHub aktuell + Server läuft"
