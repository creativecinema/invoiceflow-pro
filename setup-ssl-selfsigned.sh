#!/bin/bash
# ═══════════════════════════════════════════════════
#  Selbstsigniertes SSL (fuer IP-Zugriff ohne Domain)
#  Usage: bash setup-ssl-selfsigned.sh
# ═══════════════════════════════════════════════════
set -e
cd /opt/briefingdesk

echo "━━━ Self-signed SSL Zertifikat erstellen ━━━"

# Create cert directory
mkdir -p ssl

# Generate self-signed cert (valid 1 year)
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/C=DE/ST=Bayern/L=Erlangen/O=CreativeCinema/CN=briefingdesk"

echo "  Zertifikat erstellt: ssl/fullchain.pem"

# Update nginx config to use local certs
sed -i 's|/etc/letsencrypt/live/briefingdesk/fullchain.pem|/etc/nginx/ssl/fullchain.pem|g' nginx/default.conf
sed -i 's|/etc/letsencrypt/live/briefingdesk/privkey.pem|/etc/nginx/ssl/privkey.pem|g' nginx/default.conf

# Update docker-compose: mount ssl dir into nginx
if ! grep -q "ssl" docker-compose.yml; then
  sed -i '/certbot-certs:\/etc\/letsencrypt:ro/a\      - ./ssl:/etc/nginx/ssl:ro' docker-compose.yml
fi

# Restart
docker compose down
docker compose up -d

echo ""
echo "━━━ FERTIG ━━━"
echo "  HTTPS: https://$(curl -s ifconfig.me):443"
echo "  Hinweis: Browser zeigt Warnung (selbstsigniert). Das ist OK fuer Entwicklung."
echo ""
echo "  Fuer echtes SSL mit Domain:"
echo "  1. DNS A-Record auf $(curl -s ifconfig.me) setzen"
echo "  2. bash setup-ssl.sh DOMAIN EMAIL"
echo ""
