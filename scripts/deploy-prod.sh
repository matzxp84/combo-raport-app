#!/usr/bin/env bash
# =============================================================================
# deploy-prod.sh — deploy combo-raport-app na serwer produkcyjny (Mikrus)
#
# Co robi:
#   1. Eksportuje dane z lokalnego wolumenu dev (auth.json, email.json)
#   2. Kopiuje je na serwer produkcyjny
#   3. Buduje i uruchamia kontener produkcyjny na zdalnym serwerze
#
# Wymagania:
#   - Docker uruchomiony lokalnie
#   - Klucz SSH skonfigurowany do serwera Mikrus
#   - .env obecny lokalnie (zmienne GoPos)
#
# Użycie:
#   ./scripts/deploy-prod.sh                    # pełny deploy (kod + dane)
#   ./scripts/deploy-prod.sh --code-only        # tylko kod, bez danych
#   ./scripts/deploy-prod.sh --data-only        # tylko dane, bez rebuild
#
# Konfiguracja — ustaw poniżej lub w pliku .deploy.env:
# =============================================================================

set -euo pipefail

# ── Konfiguracja ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "${SCRIPT_DIR}")"
DEPLOY_ENV="${PROJECT_DIR}/.deploy.env"

# Domyślne wartości — nadpisywane przez .deploy.env
REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_PORT="${DEPLOY_SSH_PORT:-}"
REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_APP_DIR="${DEPLOY_APP_DIR:-/root/combo-raport-app}"
COMPOSE_PROFILE="${DEPLOY_PROFILE:-prod87}"

# Wolumin źródłowy (dev) i docelowy (prod)
SOURCE_VOLUME="combo_data"
TARGET_VOLUME="combo_data_87"

# ── Załaduj .deploy.env jeśli istnieje ───────────────────────────────────────

if [[ -f "${DEPLOY_ENV}" ]]; then
  # shellcheck source=/dev/null
  source "${DEPLOY_ENV}"
  REMOTE_HOST="${DEPLOY_HOST:-${REMOTE_HOST}}"
  REMOTE_PORT="${DEPLOY_SSH_PORT:-${REMOTE_PORT}}"
  REMOTE_USER="${DEPLOY_USER:-${REMOTE_USER}}"
  REMOTE_APP_DIR="${DEPLOY_APP_DIR:-${REMOTE_APP_DIR}}"
  COMPOSE_PROFILE="${DEPLOY_PROFILE:-${COMPOSE_PROFILE}}"
fi

# ── Parsowanie argumentów ────────────────────────────────────────────────────

DEPLOY_CODE=true
DEPLOY_DATA=true

case "${1:-}" in
  --code-only) DEPLOY_DATA=false ;;
  --data-only) DEPLOY_CODE=false ;;
  --help|-h)
    echo "Użycie: $0 [--code-only | --data-only | --help]"
    echo ""
    echo "  (brak flag)    Pełny deploy: dane + kod"
    echo "  --code-only    Tylko git pull + rebuild kontenera"
    echo "  --data-only    Tylko sync danych (auth.json, email.json)"
    echo ""
    echo "Konfiguracja: plik .deploy.env lub zmienne środowiskowe"
    exit 0
    ;;
esac

# ── Funkcje ──────────────────────────────────────────────────────────────────

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_PREFIX="[deploy][${TIMESTAMP}]"

log()  { echo "${LOG_PREFIX} $*"; }
warn() { echo "${LOG_PREFIX} WARN: $*" >&2; }
die()  { echo "${LOG_PREFIX} ERROR: $*" >&2; exit 1; }

# ── Walidacja ────────────────────────────────────────────────────────────────

[[ -n "${REMOTE_HOST}" ]] || die "DEPLOY_HOST nie ustawiony. Skonfiguruj .deploy.env"
[[ -n "${REMOTE_PORT}" ]] || die "DEPLOY_SSH_PORT nie ustawiony. Skonfiguruj .deploy.env"

SSH_CMD="ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST}"
SCP_CMD="scp -P ${REMOTE_PORT}"

# Test połączenia
log "Sprawdzam połączenie z ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}..."
${SSH_CMD} "echo ok" >/dev/null 2>&1 || die "Nie mogę połączyć się z serwerem. Sprawdź SSH."

# ── DANE: eksport z dev → import na prod ─────────────────────────────────────

