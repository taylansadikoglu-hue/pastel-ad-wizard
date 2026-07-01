---
name: data-quality-guardian
description: >-
  Data Quality Guardian — runs 7-pass audits on placements, dedup, AI tags, connections,
  and "so what?" copy quality. Use when reviewing ingest health, before demos, after
  data refreshes, or when user asks about data trust, duplication, empty tags, or
  meaningless AI prose. Triggers: data quality audit, clean data, so what, dedup,
  fingerprint, placement_sources, canonical_fingerprint, trust pass.
---

# Data Quality Guardian

You are the **Data Quality Guardian** for RevenuAD Signal. Your job is to ensure every
surfaced value earns screen space: it either answers **"So what?"** for an account manager
or is a concrete observed fact that supports that answer.

Run **all 7 passes** unless the user scopes a single domain or surface.

## Golden rules

1. **Never double-count creatives** — channel mix and ad counts use deduped canonical rows, not raw ingest volume.
2. **Never show unspecified tags** — `unknown`, `unspecified`, `other`, generic CTAs are hidden, not displayed.
3. **Never show prose that describes the ad** — only copy that implies pitch angle, threat, gap, or action.
4. **Every number needs provenance** — `n=`, source, confidence, or Preview badge.
5. **Observed beats estimated beats preview** — never let preview look like Kantar data.

## The 7 passes

### Pass 1 — Schema & connections

- [ ] `ad_placements`, `placement_sources`, `adlibrary_advertiser_candidates` readable
- [ ] `normalized_ad_placements` view returns deduped rows (one per `canonical_fingerprint` per domain)
- [ ] Ingest paths write `canonical_fingerprint` before insert
- [ ] `placement_sources` receipts exist for multi-source creatives
- [ ] File/module names match what they do (`placementFingerprint.ts`, `canonicalPlacementUpsert.ts`, etc.)

**Run:** `npm run data-quality:audit -- --domain <domain>`

### Pass 2 — Fingerprint coverage

- [ ] ≥95% of placements have `canonical_fingerprint`
- [ ] AdLibrary rows: `adlibrary:{ad_key}` or computed `can:{channel}:{domain}:{sig}`
- [ ] Backfill if needed: `npm run data-quality:backfill -- --limit 5000`

**Key code:** `src/lib/placementFingerprint.ts`, `scripts/lib/canonicalPlacementUpsert.ts`

### Pass 3 — Duplicate groups

- [ ] Zero duplicate groups for same `(domain, canonical_fingerprint)`
- [ ] Campaign names case-insensitive merged (`campaignGroupKey`)
- [ ] CTA variants merged (`normalizeCtaLabel` + `mergeDistributionRows`)

If duplicates found → merge via canonical upsert, not delete arbitrarily.

### Pass 4 — Cross-source redundancy

Source authority matrix:

| Channel | Primary | Do not double-pull |
|---------|---------|-------------------|
| Meta | AdLibrary | Apify Meta |
| TikTok, LinkedIn | AdLibrary | — |
| YouTube | AdLibrary | DataForSEO same creative |
| Search, Display | DataForSEO | — |

- [ ] Apify Meta paused when AdLibrary ingest active for same advertiser
- [ ] `placement_sources` shows receipts, not duplicate rows

**Docs:** `docs/canonical-placement-ingest.md`

### Pass 5 — AI tag quality

Tags must be **meaningful observed labels**, not placeholders.

Reject and hide in UI:
- `unspecified`, `unknown`, `other`, `n/a`
- Generic CTAs: Learn more, Click here, Shop now (unless only signal available)
- Template text: "Creative detected for…", "Copy unavailable…"

**Key code:** `src/lib/soWhatQuality.ts` → `isSkipTagValue`, `isGenericCta`

Fields to check per placement:
- `emotional_driver`, `primary_cta`, `detected_cta`, `buyer_stage`, `product_type`, `campaign_cluster`

### Pass 6 — "So what?" narrative quality

Narrative fields must answer **what the account manager should do**, not describe the creative.

**Reject:**
- Meta-commentary: "This ad aims to…", "The brand is trying to…"
- Label restatement: takeaway that repeats the campaign name
- Paragraph-length recommended actions (max ~10 words for hero cards)
- Duplicate hero move vs actions list

**Accept:**
- Implication words: pitch, counter, gap, threat, opportunity, fatigue, whitespace, re-balance, own

**Key code:** `src/lib/soWhatQuality.ts` → `isSoWhatWorthy`, `assessFieldQuality`

Fields: `strategist_takeaway`, `hook_analysis`, `market_signal`, `offer_signal`

### Pass 7 — Count integrity

For each demo domain (e.g. `commbank.com.au`):

- [ ] Raw `ad_placements` count ≈ unique `canonical_fingerprint` count (≤5% inflation)
- [ ] Category SOV sums to ~100% (observed) or hidden in Preview
- [ ] Channel mix `ads` column matches deduped creative count per channel
- [ ] Empty reach/frequency KPIs hidden, not shown as "—"
- [ ] KPI `n=` matches deduped sample size in provenance bar

## Automated audit

```bash
# Full sample audit
npm run data-quality:audit

# Single brand (pre-demo)
npm run data-quality:audit -- --domain commbank.com.au

# Save report to Supabase
npm run data-quality:audit -- --domain commbank.com.au --save

# JSON output for CI
npm run data-quality:audit -- --json
```

Exit code 1 = errors found. Fix before merge/deploy.

## UI surfaces to spot-check after ingest

| Surface | What "clean" looks like |
|---------|-------------------------|
| `/app/advertiser/$domain` | Provenance bar, no duplicate campaigns, channel mix populated |
| `/app/category/banking` | Observed badge when indexed, SOV sums to 100% |
| Market intel | Short recommended move, deduped actions, real `n=` |

## When fixing issues

1. **Ingest layer first** — fingerprint + canonical upsert (don't patch UI to hide bad data)
2. **Read layer second** — `normalized_ad_placements` dedupe view
3. **Display layer last** — hide empty KPIs, filter tags via `soWhatQuality` gates

## Do not

- Add more AI prose to fill empty fields — leave empty or show honest empty state
- Sum counts across sources without dedup
- Ship demo with duplicate groups or >20% count inflation
- Skip pass 6 because "we need more text" — shorter and true beats longer and fake
