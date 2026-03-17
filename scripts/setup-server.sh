#!/bin/bash
# ═══════════════════════════════════════════════════
#  BriefingDesk – Server-Erstinstallation
#  
#  Dieses Script einmal auf dem Hetzner-Server ausführen.
#  Danach laufen alle Updates automatisch über GitHub.
#
#  Verwendung:
#    bash setup-server.sh GITHUB_USER GITHUB_REPO [GITHUB_TOKEN]
#
#  Beispiel:
#    bash setup-server.sh meinname briefingdesk ghp_xxxxxxxxxxxx
# ═══════════════════════════════════════════════════

set -euo pipefail

GITHUB_USER="${1:-}"
GITHUB_REPO="${2:-briefingdesk}"
GITHUB_TOKEN="${3:-}"
APP_DIR="/opt/briefingdesk"

# ─── Farben ───
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}▶${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✖${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  BriefingDesk – Server Setup"
echo "═══════════════════════════════════════════════════"
echo ""

if [ -z "$GITHUB_USER" ]; then
  err "Bitte GitHub-Username angeben!"
  echo ""
  echo "Verwendung: bash setup-server.sh GITHUB_USER [REPO_NAME] [GITHUB_TOKEN]"
  echo ""
  echo "Beispiel:   bash setup-server.sh meinname briefingdesk ghp_xxxxxxxxxxxx"
  echo ""
  echo "Den Token erstellst du unter: https://github.com/settings/tokens"
  echo "  → 'Generate new token (classic)'"
  echo "  → Scopes: repo, write:packages, read:packages"
  exit 1
fi

FULL_REPO="$GITHUB_USER/$GITHUB_REPO"
REGISTRY_IMAGE="ghcr.io/$FULL_REPO"

# ═══ 1. System-Pakete ═══
log "1/8 – System aktualisieren..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw socat jq

# ═══ 2. Docker ═══
log "2/8 – Docker installieren..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
else
  log "  Docker bereits installiert"
fi

# ═══ 3. Firewall ═══
log "3/8 – Firewall konfigurieren..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 9443/tcp
ufw --force enable

# ═══ 4. SSH-Key für GitHub Actions ═══
log "4/8 – SSH-Key generieren..."
SSH_KEY_FILE="/root/.ssh/deploy_key"
if [ ! -f "$SSH_KEY_FILE" ]; then
  ssh-keygen -t ed25519 -f "$SSH_KEY_FILE" -N "" -C "briefingdesk-deploy@$(hostname)"
  log "  ✅ SSH-Key erstellt"
else
  log "  SSH-Key existiert bereits"
fi

# ═══ 5. GitHub Container Registry Login ═══
log "5/8 – GitHub Container Registry..."
if [ -n "$GITHUB_TOKEN" ]; then
  echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$GITHUB_USER" --password-stdin
  log "  ✅ Registry Login OK"
else
  warn "  Kein Token – Registry-Login übersprungen"
  warn "  Token später setzen mit: echo 'TOKEN' | docker login ghcr.io -u $GITHUB_USER --password-stdin"
fi

# ═══ 6. Repository klonen ═══
log "6/8 – Repository klonen..."
mkdir -p "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  log "  Repo existiert – Pull..."
  cd "$APP_DIR" && git pull origin main
else
  if [ -n "$GITHUB_TOKEN" ]; then
    git clone "https://${GITHUB_TOKEN}@github.com/${FULL_REPO}.git" "$APP_DIR"
  else
    git clone "https://github.com/${FULL_REPO}.git" "$APP_DIR" 2>/dev/null || {
      warn "  Clone fehlgeschlagen – erstelle lokales Repo"
      cd "$APP_DIR"
      git init
      git remote add origin "https://github.com/${FULL_REPO}.git" 2>/dev/null || true
    }
  fi
fi

cd "$APP_DIR"

# Registry-Info speichern
echo "$REGISTRY_IMAGE" > "$APP_DIR/.registry"

# ═══ 7. Verzeichnisse & Rechte ═══
log "7/8 – Verzeichnisse erstellen..."
mkdir -p "$APP_DIR/data" "$APP_DIR/uploads" "$APP_DIR/backups" "$APP_DIR/scripts"
chmod +x "$APP_DIR/scripts/"*.sh 2>/dev/null || true

# ═══ 8. Erster Build & Start ═══
log "8/8 – App bauen & starten..."

# Versuche zuerst Image aus Registry zu pullen
if [ -n "$GITHUB_TOKEN" ] && docker pull "$REGISTRY_IMAGE:latest" 2>/dev/null; then
  log "  Image aus Registry gepullt"
  export DEPLOY_IMAGE="$REGISTRY_IMAGE:latest"
else
  log "  Lokaler Build (kein Registry-Image verfügbar)"
  docker build -t briefingdesk-app:latest .
  export DEPLOY_IMAGE="briefingdesk-app:latest"
fi

docker compose up -d

# Auf Health warten
log "Health Check..."
for i in $(seq 1 30); do
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/settings" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    break
  fi
done

# ═══ Autostart-Service ═══
cat > /etc/systemd/system/briefingdesk.service << 'SVC'
[Unit]
Description=BriefingDesk Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/briefingdesk
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable briefingdesk

# ═══ Cron: Tägliches DB-Backup ═══
cat > /etc/cron.d/briefingdesk-backup << 'CRON'
# Tägliches DB-Backup um 03:00
0 3 * * * root mkdir -p /opt/briefingdesk/backups/daily && cp /opt/briefingdesk/data/briefingdesk.sqlite "/opt/briefingdesk/backups/daily/db_$(date +\%Y\%m\%d).sqlite" && find /opt/briefingdesk/backups/daily -name "db_*.sqlite" -mtime +30 -delete
CRON

# ═══ Version setzen ═══
echo "v1-initial" > "$APP_DIR/.current_version"
echo "$(date '+%Y-%m-%d %H:%M:%S') | v1-initial | SETUP | server=$(hostname)" > "$APP_DIR/deploy-history.log"

# ═══ Fertig! ═══
SERVER_IP=$(hostname -I | awk '{print $1}')
SSH_PUBKEY=$(cat "$SSH_KEY_FILE.pub")

echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}✅ BriefingDesk ist installiert!${NC}"
echo ""
echo "  App:     http://${SERVER_IP}:3000"
echo "  Admin:   https://${SERVER_IP}:9443"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  NÄCHSTE SCHRITTE (einmalig in GitHub):"
echo ""
echo "  1. GitHub Repository erstellen:"
echo "     https://github.com/new → Name: $GITHUB_REPO"
echo ""
echo "  2. Repository Secrets anlegen:"
echo "     https://github.com/$FULL_REPO/settings/secrets/actions"
echo ""
echo "     SERVER_IP        = $SERVER_IP"
echo "     SSH_PRIVATE_KEY  = (Inhalt der Datei unten)"
echo ""
echo "  3. SSH Private Key (für GitHub Actions):"
echo "     Kopiere den KOMPLETTEN Inhalt:"
echo ""
cat "$SSH_KEY_FILE"
echo ""
echo ""
echo "  4. SSH Public Key auf Server autorisieren:"
echo "     (Ist bereits erledigt ✅)"
cat "$SSH_KEY_FILE.pub" >> /root/.ssh/authorized_keys
echo ""
echo "  5. Ersten Push machen (von deinem PC):"
echo "     git push origin main"
echo ""
echo "  Danach passiert bei jedem Push automatisch:"
echo "  GitHub Actions → Build → Deploy → Health Check"
echo ""
echo "═══════════════════════════════════════════════════════════"
