#!/usr/bin/env bash
# =============================================================
#  setup-server.sh
#  Wird einmalig direkt auf dem Hetzner-Server ausgeführt:
#
#    scp setup-server.sh root@SERVER_IP:/root/
#    ssh root@SERVER_IP "bash /root/setup-server.sh"
#
# =============================================================
set -euo pipefail

DOMAIN=""          # ← Optional: Domain hier eintragen
APP_DIR="/var/www/angebot"
NODE_VERSION="20"

log()  { echo -e "\e[32m[✓]\e[0m $1"; }
warn() { echo -e "\e[33m[!]\e[0m $1"; }

log "=== Angebot Builder – Server Setup ==="

# System
log "Systemupdate..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban

# Firewall (UFW)
log "Konfiguriere UFW Firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log "Firewall aktiv: SSH, HTTP, HTTPS erlaubt"

# Fail2ban
systemctl enable fail2ban --now
log "Fail2ban aktiv"

# Node.js
if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
  log "Installiere Node.js ${NODE_VERSION}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
log "Node: $(node -v)"

# Nginx
if ! command -v nginx &>/dev/null; then
  apt-get install -y -qq nginx
fi
systemctl enable nginx --now
log "Nginx: aktiv"

# Certbot
if ! command -v certbot &>/dev/null; then
  apt-get install -y -qq certbot python3-certbot-nginx
fi
log "Certbot: installiert"

# App-Verzeichnis
mkdir -p "${APP_DIR}/dist"
chown -R www-data:www-data "${APP_DIR}"
chmod -R 755 "${APP_DIR}"
log "App-Verzeichnis: ${APP_DIR}"

# Nginx-Konfiguration schreiben
SERVER_IP=$(curl -s ifconfig.me)
NGINX_CONF="/etc/nginx/sites-available/angebot"

cat > "${NGINX_CONF}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN:-$SERVER_IP};

    root ${APP_DIR}/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }

    access_log /var/log/nginx/angebot.access.log;
    error_log  /var/log/nginx/angebot.error.log;
}
NGINX

ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/angebot
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t && systemctl reload nginx
log "Nginx konfiguriert"

# Deployment-Helfer-Skript
cat > /usr/local/bin/angebot-deploy <<'HELPER'
#!/bin/bash
# Wird aufgerufen wenn deploy.sh die dist/ überträgt
# z.B. für zukünftige Post-Deploy-Hooks (Cache leeren etc.)
echo "[$(date)] Deploy empfangen" >> /var/log/angebot-deploy.log
systemctl reload nginx
HELPER
chmod +x /usr/local/bin/angebot-deploy

log ""
log "✅ Server-Setup ABGESCHLOSSEN"
log ""
warn "Nächste Schritte:"
echo ""
echo "  ┌─ Lokal ausführen ──────────────────────────────────────────┐"
echo "  │  1. npm run build          # App bauen                     │"
echo "  │  2. ./deploy.sh root@${SERVER_IP}  # App deployen         │"
echo "  └──────────────────────────────────────────────────────────── ┘"
echo ""
echo "  ┌─ SSL aktivieren (nach DNS-Setup) ──────────────────────────┐"
echo "  │  certbot --nginx -d DEINE_DOMAIN.de                        │"
echo "  └────────────────────────────────────────────────────────────┘"
echo ""
echo "  Deine Server-IP: ${SERVER_IP}"
