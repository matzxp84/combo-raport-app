#!/usr/bin/env bash
# =============================================================================
# backup-gdrive.sh — backup wolumenów combo_data i combo_data_87 na Google Drive
#
# Wymagania:
#   - rclone zainstalowany i skonfigurowany (remote: gdrive)
#   - Docker uruchomiony
#
# Użycie:
#   ./scripts/backup-gdrive.sh             # backup oba wolumeny
#   ./scripts/backup-gdrive.sh combo_data  # backup jednego wolumenu
#
# Cron (codziennie o 03:00):
#   0 3 * * * /home/ultrax/Projects/combo-project/combo-raport-app/scripts/backup-gdrive.sh >> /var/log/combo-backup.log 2>&1
# =============================================================================

set -euo pipefail

# ── Konfiguracja ─────────────────────────────────────────────────────────────

RCLONE_REMOTE="gdrive"
RCLONE_PATH="combo-raport-backup"
VOLUMES=("combo_data" "combo_data_87")
KEEP_DAYS=30                        # ile dni trzymać stare backupy na GDrive
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
TMP_DIR=$(mktemp -d /tmp/combo-backup-XXXXXX)
LOG_PREFIX="[combo-backup][${TIMESTAMP}]"

# ── Funkcje pomocnicze ────────────────────────────────────────────────────────

log()  { echo "${LOG_PREFIX} $*"; }
warn() { echo "${LOG_PREFIX} WARN: $*" >&2; }
die()  { echo "${LOG_PREFIX} ERROR: $*" >&2; exit 1; }

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

# ── Sprawdzenie zależności ────────────────────────────────────────────────────

command -v rclone  >/dev/null 2>&1 || die "rclone nie jest zainstalowany. Patrz: wiki/Backup.md"
command -v docker  >/dev/null 2>&1 || die "docker nie jest zainstalowany"

rclone listremotes | grep -q "^${RCLONE_REMOTE}:" \
  || die "Remote '${RCLONE_REMOTE}' nie istnieje w rclone. Uruchom: rclone config"

# ── Jeśli podano argument — backup tylko wskazanego wolumenu ─────────────────

if [[ $# -gt 0 ]]; then
  VOLUMES=("$@")
fi

# ── Backup każdego wolumenu ───────────────────────────────────────────────────

BACKUP_COUNT=0
SKIP_COUNT=0

for VOLUME in "${VOLUMES[@]}"; do
  # Sprawdź czy wolumin istnieje
  if ! docker volume inspect "${VOLUME}" >/dev/null 2>&1; then
    warn "Wolumin '${VOLUME}' nie istnieje — pomijam"
    (( SKIP_COUNT++ )) || true
    continue
  fi

  ARCHIVE_NAME="${VOLUME}_${TIMESTAMP}.tar.gz"
  ARCHIVE_PATH="${TMP_DIR}/${ARCHIVE_NAME}"

  log "Tworzę archiwum: ${ARCHIVE_NAME}"

  # Montuje wolumin w tymczasowym kontenerze alpine i tworzy tar.gz
  docker run --rm \
    -v "${VOLUME}:/data:ro" \
    -v "${TMP_DIR}:/backup" \
    alpine \
    tar czf "/backup/${ARCHIVE_NAME}" -C /data .

  ARCHIVE_SIZE=$(du -sh "${ARCHIVE_PATH}" | cut -f1)
  log "Archiwum gotowe: ${ARCHIVE_SIZE}"

  # Upload na Google Drive
  REMOTE_DIR="${RCLONE_REMOTE}:${RCLONE_PATH}/${VOLUME}"
  log "Upload → ${REMOTE_DIR}/${ARCHIVE_NAME}"

  rclone copy "${ARCHIVE_PATH}" "${REMOTE_DIR}" \
    --stats-one-line \
    --stats 5s

  log "Upload zakończony: ${ARCHIVE_NAME}"
  (( BACKUP_COUNT++ )) || true
done

# ── Czyszczenie starych backupów ──────────────────────────────────────────────

log "Czyszczę pliki starsze niż ${KEEP_DAYS} dni na GDrive..."

for VOLUME in "${VOLUMES[@]}"; do
  REMOTE_DIR="${RCLONE_REMOTE}:${RCLONE_PATH}/${VOLUME}"
  rclone delete "${REMOTE_DIR}" \
    --min-age "${KEEP_DAYS}d" \
    --include "*.tar.gz" 2>/dev/null || true
done

# ── Podsumowanie ──────────────────────────────────────────────────────────────

log "Zakończono: ${BACKUP_COUNT} backup(y), ${SKIP_COUNT} pominięto"
log "Lokalizacja GDrive: ${RCLONE_REMOTE}:${RCLONE_PATH}/"
