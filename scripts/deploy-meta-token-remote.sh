#!/usr/bin/env bash
# Deploy META_ACCESS_TOKEN to production ingest server and restart Meta source.
#
# Usage (from a machine with SSH key to the server):
#   export REVENUAD_SSH_HOST=37.27.0.36
#   export REVENUAD_SSH_USER=ubuntu
#   export META_ACCESS_TOKEN='your-token-here'
#   ./scripts/deploy-meta-token-remote.sh
#
# Or one-liner:
#   META_ACCESS_TOKEN='...' ./scripts/deploy-meta-token-remote.sh

set -euo pipefail

HOST="${REVENUAD_SSH_HOST:-37.27.0.36}"
USER="${REVENUAD_SSH_USER:-ubuntu}"
ENV_PATH="${REVENUAD_ENV_PATH:-/opt/revenuad/.env}"
PM2_PROC="${REVENUAD_META_PM2:-revenuad-meta-source}"

if [[ -z "${META_ACCESS_TOKEN:-}" ]]; then
  echo "Set META_ACCESS_TOKEN in the environment"
  exit 1
fi

echo "Verifying token against Graph API..."
VERIFY=$(curl -s "https://graph.facebook.com/v21.0/me?access_token=${META_ACCESS_TOKEN}")
if echo "$VERIFY" | grep -q '"error"'; then
  echo "Token verification failed: $VERIFY"
  exit 1
fi
echo "Token valid: $(echo "$VERIFY" | grep -o '"name":"[^"]*"' | head -1)"

echo "Deploying to ${USER}@${HOST}:${ENV_PATH}"
ssh "${USER}@${HOST}" bash -s <<REMOTE
set -euo pipefail
ENV_PATH="${ENV_PATH}"
TOKEN='${META_ACCESS_TOKEN}'
PM2_PROC="${PM2_PROC}"

if [[ ! -f "\$ENV_PATH" ]]; then
  echo "Missing \$ENV_PATH"
  exit 1
fi

if grep -q '^META_ACCESS_TOKEN=' "\$ENV_PATH"; then
  sed -i "s|^META_ACCESS_TOKEN=.*|META_ACCESS_TOKEN=\${TOKEN}|" "\$ENV_PATH"
else
  echo "META_ACCESS_TOKEN=\${TOKEN}" >> "\$ENV_PATH"
fi

chmod 600 "\$ENV_PATH"
echo "Updated META_ACCESS_TOKEN in \$ENV_PATH"

if command -v pm2 >/dev/null 2>&1; then
  pm2 restart "\$PM2_PROC" || pm2 start "\$PM2_PROC" || true
  pm2 status "\$PM2_PROC" || true
fi

set -a
# shellcheck disable=SC1090
source "\$ENV_PATH"
set +a
curl -s "https://graph.facebook.com/v21.0/me?access_token=\$META_ACCESS_TOKEN" | head -c 120
echo
REMOTE

echo "Done."
