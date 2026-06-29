import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import type { ChannelMixResult } from "@/lib/channelMix";
import type { StrategistIntelBundle } from "@/lib/api-gateway";
import type { MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import type { EvidenceContext } from "./evidence-frame";

export type WorkspaceScope = {
  client_name: string;
  client_domain: string;
  competitor_domains: string[];
  category: string;
} | null;

export type BriefSnapshot = {
  client_name: string | null;
  category: string | null;
  headline: string | null;
  strongest_threat: string | null;
} | null;

export type ConfidenceSnapshot = {
  ads_analysed: number | null;
  brands_tracked: number | null;
} | null;

export type HardDataContext = {
  threats: { competitor_domain: string | null; creative_volume: number | null; demand: number | null; threat_score: number | null }[];
  challengers: { brand_domain: string | null; keyword: string | null; creative_volume: number | null; latest_interest: number | null; momentum: string | null; pressure: string | null }[];
  whitespace: { category: string | null; emotion: string | null; opportunity_score: number | null; recommendation: string | null }[];
  momentum: { brand_domain: string | null; keyword: string | null; latest_interest: number | null; creative_volume: number | null; momentum: string | null }[];
  exec: { strongest_brand: string | null; dominant_market: string | null } | null;
  pitch: { action: string | null; recommendation: string | null; category_leader: string | null }[];
  marketIntel: MarketStrategistIntel | null;
  channelMix: ChannelMixResult | null;
  adlibraryCoverage: AdlibraryCoverage | null;
  confidence: ConfidenceSnapshot;
  brief: BriefSnapshot;
  workspace: WorkspaceScope;
  recommendedMoves: string[];
  intelBundle: StrategistIntelBundle | null;
};

function scopedBrands(ctx: HardDataContext): string[] {
  if (!ctx.workspace) return [];
  return [ctx.workspace.client_name, ...ctx.workspace.competitor_domains];
}

function bundleTs(ctx: HardDataContext, key: keyof StrategistIntelBundle): string | null {
  const res = ctx.intelBundle?.[key];
  if (!res || !("metadata" in res)) return null;
  return res.metadata?.timestamp ?? null;
}

function dateRangeLabel(ctx: HardDataContext): string {
  const brief = ctx.intelBundle?.brief.data as Record<string, unknown> | null;
  const days = brief?.days ?? (ctx.intelBundle as { query?: { days?: number } } | null)?.query?.days;
  if (typeof days === "number" && days > 0) return `Last ${days} days`;
  return "Last 30 days";
}

function classifyBundleConfidence(rowCount: number, adsAnalysed: number | null): string {
  if (rowCount >= 5 && (adsAnalysed ?? 0) >= 20) return "High";
  if (rowCount >= 1) return "Medium";
  return "Low";
}

function classifyRaConfidence(rowCount: number): string {
  if (rowCount >= 5) return "High";
  if (rowCount >= 1) return "Medium";
  return "Low";
}

function totalCreatives(ctx: HardDataContext): number {
  return ctx.threats.reduce((s, t) => s + (Number(t.creative_volume) || 0), 0);
}

export function buildCompetitorsEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = [...ctx.threats].sort(
    (a, b) => (Number(b.creative_volume) || Number(b.demand) || 0) - (Number(a.creative_volume) || Number(a.demand) || 0),
  );
  const leader = rowLabel ?? ctx.exec?.strongest_brand ?? rows[0]?.competitor_domain ?? "Category leader";
  const leaderRow = rows.find((r) => r.competitor_domain && leader.toLowerCase().includes(String(r.competitor_domain).split(".")[0]));
  const leaderCreatives = Number(leaderRow?.creative_volume) || 0;

  return {
    claim: `${leader} is leading observed category activity by creative volume and demand.`,
    confidence: classifyBundleConfidence(rows.length, ctx.confidence?.ads_analysed ?? null),
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      leaderCreatives > 0 ? `${leaderCreatives} active creatives observed for ${leader}` : `${totalCreatives(ctx)} creatives tracked in category`,
      `${ctx.confidence?.brands_tracked ?? rows.length} brands in watchlist`,
      dateRangeLabel(ctx),
    ],
    whySupports: "Leader rank uses the highest combined creative activity and demand among tracked competitors.",
    methodology:
      "We rank competitors by observed creative volume and demand signals, then surface the loudest brand in your watchlist.",
    creativeCount: leaderCreatives || totalCreatives(ctx),
    brandCount: ctx.confidence?.brands_tracked ?? rows.length,
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "threats"),
    brands: rows.map((r) => r.competitor_domain).filter(Boolean) as string[],
  };
}

