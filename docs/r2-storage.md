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

## API tokens

Use **split tokens** (recommended) or one token with all permission groups:

| Token | Permission | Used for |
|-------|------------|----------|
| `cfat_...` REST API | **Cloudflare R2 → Edit** | Upload creatives (`npm run r2:test`, cache-creative API) |
| `cfk_...` S3 API (`revenuead-worker-token`) | **Workers R2 Storage Bucket Item Read** | Worker/runtime reads via S3 (`npm run r2:s3-read-test`) |
| `cfat_...` REST API | **Workers Scripts → Edit** | `npm run cloudflare:set-secrets`, deploy |

Verify any token:

```bash
CLOUDFLARE_API_TOKEN=cfat_... npm run cloudflare:verify-token
```

Token `revenuead-worker-token` (`cfk_...`) is **read-only** on `revenuead-creative-vault`. Re-copy the secret from [R2 API tokens](https://dash.cloudflare.com/7169638abf93eba4c8a9644d870c35fa/r2/api-tokens) if `SignatureDoesNotMatch` — the value is only shown once at creation.

## Environment variables

```bash
# REST — write path
CLOUDFLARE_API_TOKEN=cfat_...          # R2 Object Read & Write
CLOUDFLARE_ACCOUNT_ID=7169638abf93eba4c8a9644d870c35fa
R2_BUCKET_NAME=revenuead-creative-vault
R2_PUBLIC_URL=https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev
VITE_R2_PUBLIC_URL=https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev  # client img src

# S3 — read path (revenuead-worker-token; read-only on this bucket)
R2_ACCESS_KEY_ID=93c264ee4fcc9f1b7fd92119e0be0df1
R2_SECRET_ACCESS_KEY=cfk_...
R2_S3_ENDPOINT=https://7169638abf93eba4c8a9644d870c35fa.r2.cloudflarestorage.com
```

## API

- `POST /api/storage/cache-creative` — fetch external creative URL, store in R2, return public URL
- `npm run r2:test` — upload healthcheck object (REST `cfat_` token)
- `npm run r2:s3-read-test [key]` — read object via S3 API (`cfk_` token)

## Production secrets

```bash
export CLOUDFLARE_API_TOKEN=cfat_...
./scripts/cloudflare-set-secrets.sh
```

Local: copy `.dev.vars.example` → `.dev.vars`

## Code

- `src/lib/storage/r2Config.ts` — config + public URL helpers
- `src/lib/storage/R2StorageService.ts` — upload (REST), read (S3 via `aws4fetch`)
- `src/lib/storage/r2S3Client.ts` — S3 signing client for jurisdiction endpoint
