#!/usr/bin/env bash
# Push Resend + app secrets to Cloudflare Worker (production).
#
# Prerequisites:
#   npm i -g wrangler
#   wrangler login
#
# Usage:
#   export RESEND_API_KEY=re_...
#   export RESEND_WEBHOOK_SECRET=whsec_...
#   ./scripts/email-set-secrets.sh
#
# Or pipe values interactively:
#   ./scripts/email-set-secrets.sh --interactive

set -euo pipefail

WORKER_NAME="${CLOUDFLARE_WORKER_NAME:-taylansadikoglu-hue-pastel-ad-wizard}"
INTERACTIVE=false

for arg in "$@"; do
  case "$arg" in
    --interactive|-i) INTERACTIVE=true ;;
  esac
done

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

if $INTERACTIVE; then
  read -rsp "RESEND_API_KEY: " RESEND_API_KEY; echo
  read -rsp "RESEND_WEBHOOK_SECRET (optional): " RESEND_WEBHOOK_SECRET; echo
fi

: "${RESEND_API_KEY:?Set RESEND_API_KEY or use --interactive}"

put_secret RESEND_API_KEY "$RESEND_API_KEY"
put_secret RESEND_WEBHOOK_SECRET "${RESEND_WEBHOOK_SECRET:-}"
put_secret APP_URL "${APP_URL:-https://revenuad.com}"

echo "Done. Worker: $WORKER_NAME"
echo "Tracking subdomain rad.mail.revenuad.com is configured in Resend dashboard (not an env var)."