export function buildThreatsEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.risks ?? [];
  const bundleThreat = ctx.threats.find((t) =>
    rowLabel ? t.competitor_domain?.toLowerCase().includes(rowLabel.toLowerCase().split(".")[0] ?? "") : false,
  );
  const focus = rowLabel ?? rows[0]?.competitorDomain ?? ctx.brief?.strongest_threat ?? "Top threat";
  const creatives = Number(bundleThreat?.creative_volume) || rows[0]?.threatScore || 0;
  const narrative = rows.find((r) => r.competitorDomain.toLowerCase().includes(focus.toLowerCase().split(".")[0] ?? ""))?.narrative;

  return {
    claim: `${focus} is the biggest threat in your watchlist right now.`,
    confidence: classifyRaConfidence(rows.length || (bundleThreat ? 1 : 0)),
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      creatives ? `${creatives} active creatives observed` : "Observed creative pressure in category",
      narrative ? `Repeated ${narrative.slice(0, 80)}${narrative.length > 80 ? "…" : ""}` : "Rising competitive pressure in tracked messaging",
      dateRangeLabel(ctx),
    ],
    whySupports: "Threat calls combine creative volume, risk scoring, and repeated messaging patterns for the brand.",
    methodology:
      "We flag threats when a competitor shows high creative volume, elevated risk score, and sustained message pressure against your client.",
    creativeCount: Number(bundleThreat?.creative_volume) || undefined,
    brandCount: scopedBrands(ctx).length,
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "threats"),
    brands: rows.map((r) => r.competitorDomain),
  };
}

export function buildTerritoriesEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.territories ?? [];
  const focus = rowLabel ?? rows[0]?.emotion ?? "Territory";

  return {
    claim: `“${focus}” is a crowded or open message space in this category.`,
    confidence: classifyRaConfidence(rows.length),
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      `${rows.length} emotional territories mapped`,
      rows[0] ? `${rows[0].brandsUsing} brands using top territory` : "Category messaging scan",
      dateRangeLabel(ctx),
    ],
    whySupports: "Territory status reflects how many rivals use each emotional angle and average share held.",
    methodology: "We map which emotions competitors repeat and label territories as open or crowded.",
    rowCount: rows.length,
    brands: scopedBrands(ctx),
  };
}

export function buildChannelMixEvidence(ctx: HardDataContext): EvidenceContext {
  const mix = ctx.channelMix;
  const rows = mix?.rows ?? [];
  const active = rows.filter((r) => r.pct > 0 || r.ads > 0);
  const top = active[0];

  return {
    claim: "Channel activity shows where competitors are investing media weight.",
    confidence: mix?.overallConfidence ?? "Low",
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      top ? `${top.channel} leads at ${top.pct.toFixed(0)}% of observed activity` : "Channel mix from indexed creatives",
      `${active.reduce((s, r) => s + r.ads, 0)} channel-tagged placements`,
      dateRangeLabel(ctx),
    ],
    whySupports: mix?.estimationTooltip ?? "Channel share explains where category ads are appearing.",
    methodology: "We attribute indexed creatives to channels and calculate share of observed activity per platform.",
    rowCount: active.length,
    brands: scopedBrands(ctx),
  };
}

export function buildPitchEvidence(ctx: HardDataContext): EvidenceContext {
  const moves = ctx.recommendedMoves;

  return {
    claim: moves[0] ?? "Recommended client action for this category.",
    confidence: classifyBundleConfidence(moves.length, ctx.confidence?.ads_analysed ?? null),
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      moves.length ? `${moves.length} strategic moves ranked` : "Executive read for category",
      `${ctx.confidence?.ads_analysed ?? "—"} ads analysed`,
      dateRangeLabel(ctx),
    ],
    whySupports: "Moves combine executive recommendations, whitespace opportunities, and observed competitive gaps.",
    methodology: "We de-duplicate strategist recommendations and rank by category urgency for your workspace.",
    rowCount: moves.length,
    brands: scopedBrands(ctx),
  };
}

export function buildStrategicActionsEvidence(ctx: HardDataContext): EvidenceContext {
  const rows = ctx.marketIntel?.strategicActions ?? [];

  return {
    claim: rows[0]?.action ?? "Priority strategic action for this category.",
    confidence: classifyRaConfidence(rows.length),
    dateRange: dateRangeLabel(ctx),
    basedOn: [`${rows.length} priority actions`, dateRangeLabel(ctx)],
    whySupports: "Each action is a prioritised move based on category intelligence for your client.",
    methodology: "Actions are ordered by strategist priority for the active workspace category.",
    rowCount: rows.length,
    brands: scopedBrands(ctx),
  };
}

export function buildPositioningEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.positioningMap ?? [];
  const focus = rowLabel ?? rows[0]?.brand ?? "Brand";

  return {
    claim: `${focus} positioning on share of voice vs creative intensity.`,
    confidence: classifyRaConfidence(rows.length),
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      `${rows.length} brands on positioning map`,
      dateRangeLabel(ctx),
    ],
    whySupports: "Share of voice and placement counts show relative voice; intensity axes show creative pressure.",
    methodology: "We plot share of voice and placement volume to show who owns the category conversation.",
    rowCount: rows.length,
    brands: rows.map((r) => r.brand),
  };
}

