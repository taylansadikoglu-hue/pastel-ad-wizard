# RevenueAd Strategist OS — Build Plan

## Audit summary

All 8 required views exist and are populated:

| View | Rows | Key columns |
|---|---|---|
| brand_dna_v2 | 9 | brand, primary_category, emotion_mix, customer_stage, primary_cta, creative_volume, dominant_emotion |
| market_dna_v2 | 9 | domain, emotion_mix |
| positioning_quadrant | 9 | domain, top_product, top_emotion, top_buyer_stage, placements, x_axis, y_axis |
| competitive_pressure | 4 | category, competitors, total_creatives, avg_creatives_per_brand |
| category_ownership | 9 | category, domain, placements, share_of_voice |
| strategist_opportunities | 6 | category, emotion, market_density, strategic_priority, recommendation |
| advertiser_pipeline | 53 | domain, category, pipeline_stage |
| advertiser_coverage | 53 | domain, category, google_advertiser_id, placements, latest_placement, coverage_status |

Current state:
- `app.dashboard.tsx` renders the legacy `Dashboard` component (1157 lines, partly tracked-advertiser cards, partly nav).
- `app.pcr.tsx` (Market Intelligence) is **entirely mock data** (KPIS, GROWTH, PAID, EARNED, SOCIAL constants).
- `app.advertisers.tsx` (Brand Intelligence) is live, already on `ad_placements` + recently relabelled — only needs to add `brand_dna_v2` as the primary brand summary source.
- `app.sentiment.tsx` (Audience Signals) reads `sentiment_insights` (legacy); the rules say it should be powered by `market_dna_v2` + `category_ownership` + `strategist_opportunities`.
- No Strategic Advisor route yet.

## Build order (5 stages, each shippable on its own)

### Stage 1 — Dashboard (`app.dashboard.tsx`)
Replace the legacy `Dashboard` component with a strategist cockpit driven by live views.

Cards:
- Brands tracked → `count(distinct domain) from advertiser_coverage`
- Ads collected → `sum(placements) from advertiser_coverage`
- Coverage % → `count(*) filter coverage_status='covered' / count(*) from advertiser_coverage`
- Discovery pipeline → `advertiser_pipeline` grouped by `pipeline_stage` (mini bar)
- Latest opportunities → top 5 from `strategist_opportunities` ordered by `strategic_priority`

Hide any card whose query returns 0 rows, with a one-line "No data yet — add a tracked brand to populate" instead of silent empty.

### Stage 2 — Brand Intelligence (`app.advertisers.tsx`)
Keep existing live table. Add a top section "Brand DNA" backed by `brand_dna_v2` rendered as one card per brand showing: Primary Category, Dominant Emotion, Customer Stage, Primary CTA, Creative Volume, Emotion Mix (chip cloud), Strategic Narrative. Sort by `creative_volume desc`. Remove the existing handcrafted `BrandMetricBlocks` aggregator now that the view exists.

### Stage 3 — Market Intelligence (`app.pcr.tsx`)
**Delete all mock constants.** Rebuild as 4 cards + 1 chart:
1. Category Leaders — `category_ownership` grouped by category, top 3 domains per category by `share_of_voice` (horizontal bars).
2. Competitive Pressure — `competitive_pressure` as compact cards (competitors, total_creatives, avg/brand).
3. Share of Voice — donut per top category (recharts), sourced from `category_ownership`.
4. Positioning Map — scatter plot of `positioning_quadrant` (`x_axis`, `y_axis`, label=domain, size=placements).
5. White Space — `strategist_opportunities` where `market_density='low'`.

### Stage 4 — Audience Signals (`app.sentiment.tsx`)
Re-source from views (keep legacy `sentiment_insights` panel below as "Brand voice notes" if data exists, hide otherwise):
- Emotion Ownership — pivot `market_dna_v2.emotion_mix` per domain.
- Territory Gaps — `strategist_opportunities` filtered `strategic_priority in ('high','urgent')`.
- Messaging Saturation — `competitive_pressure.avg_creatives_per_brand` per category.
- Underused Emotions — emotions present in <2 brands across `market_dna_v2`.

### Stage 5 — Strategic Advisor (new route `app.advisor.tsx`)
New file. Sections:
- Pitch recommendations — `strategist_opportunities.recommendation` grouped by category.
- Competitive Threats — `competitive_pressure` sorted by `competitors desc`.
- White Space — `strategist_opportunities` where `market_density='low'`.
- Category Summaries — join `category_ownership` (leader) + `competitive_pressure` (intensity) per category.
Add to sidebar nav and admin picker.

## Cross-cutting

- Card-first layout (no tables unless the data is genuinely tabular).
- Recharts for all charts (already in stack).
- Every section: if query result is empty, hide it or show a single-line explanation — never a blank panel.
- All reads via `supabase.from('<view>').select(...)`; no schema, RLS, or worker changes.
- Memory saved to `mem://index.md` + `mem://product/surface-contracts.md` so future turns follow the rules automatically.

## Out of scope (per product rules)
- No schema changes, no new tables/views, no edits to ingestion pipelines or auth.
- No mock/demo metrics anywhere.

## Recommendation
Ship Stage 1 (Dashboard) first as the proof — it's the highest-traffic surface and exercises the riskiest views (`advertiser_coverage`, `advertiser_pipeline`, `strategist_opportunities`). Approve and I'll proceed stage by stage.
