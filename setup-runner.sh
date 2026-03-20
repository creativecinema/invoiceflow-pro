#!/usr/bin/env bash
# =============================================================
#  setup-runner.sh
#  Einmalig auf dem Hetzner-Server ausführen.
#  Registriert den GitHub Actions Self-Hosted Runner.
#
#  Aufruf: bash setup-runner.sh GITHUB_REPO_URL RUNNER_TOKEN
#  Beispiel:
#    bash setup-runner.sh \
#      https://github.com/creativecinema/invoiceflowproup \
#      AABBCC...
# =============================================================
set -euo pipefail

REPO_URL="${1:-}"
TOKEN="${2:-}"

[ -z "$REPO_URL" ] && echo "Fehler: REPO_URL fehlt" && exit 1
[ -z "$TOKEN"    ] && echo "Fehler: TOKEN fehlt"    && exit 1

RUNNER_DIR="/opt/actions-runner"
RUNNER_VERSION="2.317.0"

echo "→ Runner-Verzeichnis anlegen..."
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

echo "→ Runner herunterladen..."
curl -sL "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
  | tar xz

echo "→ Runner registrieren..."
./config.sh \
  --url "$REPO_URL" \
  --token "$TOKEN" \
  --name "hetzner-server" \
  --labels "self-hosted,linux,x64" \
  --work "/opt/invoiceflow" \
  --unattended \
  --replace

echo "→ Runner als systemd-Service einrichten..."
./svc.sh install root
./svc.sh start

echo ""
echo "✅ Runner läuft!"
echo "   Status: ./svc.sh status"
echo "   Logs:   journalctl -u actions.runner.* -f"
