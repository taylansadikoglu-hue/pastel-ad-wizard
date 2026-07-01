#!/usr/bin/env bash
# One-shot launch deploy on Seed production host: engine pull + frontend deploy.
#
#   export CLOUDFLARE_WORKERS_API_TOKEN=cfat_...
#   export META_ACCESS_TOKEN='...'   # optional — only if Meta ToS accepted
#   ./scripts/launch-deploy-remote.sh

set -euo pipefail

HOST="${REVENUAD_SSH_HOST:-37.27.0.36}"
USER="${REVENUAD_SSH_USER:-seed}"
ENGINE_PATH="${REVENUAD_ENGINE_PATH:-/opt/revenuad}"
FRONTEND_PATH="${REVENUAD_FRONTEND_PATH:-/opt/revenuad-frontend}"
BRANCH="${REVENUAD_DEPLOY_BRANCH:-main}"

echo "=== Launch deploy on ${USER}@${HOST} ==="

ssh "${USER}@${HOST}" bash -s <<REMOTE
set -euo pipefail
BRANCH="${BRANCH}"
ENGINE_PATH="${ENGINE_PATH}"
FRONTEND_PATH="${FRONTEND_PATH}"

echo "--- Engine: git pull + build ---"
if [[ -d "\$ENGINE_PATH" ]]; then
  cd "\$ENGINE_PATH"
  git fetch origin "\$BRANCH" && git checkout "\$BRANCH" && git pull origin "\$BRANCH"
  npm run build 2>/dev/null || true
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart revenuad-engine --update-env 2>/dev/null || true
    pm2 stop revenuad-meta-source 2>/dev/null || true
    echo "Meta source stopped (AdLibrary owns Meta ingest)"
  fi
else
  echo "Skip engine — no \$ENGINE_PATH"
fi

echo "--- Data quality: CommBank dedupe check ---"
if [[ -d "\$ENGINE_PATH" ]]; then
  cd "\$ENGINE_PATH"
  npm run data-quality:audit -- --domain commbank.com.au 2>/dev/null | tail -5 || true
fi
REMOTE

if [[ -n "${CLOUDFLARE_WORKERS_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}" ]]; then
  echo "--- Frontend: build + nitro deploy ---"
  "$(dirname "$0")/deploy-frontend-remote.sh"
else
  echo "Skip frontend — set CLOUDFLARE_WORKERS_API_TOKEN for Workers deploy"
fi

if [[ -n "${META_ACCESS_TOKEN:-}" ]]; then
  echo "--- Meta token (optional) ---"
  "$(dirname "$0")/deploy-meta-token-remote.sh" || echo "Meta deploy skipped (ToS or token issue)"
fi

echo "=== Launch deploy finished ==="