export function buildAdlibraryEvidence(ctx: HardDataContext): EvidenceContext {
  const cov = ctx.adlibraryCoverage;
  const rowCount = cov ? cov.advertisersTracked + cov.adsIndexed : 0;
  const pipelineReady = Boolean(cov?.available && !cov?.hasData);

  return {
    claim: pipelineReady
      ? "Observed creative activity pipeline is ready — proof will populate after the next index run."
      : "Observed creative activity indexed for your watchlist.",
    confidence: cov?.hasData ? "Medium" : pipelineReady ? "Medium" : "Low",
    dateRange: cov?.lastRunAt ? `Indexed through ${cov.lastRunAt.slice(0, 10)}` : dateRangeLabel(ctx),
    basedOn: pipelineReady
      ? [
          "Index pipeline configured for your category",
          "Awaiting credits to pull and enrich creatives",
          dateRangeLabel(ctx),
        ]
      : [
          `${cov?.adsIndexed ?? 0} creatives indexed`,
          `${cov?.advertisersTracked ?? 0} advertisers tracked`,
        ],
    whySupports: pipelineReady
      ? "The pipeline is wired and will surface proof cards automatically once indexing runs."
      : "Coverage counts show how much creative proof is available for evidence drawers.",
    methodology:
      "We index public ad library creatives and enrich them with messaging tags for proof cards in evidence drawers.",
    creativeCount: cov?.adsIndexed,
    rowCount,
    brands: scopedBrands(ctx),
  };
}

export function buildExecutiveEvidence(ctx: HardDataContext): EvidenceContext {
  const exec = ctx.marketIntel?.executivePack;

  return {
    claim: ctx.brief?.headline ?? exec?.headline ?? "Category executive summary for the active workspace.",
    confidence: exec ? "Medium" : "Low",
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      `${ctx.confidence?.ads_analysed ?? "—"} ads analysed`,
      `${ctx.confidence?.brands_tracked ?? "—"} brands tracked`,
      dateRangeLabel(ctx),
    ],
    whySupports: "Executive read is grounded in the same bundle metrics and creative index shown in Market Intel.",
    methodology: "We synthesise category headlines from observed creative activity and strategist reads.",
    rowCount: exec ? 1 : 0,
    brands: scopedBrands(ctx),
  };
}

export function buildEvidencePackEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.evidencePack ?? [];
  const exec = ctx.marketIntel?.executivePack;
  const focus = rowLabel ?? rows[0]?.competitorDomain ?? "Evidence row";

  return {
    claim: exec?.headline ?? `Quantified threat evidence for ${focus}.`,
    confidence: classifyRaConfidence(rows.length),
    dateRange: dateRangeLabel(ctx),
    basedOn: [
      `${rows.length} scored threat rows`,
      dateRangeLabel(ctx),
    ],
    whySupports: "Evidence rows tie threat scores to creative volume and demand with analyst context.",
    methodology: "Threat evidence is ranked by score and filtered to your workspace watchlist.",
    rowCount: rows.length,
    brands: rows.map((r) => r.competitorDomain),
  };
}

export function resolveFocusDomain(
  ctx: HardDataContext,
  moduleId: string,
  rowLabel?: string,
  rowIndex?: number,
): string | null {
  if (rowLabel?.includes(".")) return rowLabel;
  if (rowLabel) {
    const match = ctx.workspace?.competitor_domains.find((d) =>
      d.toLowerCase().includes(rowLabel.toLowerCase().split(" ")[0] ?? ""),
    );
    if (match) return match;
  }

  if (moduleId === "threats" || moduleId === "competitors") {
    const rows = moduleId === "threats" ? ctx.marketIntel?.risks ?? [] : ctx.threats;
    if (rowIndex != null && moduleId === "competitors") {
      const sorted = [...ctx.threats].sort(
        (a, b) => (Number(b.creative_volume) || 0) - (Number(a.creative_volume) || 0),
      );
      return sorted[rowIndex]?.competitor_domain ?? null;
    }
    if (rowIndex != null && moduleId === "threats") {
      return ctx.marketIntel?.risks[rowIndex]?.competitorDomain ?? null;
    }
    return (
      rowLabel ??
      ctx.brief?.strongest_threat ??
      ctx.threats[0]?.competitor_domain ??
      ctx.workspace?.competitor_domains[0] ??
      null
    );
  }

  if (moduleId === "changes" && rowIndex != null) {
    return ctx.marketIntel?.dailyChanges[rowIndex]?.brandDomain ?? null;
  }

  return ctx.workspace?.client_domain ?? ctx.workspace?.competitor_domains[0] ?? null;
}
