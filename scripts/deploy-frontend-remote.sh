#!/usr/bin/env bash
# Deploy RevenuAD frontend (Cloudflare Worker) on the Seed production host.
#
# Usage:
#   export REVENUAD_SSH_HOST=37.27.0.36
#   export REVENUAD_SSH_USER=seed
#   export CLOUDFLARE_WORKERS_API_TOKEN=cfat_...   # Workers Scripts → Edit
#   ./scripts/deploy-frontend-remote.sh
#
# Or on the server directly (no SSH):
#   cd /opt/revenuad-frontend && git pull origin main && npm run build && npx nitro deploy --prebuilt

set -euo pipefail

HOST="${REVENUAD_SSH_HOST:-37.27.0.36}"
USER="${REVENUAD_SSH_USER:-seed}"
REPO_PATH="${REVENUAD_FRONTEND_PATH:-/opt/revenuad-frontend}"
BRANCH="${REVENUAD_DEPLOY_BRANCH:-main}"
WRANGLER_TOKEN="${CLOUDFLARE_WORKERS_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"

if [[ -z "${WRANGLER_TOKEN}" ]]; then
  echo "Set CLOUDFLARE_WORKERS_API_TOKEN (Account → Workers Scripts → Edit)"
  exit 1
fi

echo "Deploying frontend on ${USER}@${HOST}:${REPO_PATH} (branch ${BRANCH})"

ssh "${USER}@${HOST}" bash -s <<REMOTE
set -euo pipefail
REPO_PATH="${REPO_PATH}"
BRANCH="${BRANCH}"
WRANGLER_TOKEN='${WRANGLER_TOKEN}'

if [[ ! -d "\$REPO_PATH" ]]; then
  echo "Missing \$REPO_PATH — clone the repo there first"
  exit 1
fi

cd "\$REPO_PATH"
git fetch origin "\$BRANCH"
git checkout "\$BRANCH"
git pull origin "\$BRANCH"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

npm run build
export CLOUDFLARE_API_TOKEN="\$WRANGLER_TOKEN"
npx nitro deploy --prebuilt

echo "Frontend deploy complete — check https://revenuad.com"
REMOTE

echo "Done."
