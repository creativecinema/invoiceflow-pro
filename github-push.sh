#!/bin/bash
# ============================================================
# InvoiceFlow Pro — GitHub Push Script
# Einmalig ausführen, um das Repo zu erstellen & zu pushen
# ============================================================
#
# VORAUSSETZUNG: GitHub CLI installiert
#   macOS:   brew install gh
#   Ubuntu:  sudo apt install gh
#   Windows: winget install GitHub.cli
#
# DANN: gh auth login  (einmalig)
# ============================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✓] $1${NC}"; }
info() { echo -e "${BLUE}[→] $1${NC}"; }
warn() { echo -e "${YELLOW}[!] $1${NC}"; }

REPO_NAME="invoiceflow-pro"
DESCRIPTION="Moderne Abrechnungssoftware – besser als Weclapp. Docker-ready, Hetzner-deploybar."

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════╗"
echo "║   InvoiceFlow Pro — GitHub Push Script   ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${NC}"

# Prüfen ob gh CLI installiert ist
if ! command -v gh &>/dev/null; then
  echo -e "${RED}GitHub CLI nicht gefunden!${NC}"
  echo ""
  echo "Bitte installieren:"
  echo "  macOS:   brew install gh"
  echo "  Ubuntu:  sudo apt install gh"
  echo "  Windows: winget install GitHub.cli"
  echo ""
  echo "Dann: gh auth login"
  exit 1
fi

# Prüfen ob eingeloggt
if ! gh auth status &>/dev/null; then
  warn "Nicht bei GitHub eingeloggt. Starte Login..."
  gh auth login
fi

USERNAME=$(gh api user --jq '.login')
log "Eingeloggt als: $USERNAME"

# Git initialisieren (falls noch nicht)
if [ ! -d ".git" ]; then
  info "Git Repository initialisieren..."
  git init
  git branch -M main
fi

# Alle Dateien stagen
info "Dateien stagen..."
git add .
git status --short

# Commit
info "Commit erstellen..."
git commit -m "🚀 Initial commit — InvoiceFlow Pro

- Komplette Abrechnungs-App (Single Page Application)
- Docker + Nginx Alpine Setup
- Hetzner Deployment Script (setup.sh)
- GitHub Actions CI/CD Pipeline
- SSL/HTTPS Konfiguration
- DEPLOYMENT.md Anleitung" 2>/dev/null || log "Nichts zu committen."

# GitHub Repo erstellen (public)
info "GitHub Repository erstellen..."
if gh repo view "$USERNAME/$REPO_NAME" &>/dev/null; then
  warn "Repo $REPO_NAME existiert bereits. Nur pushen..."
  git remote set-url origin "https://github.com/$USERNAME/$REPO_NAME.git" 2>/dev/null || \
  git remote add origin "https://github.com/$USERNAME/$REPO_NAME.git"
else
  gh repo create "$REPO_NAME" \
    --public \
    --description "$DESCRIPTION" \
    --source=. \
    --remote=origin \
    --push
  log "Repository erstellt: https://github.com/$USERNAME/$REPO_NAME"
fi

# Push
info "Code pushen..."
git push -u origin main --force

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  FERTIG!                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 GitHub Repo:   ${BLUE}https://github.com/$USERNAME/$REPO_NAME${NC}"
echo -e "  📦 Clone URL:     ${BLUE}git clone https://github.com/$USERNAME/$REPO_NAME.git${NC}"
echo ""
echo -e "  ${YELLOW}Nächste Schritte für Hetzner Deployment:${NC}"
echo -e "  1. Server erstellen: https://console.hetzner.cloud"
echo -e "  2. SSH verbinden: ssh root@DEINE-SERVER-IP"
echo -e "  3. git clone https://github.com/$USERNAME/$REPO_NAME.git /opt/invoiceflow"
echo -e "  4. cd /opt/invoiceflow && bash setup.sh DEINE-DOMAIN.de"
echo -e "  5. docker compose up -d --build"
echo ""
echo -e "  ${YELLOW}GitHub Actions CI/CD einrichten:${NC}"
echo -e "  → https://github.com/$USERNAME/$REPO_NAME/settings/secrets/actions"
echo -e "  → Secret: HETZNER_HOST = Deine Server-IP"
echo -e "  → Secret: HETZNER_SSH_KEY = cat ~/.ssh/id_ed25519"
echo ""