if [[ "${DEPLOY_DATA}" == true ]]; then
  log "=== Synchronizacja danych ==="

  TMP_DIR=$(mktemp -d /tmp/combo-deploy-XXXXXX)
  trap "rm -rf ${TMP_DIR}" EXIT

  # Eksport z lokalnego wolumenu dev
  if docker volume inspect "${SOURCE_VOLUME}" >/dev/null 2>&1; then
    log "Eksport danych z wolumenu '${SOURCE_VOLUME}'..."
    docker run --rm \
      -v "${SOURCE_VOLUME}:/data:ro" \
      -v "${TMP_DIR}:/export" \
      alpine sh -c "cp /data/auth.json /export/ 2>/dev/null; cp /data/email.json /export/ 2>/dev/null; ls -la /export/"

    # Weryfikacja
    if [[ ! -f "${TMP_DIR}/auth.json" ]]; then
      warn "auth.json nie znaleziony w wolumenie — pomijam dane"
      DEPLOY_DATA=false
    else
      USERS_COUNT=$(python3 -c "import json; print(len(json.load(open('${TMP_DIR}/auth.json'))['users']))" 2>/dev/null || echo "?")
      log "Znaleziono ${USERS_COUNT} użytkowników w auth.json"

      # Kopiuj na serwer
      log "Kopiuję dane na serwer..."
      ${SCP_CMD} "${TMP_DIR}/auth.json" "${TMP_DIR}/email.json" \
        "${REMOTE_USER}@${REMOTE_HOST}:/tmp/combo-data-import/" 2>/dev/null \
        || { ${SSH_CMD} "mkdir -p /tmp/combo-data-import" && \
             ${SCP_CMD} "${TMP_DIR}/auth.json" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/combo-data-import/"; \
             [[ -f "${TMP_DIR}/email.json" ]] && \
             ${SCP_CMD} "${TMP_DIR}/email.json" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/combo-data-import/"; }

      # Import do wolumenu prod na serwerze
      log "Import danych do wolumenu '${TARGET_VOLUME}' na serwerze..."
      ${SSH_CMD} "docker volume inspect ${TARGET_VOLUME} >/dev/null 2>&1 || docker volume create ${TARGET_VOLUME}"
      ${SSH_CMD} "docker run --rm \
        -v ${TARGET_VOLUME}:/data \
        -v /tmp/combo-data-import:/import:ro \
        alpine sh -c 'cp /import/auth.json /data/ 2>/dev/null; cp /import/email.json /data/ 2>/dev/null; chown -R 1001:1001 /data/; ls -la /data/'"
      ${SSH_CMD} "rm -rf /tmp/combo-data-import"

      log "Dane zsynchronizowane"
    fi
  else
    warn "Wolumin '${SOURCE_VOLUME}' nie istnieje lokalnie — pomijam dane"
  fi
fi

# ── KOD: deploy aplikacji na serwer ──────────────────────────────────────────

if [[ "${DEPLOY_CODE}" == true ]]; then
  log "=== Deploy kodu ==="

  # Sprawdź czy repo istnieje na serwerze
  REPO_EXISTS=$(${SSH_CMD} "[[ -d ${REMOTE_APP_DIR}/.git ]] && echo yes || echo no")

  if [[ "${REPO_EXISTS}" == "no" ]]; then
    log "Repo nie istnieje na serwerze — klon..."
    REMOTE_URL=$(cd "${PROJECT_DIR}" && git remote get-url origin 2>/dev/null || echo "")
    [[ -n "${REMOTE_URL}" ]] || die "Brak git remote 'origin'. Dodaj remote i wypchnij kod."
    ${SSH_CMD} "git clone ${REMOTE_URL} ${REMOTE_APP_DIR}"
  fi

  # Kopiuj .env na serwer (secrets)
  if [[ -f "${PROJECT_DIR}/.env" ]]; then
    log "Kopiuję .env na serwer..."
    ${SCP_CMD} "${PROJECT_DIR}/.env" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/.env"
  else
    warn ".env nie znaleziony — secrets nie zaktualizowane"
  fi

  # Pull + rebuild
  log "Git pull + rebuild na serwerze..."
  ${SSH_CMD} "cd ${REMOTE_APP_DIR} && \
    git pull --ff-only && \
    docker compose --profile ${COMPOSE_PROFILE} up -d --build"

  # Healthcheck
  log "Czekam na healthcheck..."
  sleep 5
  HEALTH=$(${SSH_CMD} "docker inspect --format='{{.State.Health.Status}}' combo_prod87 2>/dev/null" || echo "unknown")
  log "Status kontenera: ${HEALTH}"
fi

# ── Podsumowanie ─────────────────────────────────────────────────────────────

log "=== Deploy zakończony ==="
[[ "${DEPLOY_DATA}" == true ]] && log "  Dane: zsynchronizowane (${SOURCE_VOLUME} → ${TARGET_VOLUME})"
[[ "${DEPLOY_CODE}" == true ]] && log "  Kod:  zbudowany i uruchomiony (profil: ${COMPOSE_PROFILE})"
log "  Serwer: ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
