#!/bin/bash
# ═══════════════════════════════════════════════════
#  BriefingDesk – HTTPS Setup mit Let's Encrypt
#  
#  Usage: bash setup-ssl.sh DOMAIN EMAIL
#  Beispiel: bash setup-ssl.sh briefingdesk.meinefirma.de admin@firma.de
#
#  Voraussetzungen:
#  - Domain muss auf die Server-IP (46.225.161.234) zeigen
#  - Port 80 muss offen sein
# ═══════════════════════════════════════════════════
set -e

DOMAIN=${1:-""}
EMAIL=${2:-""}

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo ""
  echo "  BriefingDesk HTTPS Setup"
  echo "  ========================"
  echo ""
  echo "  Usage: bash setup-ssl.sh DOMAIN EMAIL"
  echo ""
  echo "  Beispiel:"
  echo "    bash setup-ssl.sh briefingdesk.firma.de admin@firma.de"
  echo ""
  echo "  WICHTIG: Die Domain muss VORHER auf die IP zeigen!"
  echo "           DNS A-Record: DOMAIN -> $(curl -s ifconfig.me 2>/dev/null || echo 'SERVER_IP')"
  echo ""
  exit 1
fi

echo ""
echo "━━━ BriefingDesk HTTPS Setup ━━━"
echo "  Domain: $DOMAIN"
echo "  Email:  $EMAIL"
echo ""

cd /opt/briefingdesk

# Step 1: Update nginx config with domain
echo "━━━ 1. Nginx konfigurieren ━━━"
sed -i "s/server_name _;/server_name $DOMAIN;/g" nginx/default.conf
sed -i "s|/etc/letsencrypt/live/briefingdesk/|/etc/letsencrypt/live/$DOMAIN/|g" nginx/default.conf

# Step 2: Start with HTTP-only config first
echo "━━━ 2. HTTP-only starten (fuer Certbot) ━━━"
cp nginx/default-initial.conf nginx/default.conf.bak
cp nginx/default-initial.conf nginx/active.conf
# Temporarily use initial config
docker compose down
cp nginx/default-initial.conf nginx/default.conf
docker compose up -d nginx briefingdesk
sleep 5

# Step 3: Get SSL certificate
echo "━━━ 3. SSL Zertifikat erstellen ━━━"
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 4: Switch to HTTPS config
echo "━━━ 4. Auf HTTPS umschalten ━━━"
# Restore full SSL config
cp nginx/default.conf.bak nginx/default.conf 2>/dev/null || true
# Make sure domain and cert path are correct
sed -i "s/server_name _;/server_name $DOMAIN;/g" nginx/default.conf
sed -i "s|/etc/letsencrypt/live/briefingdesk/|/etc/letsencrypt/live/$DOMAIN/|g" nginx/default.conf

# Restart everything
docker compose down
docker compose up -d

# Step 5: Setup auto-renewal (crontab)
echo "━━━ 5. Auto-Renewal einrichten ━━━"
CRON_LINE="0 3 * * * cd /opt/briefingdesk && docker compose run --rm certbot renew --quiet && docker compose exec nginx nginx -s reload"
(crontab -l 2>/dev/null | grep -v certbot; echo "$CRON_LINE") | crontab -
echo "  Cron: Zertifikat wird taeglich um 3:00 geprueft"

# Step 6: Update OAuth callback URL
echo ""
echo "━━━ FERTIG ━━━"
echo ""
echo "  HTTPS aktiv: https://$DOMAIN"
echo ""
echo "  WICHTIG - Azure OAuth Redirect URI aktualisieren:"
echo "  Alt:  http://46.225.161.234:3000/api/email/ms-callback"
echo "  Neu:  https://$DOMAIN/api/email/ms-callback"
echo ""
echo "  In Azure Portal > App-Registrierungen > BriefingDesk > Redirect URIs"
echo ""
