#!/usr/bin/env bash
# Run ON the Seed server (ssh seed@37.27.0.36) — syncs engine + frontend from main.
#
#   curl -fsSL https://raw.githubusercontent.com/taylansadikoglu-hue/pastel-ad-wizard/main/scripts/seed-server-sync.sh | bash
# Or after git pull in /opt/revenuad-frontend:
#   ./scripts/seed-server-sync.sh

set -euo pipefail

BRANCH="${REVENUAD_DEPLOY_BRANCH:-main}"
ENGINE_PATH="${REVENUAD_ENGINE_PATH:-/opt/revenuad}"
FRONTEND_PATH="${REVENUAD_FRONTEND_PATH:-/opt/revenuad-frontend}"

sync_repo() {
  local path="$1"
  local label="$2"
  if [[ ! -d "$path/.git" ]]; then
    echo "SKIP $label — no git repo at $path"
    return
  fi
  echo "=== $label: $path ==="
  cd "$path"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
}

echo "Seed server sync — branch $BRANCH"
echo "Started: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# --- Engine (api.revenuad.com) ---
if [[ -d "$ENGINE_PATH" ]]; then
  sync_repo "$ENGINE_PATH" "Engine"
  cd "$ENGINE_PATH"
  npm run build 2>/dev/null || true
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart revenuad-engine --update-env || true
    pm2 stop revenuad-meta-source 2>/dev/null || true
    echo "Stopped revenuad-meta-source (AdLibrary owns Meta)"
    pm2 status | head -20 || true
  fi
  if [[ -f package.json ]] && grep -q data-quality:audit package.json; then
    npm run data-quality:audit -- --domain commbank.com.au 2>/dev/null | tail -8 || true
  fi
else
  echo "WARN: engine path missing: $ENGINE_PATH"
fi

# --- Frontend (revenuad.com Cloudflare Worker) ---
if [[ -d "$FRONTEND_PATH" ]]; then
  sync_repo "$FRONTEND_PATH" "Frontend"
  cd "$FRONTEND_PATH"
  npm run build
  WRANGLER_TOKEN="${CLOUDFLARE_WORKERS_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
  if [[ -z "$WRANGLER_TOKEN" ]] && [[ -f "$ENGINE_PATH/.env" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENGINE_PATH/.env"
    set +a
    WRANGLER_TOKEN="${CLOUDFLARE_WORKERS_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
  fi
  if [[ -z "$WRANGLER_TOKEN" ]]; then
    echo "ERROR: Set CLOUDFLARE_WORKERS_API_TOKEN (Workers Scripts → Edit) then re-run frontend deploy:"
    echo "  cd $FRONTEND_PATH && CLOUDFLARE_API_TOKEN=cfat_... npx nitro deploy --prebuilt"
    exit 1
  fi
  export CLOUDFLARE_API_TOKEN="$WRANGLER_TOKEN"
  npx nitro deploy --prebuilt
  echo "Frontend deployed — https://revenuad.com"
else
  echo "WARN: frontend path missing: $FRONTEND_PATH"
fi

echo "Done: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
