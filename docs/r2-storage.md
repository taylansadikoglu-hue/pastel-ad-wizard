# Cloudflare R2 — RevenueAd creative vault

## Bucket

| Setting | Value |
|---------|--------|
| Bucket | `revenuead-creative-vault` |
| Account ID | `7169638abf93eba4c8a9644d870c35fa` |
| Region | OC (US West) |
| Public dev URL | `https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev` |

## Public access

In **Cloudflare → R2 → revenuead-creative-vault → Settings → Public access**, enable the `r2.dev` subdomain (or link the existing `pub-cf328a68c22840b998bf5b84a553b21c.r2.dev` URL).

Uploads via API succeed before public access is wired; the public URL returns 404 until the bucket is linked.

## Environment variables

```bash
CLOUDFLARE_API_TOKEN=cfat_...          # R2 Object Read & Write
CLOUDFLARE_ACCOUNT_ID=7169638abf93eba4c8a9644d870c35fa
R2_BUCKET_NAME=revenuead-creative-vault
R2_PUBLIC_URL=https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev
VITE_R2_PUBLIC_URL=https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev  # client img src
```

## API

- `POST /api/storage/cache-creative` — fetch external creative URL, store in R2, return public URL
- `npm run r2:test` — upload healthcheck object

## Production secrets

```bash
export CLOUDFLARE_API_TOKEN=cfat_...
./scripts/cloudflare-set-secrets.sh
```

Local: copy `.dev.vars.example` → `.dev.vars`

## Code

- `src/lib/storage/r2Config.ts` — config + public URL helpers
- `src/lib/storage/R2StorageService.ts` — upload via Cloudflare REST API
