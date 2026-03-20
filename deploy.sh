#!/usr/bin/env bash
# =============================================================
#  deploy.sh  –  Manuelles Deploy per Terminal
#  Aufruf: ./deploy.sh root@DEINE_SERVER_IP
# =============================================================
set -euo pipefail

SERVER="${1:-}"
APP_DIR="/opt/invoiceflow"

[ -z "$SERVER" ] && echo "Aufruf: ./deploy.sh root@SERVER_IP" && exit 1

echo "→ Baue App lokal..."
npm ci
npm run build

echo "→ Übertrage auf $SERVER..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  ./ "$SERVER:$APP_DIR/"

echo "→ Starte Container neu..."
ssh "$SERVER" "
  cd $APP_DIR
  docker compose build app
  docker compose up -d --remove-orphans
  sleep 5
  docker compose ps
"

echo "✅ Deploy abgeschlossen!"
