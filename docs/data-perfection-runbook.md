# Data perfection runbook

One command to get CommBank + Woolworths demo-ready. Run on **Seed server** where real secrets live.

## Prerequisites

| Secret | Where |
|--------|--------|
| `ADLIBRARY_API_KEY` | AdLibrary.com dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (JWT or `sb_secret_…`, **not** `sb_publishable_…`) |
| `SUPABASE_URL` | Same Supabase project (`exnngwyhogwltpbjcmyl`) |

```bash
ssh seed@37.27.0.36
cd /opt/revenuad
git pull origin main
```

## Full pipeline

```bash
npm run data:perfection
```

Phases:

1. **Ingest** — AdLibrary backfill for CommBank + Woolworths (`demo:ingest-showcase`)
2. **Collisions** — merge fingerprint orphans, backfill `canonical_fingerprint`
3. **Dupes** — fold duplicate raw rows
4. **Sanitize** — null `Unknown`/`Other`/generic CTA junk tags
5. **Audit** — 7-pass Data Quality Guardian per domain
6. **Smoke** — `beta:smoke-test` against live revenuad.com + api.revenuad.com

Audit-only (CI / read-only env):

```bash
npm run data:perfection -- --audit-only
```

Single brand:

```bash
npm run data:perfection -- --domain woolworths.com.au
```

## Current known gaps (CommBank)

From normalized view audit (9 deduped creatives):

| Issue | Fix |
|-------|-----|
| 3 rows missing `canonical_fingerprint` | `npm run data-quality:resolve-collisions -- --domain commbank.com.au` |
| Pass 5: `Unknown`/`Other` tags, generic CTAs | `npm run data-quality:sanitize-tags -- --domain commbank.com.au` then re-enrich |
| Pass 6: meta-commentary in strategist fields | `npm run adlibrary:enrich -- --advertiser CommBank --limit 20` |

## Woolworths (0 placements)

```bash
npm run demo:ingest-showcase -- --domain woolworths.com.au --backfill
npm run data-quality:audit -- --domain woolworths.com.au
```

Target: ≥5 deduped normalized rows before beta invites.

## Prevent dupes returning

Wire `ingestPlacementRow` in PM2 workers on Seed (see `docs/canonical-placement-ingest.md`):

```bash
pm2 restart revenuad-display-source revenuad-youtube-source --update-env
```

## After data is green

1. Merge dashboard trust PR if not on `main`
2. **Publish in Lovable** (revenuad.com UI — not Cloudflare Workers GitHub connect)
3. `npm run beta:smoke-test` — all green
4. Send `docs/beta-media-intro.md` to testers

## Cloud agent limitation

Cursor cloud VMs often have `SUPABASE_SERVICE_ROLE_KEY=sb_publishable_…` which can **read** `normalized_ad_placements` but cannot **write** `ad_placements`. Ingest and sanitize must run on Seed.
