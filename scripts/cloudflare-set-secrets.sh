#!/usr/bin/env bash
# Push Cloudflare + Resend secrets to production Worker.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=cfat_...
#   export RESEND_API_KEY=re_...
#   ./scripts/cloudflare-set-secrets.sh

set -euo pipefail

WORKER_NAME="${CLOUDFLARE_WORKER_NAME:-taylansadikoglu-hue-pastel-ad-wizard}"

put_secret() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "skip $name (empty)"
    return
  fi
  echo "Setting worker secret: $name"
  printf '%s' "$value" | npx wrangler secret put "$name" --name "$WORKER_NAME"
}

put_secret CLOUDFLARE_API_TOKEN "${CLOUDFLARE_API_TOKEN:-}"
put_secret CLOUDFLARE_ACCOUNT_ID "${CLOUDFLARE_ACCOUNT_ID:-7169638abf93eba4c8a9644d870c35fa}"
put_secret R2_BUCKET_NAME "${R2_BUCKET_NAME:-revenuead-creative-vault}"
put_secret R2_PUBLIC_URL "${R2_PUBLIC_URL:-https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev}"
put_secret RESEND_API_KEY "${RESEND_API_KEY:-}"
put_secret RESEND_WEBHOOK_SECRET "${RESEND_WEBHOOK_SECRET:-}"
put_secret APP_URL "${APP_URL:-https://revenuad.com}"

echo "Done. Worker: $WORKER_NAME"
