#!/bin/bash
# ═══════════════════════════════════════════════════
#  InvoiceFlow Pro – Server Deploy
#  Usage: bash scripts/deploy.sh v5-abc1234
# ═══════════════════════════════════════════════════
set -e

VERSION="${1:-latest}"
REGISTRY="ghcr.io"
IMAGE="${REGISTRY}/$(git remote get-url origin | sed 's/.*github.com\///' | sed 's/\.git//' | tr '[:upper:]' '[:lower:]')"

cd /opt/invoiceflow

echo "━━━ 1. Pull Image ━━━"
echo "    Image: ${IMAGE}:${VERSION}"
docker pull "${IMAGE}:${VERSION}" || docker pull "${IMAGE}:latest"

echo ""
echo "━━━ 2. Update docker-compose ━━━"
export DEPLOY_IMAGE="${IMAGE}:${VERSION}"
echo "DEPLOY_IMAGE=${IMAGE}:${VERSION}" > .env.deploy

echo ""
echo "━━━ 3. Restart ━━━"
docker compose --env-file .env.deploy down
docker compose --env-file .env.deploy up -d

echo ""
echo "━━━ 4. Warten (10s) ━━━"
sleep 10

echo ""
echo "━━━ 5. Status ━━━"
STATUS=$(curl -s http://localhost:3000/api/auth/check 2>/dev/null || echo "FEHLER")
echo "    App: $STATUS"
docker ps --format "    {{.Names}}: {{.Status}}" | head -5
echo ""
echo "    ✅ Deploy abgeschlossen: ${VERSION}"
