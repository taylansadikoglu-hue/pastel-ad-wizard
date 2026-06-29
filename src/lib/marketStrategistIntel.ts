/**
 * Category-level strategist intelligence from ra_* views.
 * Supplements the engine bundle with GPT narratives stored in Supabase.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type TerritoryRow = {
  emotion: string;
  brandsUsing: number;
  avgShare: number;
  status: string;
};

export type StrategicRiskRow = {
  competitorDomain: string;
  threatScore: number;
  riskLevel: string;
  narrative: string;
};

export type MeetingPrepRow = {
  section: string;
  content: string;
};

export type MarketChangeRow = {
  brandDomain: string;
  momentum: string | null;
  pressure: string | null;
  marketChange: string | null;
  latestInterest: number | null;
};

export type PositioningMapRow = {
  brand: string;
  category: string | null;
  shareOfVoice: number | null;
  placements: number | null;
  x: number | null;
  y: number | null;
  topEmotion: string | null;
};

export type EvidencePackRow = {
  competitorDomain: string;
  threatScore: number | null;
  creativeVolume: number | null;
  demand: number | null;
  threatContext: string | null;
  confidence: string | null;
  marketRank: string | null;
};

export type MarketStrategistIntel = {
  available: boolean;
  executivePack: {
    headline: string | null;
    observation: string | null;
    recommendedAction: string | null;
    marketTemperature: string | null;
    pressureSummary: string | null;
    outlook: string | null;
    ceoSummary: string | null;
  } | null;
  competitiveGap: {
    strongestThreat: string | null;
    strategicOpening: string | null;
    gapNarrative: string | null;
  } | null;
  dashboardHero: {
    marketLeader: string | null;
    fastestMomentum: string | null;
    topOpportunity: string | null;
    opportunityScore: number | null;
    marketStory: string | null;
  } | null;
  territories: TerritoryRow[];
  risks: StrategicRiskRow[];
  meetingPrep: MeetingPrepRow[];
  dailyChanges: MarketChangeRow[];
  positioningMap: PositioningMapRow[];
  evidencePack: EvidencePackRow[];
  strategicActions: { priority: number | null; action: string }[];
};

const empty: MarketStrategistIntel = {
  available: false,
  executivePack: null,
  competitiveGap: null,
  dashboardHero: null,
  territories: [],
  risks: [],
  meetingPrep: [],
  dailyChanges: [],
  positioningMap: [],
  evidencePack: [],
  strategicActions: [],
};

export async function fetchMarketStrategistIntel(
  supabase: SupabaseClient<Database>,
): Promise<MarketStrategistIntel> {
  const [
    execRes,
    gapRes,
    heroRes,
    territoryRes,
    riskRes,
    meetingRes,
    changeRes,
    mapRes,
    evidenceRes,
    actionsRes,
  ] = await Promise.all([
    supabase.from("ra_executive_pack").select("*").limit(1).maybeSingle(),
    supabase.from("ra_competitive_gap").select("*").limit(1).maybeSingle(),
    supabase.from("ra_dashboard_hero").select("*").limit(1).maybeSingle(),
    supabase.from("ra_strategic_territories").select("*").order("avg_share", { ascending: false }),
    supabase.from("ra_strategic_risks").select("*").order("threat_score", { ascending: false }).limit(8),
    supabase.from("ra_meeting_prep").select("*"),
    supabase.from("ra_daily_change_feed").select("*").order("latest_interest", { ascending: false }).limit(8),
    supabase.from("ra_market_intelligence").select("*").limit(12),
    supabase.from("ra_barbs_evidence_pack").select("*").order("threat_score", { ascending: false }).limit(8),
    supabase.from("ra_strategic_actions").select("*").order("priority", { ascending: true }),
  ]);

  for (const res of [execRes, gapRes, heroRes, territoryRes, riskRes, meetingRes, changeRes, mapRes, evidenceRes, actionsRes]) {
    if (res.error) {
      console.warn("[market strategist intel] fetch failed:", res.error.message);
    }
  }

  const territories = (territoryRes.data ?? []).map((r) => ({
    emotion: r.emotion ?? "—",
    brandsUsing: Number(r.brands_using ?? 0),
    avgShare: Number(r.avg_share ?? 0),
    status: r.territory_status ?? "—",
  }));

  const risks = (riskRes.data ?? []).map((r) => ({
    competitorDomain: r.competitor_domain ?? "—",
    threatScore: Number(r.threat_score ?? 0),
    riskLevel: r.risk_level ?? "—",
    narrative: r.risk_narrative ?? "",
  }));

  const hasAny =
    Boolean(execRes.data || gapRes.data || heroRes.data)
    || territories.length > 0
    || risks.length > 0
    || (meetingRes.data?.length ?? 0) > 0;

  if (!hasAny) return empty;

  const exec = execRes.data;
  const gap = gapRes.data;
  const hero = heroRes.data;

  return {
    available: true,
    executivePack: exec
      ? {
          headline: exec.headline?.trim() || null,
          observation: exec.observation?.trim() || null,
          recommendedAction: exec.recommended_action?.trim() || null,
          marketTemperature: exec.market_temperature?.trim() || null,
          pressureSummary: exec.pressure_summary?.trim() || null,
          outlook: exec.outlook?.trim() || null,
          ceoSummary: exec.ceo_summary?.trim() || null,
        }
      : null,
    competitiveGap: gap
      ? {
          strongestThreat: gap.strongest_threat?.trim() || null,
          strategicOpening: gap.strategic_opening?.trim() || null,
          gapNarrative: gap.gap_narrative?.trim() || null,
        }
      : null,
    dashboardHero: hero
      ? {
          marketLeader: hero.market_leader?.trim() || null,
          fastestMomentum: hero.fastest_momentum?.trim() || null,
          topOpportunity: hero.top_opportunity?.trim() || null,
          opportunityScore: hero.opportunity_score != null ? Number(hero.opportunity_score) : null,
          marketStory: hero.market_story?.trim() || null,
        }
      : null,
    territories,
    risks,
    meetingPrep: (meetingRes.data ?? []).map((r) => ({
      section: r.section ?? "Insight",
      content: r.content?.trim() ?? "",
    })).filter((r) => r.content),
    dailyChanges: (changeRes.data ?? []).map((r) => ({
      brandDomain: r.brand_domain ?? "—",
      momentum: r.momentum,
      pressure: r.pressure,
      marketChange: r.market_change,
      latestInterest: r.latest_interest != null ? Number(r.latest_interest) : null,
    })),
    positioningMap: (mapRes.data ?? []).map((r) => ({
      brand: r.brand ?? "—",
      category: r.category,
      shareOfVoice: r.share_of_voice != null ? Number(r.share_of_voice) : null,
      placements: r.placements != null ? Number(r.placements) : null,
      x: r.x_axis != null ? Number(r.x_axis) : null,
      y: r.y_axis != null ? Number(r.y_axis) : null,
      topEmotion: r.top_emotion,
    })),
    evidencePack: (evidenceRes.data ?? []).map((r) => ({
      competitorDomain: r.competitor_domain ?? "—",
      threatScore: r.threat_score != null ? Number(r.threat_score) : null,
      creativeVolume: r.creative_volume != null ? Number(r.creative_volume) : null,
      demand: r.demand != null ? Number(r.demand) : null,
      threatContext: r.threat_context?.trim() || null,
      confidence: r.confidence,
      marketRank: r.market_rank,
    })),
    strategicActions: (actionsRes.data ?? []).map((r) => ({
      priority: r.priority != null ? Number(r.priority) : null,
      action: r.action?.trim() ?? "",
    })).filter((r) => r.action),
  };
}
