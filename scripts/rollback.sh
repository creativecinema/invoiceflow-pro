#!/bin/bash
# ═══════════════════════════════════════════════════
#  rollback.sh – BriefingDesk Rollback
#  
#  Verwendung:
#    bash /opt/briefingdesk/scripts/rollback.sh v12-abc1234
#    bash /opt/briefingdesk/scripts/rollback.sh latest-backup
#    bash /opt/briefingdesk/scripts/rollback.sh list
# ═══════════════════════════════════════════════════

set -euo pipefail

TARGET="${1:-}"
APP_DIR="/opt/briefingdesk"
BACKUP_DIR="/opt/briefingdesk/backups"
LOG_FILE="/opt/briefingdesk/deploy.log"
REGISTRY_IMAGE=$(cat "$APP_DIR/.registry" 2>/dev/null || echo "")

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] ROLLBACK: $1"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

# ─── Liste aller verfügbaren Versionen ───
if [ "$TARGET" = "list" ] || [ -z "$TARGET" ]; then
  echo ""
  echo "═══ Verfügbare Versionen ═══"
  echo ""
  echo "Aktuelle Version: $(cat "$APP_DIR/.current_version" 2>/dev/null || echo 'unbekannt')"
  echo ""
  
  # Docker Images
  echo "── Docker Images ──"
  docker images --format "  {{.Repository}}:{{.Tag}}  ({{.Size}}, {{.CreatedSince}})" | grep briefingdesk || echo "  Keine Images gefunden"
  echo ""
  
  # Backups
  echo "── Backups ──"
  if ls -d "$BACKUP_DIR"/backup_* 1>/dev/null 2>&1; then
    for dir in $(ls -dt "$BACKUP_DIR"/backup_*); do
      VER=$(cat "$dir/.version" 2>/dev/null || echo "?")
      SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1)
      DATE=$(basename "$dir" | sed 's/backup_[^_]*_//')
      echo "  $VER  ($SIZE, $DATE)"
    done
  else
    echo "  Keine Backups vorhanden"
  fi
  
  # Deploy History
  echo ""
  echo "── Letzte 10 Deployments ──"
  tail -10 "$APP_DIR/deploy-history.log" 2>/dev/null || echo "  Keine History"
  echo ""
  exit 0
fi

# ─── Rollback zum letzten Backup ───
if [ "$TARGET" = "latest-backup" ]; then
  LATEST=$(ls -dt "$BACKUP_DIR"/backup_* 2>/dev/null | head -1)
  if [ -z "$LATEST" ]; then
    echo "❌ Kein Backup vorhanden!"
    exit 1
  fi
  TARGET=$(cat "$LATEST/.version" 2>/dev/null || echo "")
  if [ -z "$TARGET" ]; then
    echo "❌ Backup hat keine Version-Info!"
    exit 1
  fi
  log "Latest backup → Version $TARGET"
fi

log "═══ ROLLBACK START: Ziel=$TARGET ═══"

CURRENT_VERSION=$(cat "$APP_DIR/.current_version" 2>/dev/null || echo "none")
log "Aktuelle Version: $CURRENT_VERSION"

# ─── 1. Prüfen ob Docker Image existiert ───
IMAGE_EXISTS=false

# Prüfe lokale Images
if docker images --format "{{.Tag}}" | grep -q "^${TARGET}$"; then
  IMAGE_EXISTS=true
  log "Image lokal gefunden: briefingdesk-app:$TARGET"
fi

# Prüfe Registry
if [ "$IMAGE_EXISTS" = false ] && [ -n "$REGISTRY_IMAGE" ]; then
  log "Versuche Pull von Registry: $REGISTRY_IMAGE:$TARGET"
  if docker pull "$REGISTRY_IMAGE:$TARGET" 2>/dev/null; then
    docker tag "$REGISTRY_IMAGE:$TARGET" briefingdesk-app:$TARGET
    IMAGE_EXISTS=true
    log "Image aus Registry gepullt"
  fi
fi

if [ "$IMAGE_EXISTS" = false ]; then
  log "❌ Image für $TARGET nicht gefunden!"
  echo ""
  echo "Verfügbare Images:"
  docker images --format "  {{.Tag}}" | grep -v "<none>" | sort
  exit 1
fi

# ─── 2. Datenbank aus Backup wiederherstellen (falls vorhanden) ───
BACKUP_MATCH=$(ls -dt "$BACKUP_DIR"/backup_${TARGET}* 2>/dev/null | head -1)
if [ -n "$BACKUP_MATCH" ] && [ -f "$BACKUP_MATCH/briefingdesk.sqlite" ]; then
  log "Datenbank-Backup gefunden: $BACKUP_MATCH"
  
  # Aktuellen Stand zuerst sichern
  SAFETY_BACKUP="$BACKUP_DIR/pre_rollback_$(date +%Y%m%d_%H%M%S)"
  mkdir -p "$SAFETY_BACKUP"
  cp "/opt/briefingdesk/data/briefingdesk.sqlite" "$SAFETY_BACKUP/briefingdesk.sqlite" 2>/dev/null || true
  echo "$CURRENT_VERSION" > "$SAFETY_BACKUP/.version"
  log "Sicherheits-Backup erstellt: $SAFETY_BACKUP"
  
  # DB wiederherstellen
  cp "$BACKUP_MATCH/briefingdesk.sqlite" "/opt/briefingdesk/data/briefingdesk.sqlite"
  log "✅ Datenbank wiederhergestellt"
else
  log "Kein DB-Backup für $TARGET – behalte aktuelle Datenbank"
fi

# ─── 3. Container mit alter Version starten ───
log "Container neu starten mit Image: briefingdesk-app:$TARGET"
docker compose down --timeout 30 2>/dev/null || true

# Override image tag
DEPLOY_TAG="$TARGET" docker compose up -d --force-recreate

# ─── 4. Health Check ───
log "Health Check..."
HEALTHY=false
for i in $(seq 1 20); do
  sleep 2
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/settings" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    HEALTHY=true
    break
  fi
done

if [ "$HEALTHY" = true ]; then
  echo "$TARGET" > "$APP_DIR/.current_version"
  echo "$(date '+%Y-%m-%d %H:%M:%S') | $TARGET | ROLLBACK_OK | from=$CURRENT_VERSION" >> "$APP_DIR/deploy-history.log"
  log "✅ ROLLBACK ERFOLGREICH: $TARGET"
else
  log "❌ ROLLBACK FEHLGESCHLAGEN – Health Check negativ"
  echo "$(date '+%Y-%m-%d %H:%M:%S') | $TARGET | ROLLBACK_FAILED | from=$CURRENT_VERSION" >> "$APP_DIR/deploy-history.log"
  exit 1
fi
