# Frontend deploy — revenuad.com

## TL;DR

**Do not** use Cloudflare Workers → “Connect to GitHub” for an empty project. That creates a **new** worker that is not revenuad.com.

Today **revenuad.com is already live** — deployed by **Lovable** (lovable.dev), not from your Cloudflare Workers dashboard.

| Surface | Host | How to update |
|---------|------|----------------|
| **revenuad.com** (UI) | Lovable → Cloudflare (managed) | **Publish** in your Lovable project |
| **api.revenuad.com** (engine) | Seed server `/opt/revenuad` | `git pull` + `pm2 restart revenuad-engine` on Seed |

## How we know

Live HTML includes Lovable deploy markers:

- `data-artifact-kind="dwl_content_hash"`
- `data-commit-sha="fa278ac..."` (pinned deploy revision)

Check what's live:

```bash
curl -s https://revenuad.com/ | grep -o 'data-commit-sha="[^"]*"'
```

Compare to `git rev-parse main` — if they differ, the UI is stale.

## Update the UI (recommended path)

1. Open your **Lovable** project for this repo (`pastel-ad-wizard`)
2. Ensure GitHub sync is on (Lovable ↔ `taylansadikoglu-hue/pastel-ad-wizard`)
3. Merge latest to `main` (honest counts, dedup UI, etc.)
4. Click **Publish** / **Deploy** in Lovable

No Cloudflare Workers dashboard setup required.

## Why Cloudflare Workers looks empty

Your personal CF account shows “Connect and ship something new” because:

- Lovable deploys into **its** Workers/Pages pipeline (or a linked account you don't manage as a named script)
- The worker name `taylansadikoglu-hue-pastel-ad-wizard` is a **build artifact name**, not necessarily visible in your dashboard

Connecting GitHub there would be a **second, unrelated** deploy path.

## Self-host path (optional, later)

Only if you want to **leave Lovable hosting** and own deploy end-to-end:

1. Create CF API token: **Edit Cloudflare Workers** template
2. From repo: `npm run build && CLOUDFLARE_API_TOKEN=cfat_... npx nitro deploy --prebuilt`
3. Add route `revenuad.com/*` → your worker in CF dashboard
4. Migrate worker secrets (`scripts/cloudflare-set-secrets.sh`)

Until then, use Lovable Publish.

## Seed server (backend only)

```bash
ssh seed@37.27.0.36
cd /opt/revenuad && git pull origin main && pm2 restart revenuad-engine --update-env
```

Frontend clone at `/opt/revenuad-frontend` is only needed for the self-host path above.
