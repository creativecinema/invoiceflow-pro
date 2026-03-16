#!/bin/bash
# ============================================================
# InvoiceFlow Pro — Hetzner Server Setup Script
# Laeuft auf Ubuntu 22.04 / 24.04 als root
# ============================================================
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }
err()  { echo -e "${RED}[✗] $1${NC}"; exit 1; }

[[ $EUID -ne 0 ]] && err "Bitte als root ausfuehren: sudo bash setup.sh"

DOMAIN="${1:-}"
EMAIL="${2:-admin@example.com}"

log "=== InvoiceFlow Pro — Server Setup ==="

# --- System Update ---
log "System wird aktualisiert..."
apt-get update -qq && apt-get upgrade -y -qq

# --- Basis-Pakete ---
log "Basis-Pakete werden installiert..."
apt-get install -y -qq \
  curl wget git ufw fail2ban \
  ca-certificates gnupg lsb-release

# --- Firewall ---
log "Firewall (UFW) konfigurieren..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
log "Firewall aktiv: SSH(22), HTTP(80), HTTPS(443)"

# --- Fail2Ban ---
log "Fail2Ban konfigurieren..."
systemctl enable fail2ban --quiet
systemctl start fail2ban
log "Fail2Ban aktiv (SSH Brute-Force Schutz)"

# --- Docker installieren ---
if ! command -v docker &>/dev/null; then
  log "Docker wird installiert..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -qq
  apt-get install -y -qq \
    docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable docker --quiet
  systemctl start docker
  log "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') installiert"
else
  log "Docker bereits installiert: $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# --- App-Verzeichnis ---
log "App-Verzeichnis anlegen..."
mkdir -p /opt/invoiceflow
cd /opt/invoiceflow

# --- SSL mit Certbot (nur wenn Domain angegeben) ---
if [ -n "$DOMAIN" ]; then
  log "SSL-Zertifikat fuer $DOMAIN wird eingerichtet..."
  apt-get install -y -qq certbot
  certbot certonly --standalone \
    --non-interactive --agree-tos \
    --email "$EMAIL" \
    -d "$DOMAIN" || warn "SSL-Einrichtung fehlgeschlagen – HTTP wird verwendet"

  # Certbot Auto-Renewal
  (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet") | crontab -
  log "SSL Auto-Renewal eingerichtet (taeglich 03:00 Uhr)"
fi

log "=== Setup abgeschlossen! ==="
echo ""
echo "Naechste Schritte:"
echo "  cd /opt/invoiceflow"
echo "  # Dateien hochladen (scp oder git clone)"
echo "  docker compose up -d --build"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "  App erreichbar unter: https://$DOMAIN"
else
  SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "DEINE-IP")
  echo "  App erreichbar unter: http://$SERVER_IP"
fi
