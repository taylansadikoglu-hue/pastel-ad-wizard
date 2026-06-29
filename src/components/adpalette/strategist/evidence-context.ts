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
  return [ctx.workspace.client_name, ...ctx.workspace.competitor_domains.map((d) => d.replace(/^www\./, ""))];
}

function bundleTs(ctx: HardDataContext, key: keyof StrategistIntelBundle): string | null {
  const res = ctx.intelBundle?.[key];
  if (!res || !("metadata" in res)) return null;
  return res.metadata?.timestamp ?? null;
}

function bundleSource(ctx: HardDataContext, key: keyof StrategistIntelBundle): string | null {
  const res = ctx.intelBundle?.[key];
  if (!res || !("metadata" in res)) return null;
  return res.metadata?.source ?? null;
}

function dateRangeLabel(ctx: HardDataContext): string {
  const brief = ctx.intelBundle?.brief.data as Record<string, unknown> | null;
  const days = brief?.days ?? (ctx.intelBundle as { query?: { days?: number } } | null)?.query?.days;
  if (typeof days === "number" && days > 0) return `Last ${days} days`;
  return "Last 30 days (engine default)";
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

export function buildCompetitorsEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = [...ctx.threats].sort(
    (a, b) => (Number(b.creative_volume) || Number(b.demand) || 0) - (Number(a.creative_volume) || Number(a.demand) || 0),
  );
  const leader = rowLabel ?? ctx.exec?.strongest_brand ?? rows[0]?.competitor_domain ?? "Category leader";
  const missing: string[] = [];
  if (!rows.length) missing.push("modules.competitors array empty in GET /api/strategist/bundle response");
  if (!ctx.exec?.strongest_brand) missing.push("modules.executive.strongest_brand not set in strategist bundle");

  return {
    claim: `${leader} is leading observed category activity by creative volume and demand signals.`,
    sourceTable: "engine strategist bundle · modules.competitors",
    sourceApi: bundleSource(ctx, "threats") ?? "GET /api/strategist/bundle",
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "threats") ?? bundleTs(ctx, "executive"),
    dateRange: dateRangeLabel(ctx),
    brands: rows.map((r) => r.competitor_domain).filter(Boolean) as string[],
    confidence: classifyBundleConfidence(rows.length, ctx.confidence?.ads_analysed ?? null),
    whySupports:
      "Leader rank uses the highest combined creative_volume and demand among competitor rows returned for the active workspace category.",
    calculation:
      "Sort competitors by max(creative_volume, demand) descending. The top row is surfaced as market leader; executive.strongest_brand provides the headline label when present.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildThreatsEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.risks ?? [];
  const focus = rowLabel ?? rows[0]?.competitorDomain ?? "Top threat";
  const missing: string[] = [];
  if (!ctx.marketIntel?.available) missing.push("ra_strategic_risks view unavailable or returned no rows");
  if (!rows.length) missing.push("No threat narratives in ra_strategic_risks for workspace-scoped brands");

  return {
    claim: `${focus} is flagged on the threat radar with a scored risk narrative.`,
    sourceTable: "ra_strategic_risks",
    sourceApi: "Supabase read (ra_strategic_risks)",
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "threats"),
    dateRange: dateRangeLabel(ctx),
    brands: rows.map((r) => r.competitorDomain),
    confidence: classifyRaConfidence(rows.length),
    whySupports:
      "Each row combines threat_score, risk_level, and GPT narrative stored against competitor_domain for the category.",
    calculation:
      "Rows ordered by threat_score descending (limit 8), then filtered to client workspace + competitor_domains.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildTerritoriesEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.territories ?? [];
  const focus = rowLabel ?? rows[0]?.emotion ?? "Territory";
  const missing: string[] = [];
  if (!rows.length) missing.push("ra_strategic_territories view returned 0 rows for this category");

  return {
    claim: `Emotional territory “${focus}” shows how crowded or open this message space is.`,
    sourceTable: "ra_strategic_territories",
    sourceApi: "Supabase read (ra_strategic_territories)",
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "brief"),
    dateRange: dateRangeLabel(ctx),
    brands: scopedBrands(ctx),
    confidence: classifyRaConfidence(rows.length),
    whySupports:
      "Territory status (open vs crowded) is derived from brands_using and avg_share per emotion in the strategist intelligence layer.",
    calculation:
      "avg_share and brands_using aggregated per emotion; territory_status labels whether the angle is open or competitive.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildChannelMixEvidence(ctx: HardDataContext): EvidenceContext {
  const mix = ctx.channelMix;
  const rows = mix?.rows ?? [];
  const active = rows.filter((r) => r.pct > 0 || r.ads > 0);
  const missing: string[] = [];
  if (!mix) missing.push("Channel mix not computed — strategist bundle brief.channels missing");
  if (mix?.source === "baseline") missing.push("No channel attribution in bundle; showing category baseline split");

  return {
    claim: "Channel share shows where category ad activity is appearing across platforms.",
    sourceTable: mix?.source === "warroom" ? "strategist bundle brief.channels" : mix?.sourceLabel ?? "channel mix",
    sourceApi: bundleSource(ctx, "brief") ?? "GET /api/strategist/bundle · brief.channels",
    rowCount: active.length,
    lastUpdated: bundleTs(ctx, "brief"),
    dateRange: dateRangeLabel(ctx),
    brands: scopedBrands(ctx),
    confidence: mix?.overallConfidence ?? "Low",
    whySupports: mix?.estimationTooltip ?? "Channel percentages explain the bar chart in the main Market Intel view.",
    calculation:
      mix?.source === "placements"
        ? "Percentage = channel ad count ÷ total indexed placements with channel_platform."
        : mix?.source === "warroom"
          ? "Percentage taken directly from engine bundle channel split fields."
          : mix?.source === "estimated"
            ? "Inferred from ad_type / row signals when channel_platform is missing."
            : "Even baseline split until channel-tagged placements are available.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildPitchEvidence(ctx: HardDataContext): EvidenceContext {
  const moves = ctx.recommendedMoves;
  const pitchRows = ctx.pitch;
  const missing: string[] = [];
  if (!moves.length && !pitchRows.length) {
    missing.push("modules.pitch empty in strategist bundle");
    missing.push("ra_executive_pack.recommended_action not available");
  }

  return {
    claim: moves[0] ?? pitchRows[0]?.action ?? pitchRows[0]?.recommendation ?? "Recommended client action for this category.",
    sourceTable: "modules.pitch · ra_executive_pack · ra_strategic_actions",
    sourceApi: bundleSource(ctx, "pitch") ?? "GET /api/strategist/bundle",
    rowCount: moves.length + pitchRows.length,
    lastUpdated: bundleTs(ctx, "pitch") ?? bundleTs(ctx, "brief"),
    dateRange: dateRangeLabel(ctx),
    brands: scopedBrands(ctx),
    confidence: classifyBundleConfidence(pitchRows.length, ctx.confidence?.ads_analysed ?? null),
    whySupports:
      "Recommended moves combine pitch brief actions, executive recommended_action, and strategist GPT actions for the workspace.",
    calculation:
      "De-duplicated list: executivePack.recommendedAction → strategicActions → pitch module rows → client-name heuristic moves.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildStrategicActionsEvidence(ctx: HardDataContext): EvidenceContext {
  const rows = ctx.marketIntel?.strategicActions ?? [];
  const missing: string[] = [];
  if (!rows.length) missing.push("ra_strategic_actions returned 0 rows");

  return {
    claim: rows[0]?.action ?? "Priority strategic action for this category.",
    sourceTable: "ra_strategic_actions",
    sourceApi: "Supabase read (ra_strategic_actions)",
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "brief"),
    dateRange: dateRangeLabel(ctx),
    brands: scopedBrands(ctx),
    confidence: classifyRaConfidence(rows.length),
    whySupports: "Each action is a GPT-prioritised move stored with priority order for the category strategist layer.",
    calculation: "Rows ordered by priority ascending from ra_strategic_actions.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildPositioningEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.positioningMap ?? [];
  const focus = rowLabel ?? rows[0]?.brand ?? "Brand";
  const missing: string[] = [];
  if (!rows.length) missing.push("ra_market_intelligence view returned 0 positioning rows");

  return {
    claim: `${focus} positioning on share of voice vs creative intensity in the category map.`,
    sourceTable: "ra_market_intelligence",
    sourceApi: "Supabase read (ra_market_intelligence)",
    rowCount: rows.length,
    lastUpdated: bundleTs(ctx, "brief"),
    dateRange: dateRangeLabel(ctx),
    brands: rows.map((r) => r.brand),
    confidence: classifyRaConfidence(rows.length),
    whySupports:
      "SOV % and placement counts show relative voice; x/y axes encode creative intensity vs reach for each brand.",
    calculation:
      "share_of_voice and placements per brand from ra_market_intelligence, limited to 12 rows for the drawer.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildAdlibraryEvidence(ctx: HardDataContext): EvidenceContext {
  const cov = ctx.adlibraryCoverage;
  const missing: string[] = [];
  if (!cov?.available) {
    missing.push("adlibrary_pipeline_runs table missing or unreachable");
    missing.push("adlibrary_advertiser_candidates table missing or unreachable");
    missing.push("adlibrary_enrichments table missing or unreachable");
  }
  if (cov && !cov.hasData) {
    missing.push("No AdLibrary rows indexed yet — run adlibrary ingest pipeline");
  }

  const rowCount = cov
    ? cov.advertisersTracked + cov.adsIndexed + cov.enrichedAds
    : 0;

  return {
    claim: "AdLibrary coverage shows how many advertisers and creatives are indexed from the optional AdLibrary pipeline.",
    sourceTable: "adlibrary_advertiser_candidates · ad_placements · adlibrary_enrichments · adlibrary_pipeline_runs",
    sourceApi: "Supabase read (optional AdLibrary tables)",
    rowCount,
    lastUpdated: cov?.lastRunAt ?? null,
    dateRange: cov?.lastRunAt ? `Pipeline run ending ${cov.lastRunAt}` : "No pipeline run recorded",
    brands: scopedBrands(ctx),
    confidence: cov?.hasData ? "Medium" : "Low",
    whySupports:
      "Counts reflect advertiser candidates tracked, adlibrary-tagged placements, and enrichment rows — not engine warroom data.",
    calculation:
      "advertisersTracked = count(adlibrary_advertiser_candidates); adsIndexed = count(ad_placements where source_platform=adlibrary); enrichedAds = count(adlibrary_enrichments).",
    missing: missing.length ? missing : undefined,
  };
}

export function buildExecutiveEvidence(ctx: HardDataContext): EvidenceContext {
  const exec = ctx.marketIntel?.executivePack;
  const missing: string[] = [];
  if (!exec) missing.push("ra_executive_pack returned no row");

  return {
    claim: ctx.brief?.headline ?? exec?.headline ?? "Category executive summary for the active workspace.",
    sourceTable: "ra_executive_pack · modules.executive",
    sourceApi: `${bundleSource(ctx, "brief") ?? "GET /api/strategist/bundle"} · Supabase ra_executive_pack`,
    rowCount: exec ? 1 : 0,
    lastUpdated: bundleTs(ctx, "brief") ?? bundleTs(ctx, "executive"),
    dateRange: dateRangeLabel(ctx),
    brands: scopedBrands(ctx),
    confidence: exec ? "Medium" : "Low",
    whySupports: "Headline and observation fields are GPT narratives grounded in the same bundle metrics shown below.",
    calculation: "Brief headline normalised from strategist bundle; executive pack enriches with CEO summary and recommended action.",
    missing: missing.length ? missing : undefined,
  };
}

export function buildEvidencePackEvidence(ctx: HardDataContext, rowLabel?: string): EvidenceContext {
  const rows = ctx.marketIntel?.evidencePack ?? [];
  const exec = ctx.marketIntel?.executivePack;
  const focus = rowLabel ?? rows[0]?.competitorDomain ?? "Evidence row";
  const missing: string[] = [];
  if (!rows.length) missing.push("ra_barbs_evidence_pack returned 0 rows");

  return {
    claim: exec?.headline ?? `Quantified threat evidence for ${focus}.`,
    sourceTable: "ra_barbs_evidence_pack · ra_executive_pack",
    sourceApi: "Supabase read",
    rowCount: rows.length + (exec ? 1 : 0),
    lastUpdated: bundleTs(ctx, "brief"),
    dateRange: dateRangeLabel(ctx),
    brands: rows.map((r) => r.competitorDomain),
    confidence: classifyRaConfidence(rows.length),
    whySupports:
      "Evidence pack rows tie threat_score to creative volume and demand with analyst context strings.",
    calculation:
      "Ordered by threat_score descending; workspace filter applied on competitor_domain.",
    missing: missing.length ? missing : undefined,
  };
}
