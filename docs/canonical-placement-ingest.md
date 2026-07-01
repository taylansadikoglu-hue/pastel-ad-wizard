# Canonical placement ingest — worker integration

All PM2 ingest workers (`revenuad-display-source`, `revenuad-meta-source`, `revenuad-youtube-source`, SERP scripts) and `/api/ingest` should use the shared module — **not** raw `ad_placements.insert()`.

## Quick start (Seed server `/opt/revenuad`)

```javascript
// ESM worker (Node 20+)
const { ingestPlacementRow } = await import("./scripts/lib/ingestPlacement.ts");

async function persistPlacement(supabase, row) {
  const { result, skipped, reason } = await ingestPlacementRow(supabase, row);
  if (skipped) {
    console.log("[ingest] skipped:", reason);
    return "skipped";
  }
  return result; // inserted | updated | merged
}
```

Replace every:

```javascript
await supabase.from("ad_placements").insert(row);
```

## What it does

1. Normalizes `domain` and computes `canonical_fingerprint`
2. Looks up existing row by fingerprint (or legacy `creative_hash`)
3. Skips redundant secondary sources when primary already owns the channel (same fingerprint)
4. Merges enrichment fields on match; inserts only net-new creatives
5. Writes `placement_sources` receipt

**Module:** `scripts/lib/ingestPlacement.ts`  
**Example:** `scripts/engine/ingest-worker.example.ts`

## Source authority

| Channel | Primary writer | Skip redundant (same creative) |
|---------|---------------|-------------------------------|
| Meta | `adlibrary` | `apify` Meta scrape |
| TikTok, LinkedIn | `adlibrary` | — |
| YouTube video | `adlibrary` | `dataforseo` if same creative |
| Google Search, Display | `dataforseo` | — |

**Ops:** Keep `pm2 stop revenuad-meta-source` while AdLibrary covers Meta — don't rely on ingest skip alone for brand-new Apify rows.

## Row mapping by source

### DataForSEO

```javascript
incomingRow.source_platform = "dataforseo";
incomingRow.raw = {
  ...incomingRow.raw,
  serp_creative_id: serpResult.id,
};
await ingestPlacementRow(supabase, incomingRow);
```

### Apify (Meta)

```javascript
incomingRow.source_platform = "apify";
incomingRow.raw = {
  ...incomingRow.raw,
  library_id: metaAd.adArchiveId,
  ad_archive_id: metaAd.adArchiveId,
};
await ingestPlacementRow(supabase, incomingRow);
```

### AdLibrary

Already wired via `scripts/lib/adlibraryPlacementUpsert.ts` → `ingestPlacementRow`.

## After deploy on Seed

```bash
cd /opt/revenuad
git pull origin main
pm2 restart revenuad-display-source revenuad-youtube-source --update-env
# meta-source should stay stopped if AdLibrary owns Meta
```

## Fix fingerprint collisions (CommBank stragglers)

```bash
npm run data-quality:resolve-collisions -- --domain commbank.com.au
npm run data-quality:audit -- --domain commbank.com.au
```

## Pre-beta smoke test

```bash
npm run beta:smoke-test
```
