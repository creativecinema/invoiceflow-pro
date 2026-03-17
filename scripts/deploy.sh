#!/bin/bash
# ═══════════════════════════════════════════════════
#  InvoiceFlow Pro – Server Deploy
#  Usage: bash scripts/deploy.sh v5-abc1234
#  Nutzt docker run (kein compose nötig)
# ═══════════════════════════════════════════════════
set -e

VERSION="${1:-latest}"
REGISTRY="ghcr.io"
REPO=$(git remote get-url origin 2>/dev/null | sed 's/.*github.com\///' | sed 's/\.git//' | tr '[:upper:]' '[:lower:]')
IMAGE="${REGISTRY}/${REPO}"

cd /opt/invoiceflow

echo "━━━ 1. Pull Image ━━━"
echo "    ${IMAGE}:${VERSION}"
docker pull "${IMAGE}:${VERSION}" || { echo "Fallback zu latest"; docker pull "${IMAGE}:latest"; VERSION="latest"; }

echo ""
echo "━━━ 2. Alten Container stoppen ━━━"
docker stop invoiceflow 2>/dev/null && docker rm invoiceflow 2>/dev/null || echo "    (kein alter Container)"

echo ""
echo "━━━ 3. Volumes sicherstellen ━━━"
docker volume create ifp-data 2>/dev/null || true
docker volume create ifp-uploads 2>/dev/null || true

echo ""
echo "━━━ 4. Neuen Container starten ━━━"
docker run -d \
  --name invoiceflow \
  --restart unless-stopped \
  -p 80:3000 \
  -v ifp-data:/app/data \
  -v ifp-uploads:/app/uploads \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DATA_DIR=/app/data \
  "${IMAGE}:${VERSION}"

echo ""
echo "━━━ 5. Warten (8s) ━━━"
sleep 8

echo ""
echo "━━━ 6. Health Check ━━━"
STATUS=$(curl -sf http://localhost:80/api/auth/check 2>/dev/null || echo "FEHLER")
echo "    API: ${STATUS}"
docker ps --format "    {{.Names}}: {{.Status}} {{.Ports}}"
echo ""
echo "    ✅ Deploy: ${VERSION}"
