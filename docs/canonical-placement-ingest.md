# Canonical placement ingest — worker integration

Use this in `/api/ingest` and PM2 source processes (`revenuad-display-source`, `revenuad-meta-source`, etc.).

## Before you insert

```javascript
// Copy logic from scripts/lib/canonicalPlacementUpsert.ts
// Or import if worker shares this repo:

import {
  computeCanonicalFingerprint,
  shouldSkipRedundantSource,
  resolveChannelBucket,
} from './placementFingerprint.js';
import { upsertCanonicalPlacement } from './canonicalPlacementUpsert.js';
```

## Per incoming ad row

```javascript
async function ingestPlacement(supabase, incomingRow) {
  const channel = resolveChannelBucket({
    domain: incomingRow.domain,
    channelPlatform: incomingRow.channel_platform,
  });

  // Skip redundant Meta from Apify when AdLibrary already owns this channel
  if (incomingRow.source_platform === 'apify' && channel === 'Meta') {
  const { data: existing } = await supabase
    .from('placement_sources')
    .select('source_platform')
    .eq('source_platform', 'adlibrary')
    .limit(1);
  // Better: lookup by domain + fingerprint first, then check sources
  }

  incomingRow.canonical_fingerprint = computeCanonicalFingerprint({
    domain: incomingRow.domain,
    channelPlatform: incomingRow.channel_platform,
    channel: incomingRow.channel,
    sourcePlatform: incomingRow.source_platform,
    adKey: incomingRow.raw?.ad_key,
    archiveId: incomingRow.raw?.library_id ?? incomingRow.raw?.ad_archive_id,
    sourceArchiveUrl: incomingRow.source_archive_url,
    mediaUrl: incomingRow.media_url,
    creativeUrl: incomingRow.creative_url,
    landingUrl: incomingRow.landing_url,
    headline: incomingRow.headline ?? incomingRow.ad_title,
    rawCopy: incomingRow.raw_copy,
    raw: incomingRow.raw,
  });

  const result = await upsertCanonicalPlacement(supabase, incomingRow, false);
  // result: 'inserted' | 'updated' | 'merged' | 'skipped'
  return result;
}
```

## Source authority (stop double-pulling)

| Channel | Primary writer | Skip redundant |
|---------|---------------|----------------|
| Meta | `adlibrary` | `apify` Meta scrape |
| TikTok, LinkedIn | `adlibrary` | — |
| YouTube video | `adlibrary` | DataForSEO if same creative |
| Google Search, Display | `dataforseo` | — |

**Recommendation:** Pause `revenuad-meta-source` while AdLibrary ingest runs for the same advertisers.

## DataForSEO row mapping

```javascript
incomingRow.source_platform = 'dataforseo';
incomingRow.raw = {
  ...incomingRow.raw,
  serp_creative_id: serpResult.id,  // use as archiveId in fingerprint
};
```

## Apify row mapping

```javascript
incomingRow.source_platform = 'apify';
incomingRow.raw = {
  ...incomingRow.raw,
  library_id: metaAd.adArchiveId,
  ad_archive_id: metaAd.adArchiveId,
};
```

## After migration

Run backfill for existing rows:

```bash
npx tsx scripts/backfill-canonical-fingerprints.ts --limit 5000
```

## Verify dedup

```bash
npm run data-quality:audit -- --domain commbank.com.au
```

Look for `duplicate_groups: 0` and `canonical_coverage_pct` near 100%.
