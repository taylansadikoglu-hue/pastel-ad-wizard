import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import type { ChannelMixResult } from "@/lib/channelMix";
import type { StrategistIntelBundle } from "@/lib/api-gateway";
import type { PanelFocus } from "./data-module-types";
import {
  EvidenceDrawerFrame,
  EvidenceSampleLinks,
  EvidenceSampleTable,
} from "./evidence-frame";
import {
  buildAdlibraryEvidence,
  buildChannelMixEvidence,
  buildCompetitorsEvidence,
  buildEvidencePackEvidence,
  buildExecutiveEvidence,
  buildPitchEvidence,
  buildPositioningEvidence,
  buildStrategicActionsEvidence,
  buildTerritoriesEvidence,
  buildThreatsEvidence,
  type BriefSnapshot,
  type ConfidenceSnapshot,
  type HardDataContext,
  type WorkspaceScope,
} from "./evidence-context";

import type { MarketStrategistIntel } from "@/lib/marketStrategistIntel";

type Threat = {
  competitor_domain: string | null;
  creative_volume: number | null;
  demand: number | null;
  threat_score: number | null;
};

type Challenger = {
  brand_domain: string | null;
  keyword: string | null;
  opportunity_score: number | null;
  pressure: string | null;
  momentum: string | null;
  latest_interest: number | null;
  creative_volume: number | null;
};

type Whitespace = {
  category: string | null;
  emotion: string | null;
  strategic_priority: string | null;
  market_density: string | null;
  recommendation: string | null;
  opportunity_score: number | null;
};

type Momentum = {
  brand_domain: string | null;
  keyword: string | null;
  momentum: string | null;
  latest_interest: number | null;
  creative_volume: number | null;
  pressure: string | null;
};

type Exec = {
  dominant_market: string | null;
  strongest_brand: string | null;
  dominant_emotion: string | null;
  top_opportunity_category: string | null;
  top_opportunity_emotion: string | null;
};

type Pitch = {
  category: string | null;
  category_leader: string | null;
  dominant_emotion: string | null;
  whitespace_emotion: string | null;
  recommendation: string | null;
  action: string | null;
};

export type HardDataPayload = {
  threats: Threat[];
  challengers: Challenger[];
  whitespace: Whitespace[];
  momentum: Momentum[];
  exec: Exec | null;
  pitch: Pitch[];
  agencyId: string | null;
  marketIntel: MarketStrategistIntel | null;
  channelMix: ChannelMixResult | null;
  adlibraryCoverage: AdlibraryCoverage | null;
  confidence: ConfidenceSnapshot;
  brief: BriefSnapshot;
  workspace: WorkspaceScope;
  recommendedMoves: string[];
  intelBundle: StrategistIntelBundle | null;
};

function asContext(data: HardDataPayload): HardDataContext {
  return data;
}

export function renderHardDataBody(focus: PanelFocus, data: HardDataPayload) {
  const ctx = asContext(data);
  const hi = focus.rowIndex;

  switch (focus.moduleId) {
    case "competitors": {
      const evidence = buildCompetitorsEvidence(ctx, focus.rowLabel);
      const rows = [...data.threats].sort(
        (a, b) => (Number(b.creative_volume) || Number(b.demand) || 0) - (Number(a.creative_volume) || Number(a.demand) || 0),
      );
      const focusRow = hi != null ? rows[hi] : rows[0];
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Brand", "Creatives", "Demand", "Threat score", "Efficiency"]}
            rows={rows.map((r) => {
              const d = Number(r.demand) || 0;
              const c = Number(r.creative_volume) || 0;
              const eff = c > 0 ? (d / c).toFixed(2) : "—";
              return [r.competitor_domain, r.creative_volume, r.demand, r.threat_score, eff];
            })}
            emptyMessage="No competitor rows in strategist bundle modules.competitors."
          />
          {focusRow?.competitor_domain ? (
            <EvidenceSampleLinks
              links={[
                {
                  label: `Open war room · ${focusRow.competitor_domain}`,
                  href: `/app/advertiser/${focusRow.competitor_domain}`,
                },
              ]}
            />
          ) : null}
        </EvidenceDrawerFrame>
      );
    }

    case "threats": {
      const evidence = buildThreatsEvidence(ctx, focus.rowLabel);
      const rows = data.marketIntel?.risks ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Competitor", "Threat score", "Risk level", "Narrative"]}
            rows={rows.map((r) => [r.competitorDomain, r.threatScore, r.riskLevel, r.narrative])}
            emptyMessage="No rows in ra_strategic_risks for this workspace."
          />
          <EvidenceSampleLinks
            links={rows.slice(0, 3).map((r) => ({
              label: `Advertiser page · ${r.competitorDomain}`,
              href: `/app/advertiser/${r.competitorDomain}`,
            }))}
          />
        </EvidenceDrawerFrame>
      );
    }

    case "territories": {
      const evidence = buildTerritoriesEvidence(ctx, focus.rowLabel);
      const rows = data.marketIntel?.territories ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Emotion", "Brands using", "Avg share %", "Status"]}
            rows={rows.map((r) => [r.emotion, r.brandsUsing, r.avgShare.toFixed(1), r.status])}
            emptyMessage="No rows in ra_strategic_territories."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "channelMix": {
      const evidence = buildChannelMixEvidence(ctx);
      const rows = data.channelMix?.rows ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            columns={["Channel", "Share %", "Ads counted", "Row confidence"]}
            rows={rows.map((r) => [r.channel, r.pct.toFixed(1), r.ads, r.confidence])}
            emptyMessage="Channel mix baseline — no attributed rows in bundle."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "pitch": {
      const evidence = buildPitchEvidence(ctx);
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Sample records"
            highlightRow={hi}
            columns={["#", "Recommended move", "Source"]}
            rows={data.recommendedMoves.map((move, i) => {
              const source =
                i === 0 && data.marketIntel?.executivePack?.recommendedAction === move
                  ? "ra_executive_pack"
                  : data.pitch[i]?.action
                    ? "modules.pitch"
                    : "heuristic";
              return [i + 1, move, source];
            })}
            emptyMessage="No recommended moves composed for this workspace."
          />
          <EvidenceSampleTable
            label="Pitch module rows"
            columns={["Category", "Leader", "Action", "Recommendation"]}
            rows={data.pitch.map((r) => [r.category, r.category_leader, r.action, r.recommendation])}
            emptyMessage="modules.pitch empty in strategist bundle."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "strategicActions": {
      const evidence = buildStrategicActionsEvidence(ctx);
      const rows = data.marketIntel?.strategicActions ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Sample records"
            highlightRow={hi}
            columns={["Priority", "Action"]}
            rows={rows.map((r) => [r.priority, r.action])}
            emptyMessage="No rows in ra_strategic_actions."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "positioning": {
      const evidence = buildPositioningEvidence(ctx, focus.rowLabel);
      const rows = data.marketIntel?.positioningMap ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Brand", "Category", "SOV %", "Placements", "Top emotion", "X", "Y"]}
            rows={rows.map((r) => [
              r.brand,
              r.category,
              r.shareOfVoice,
              r.placements,
              r.topEmotion,
              r.x,
              r.y,
            ])}
            emptyMessage="No rows in ra_market_intelligence positioning map."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "adlibrary": {
      const evidence = buildAdlibraryEvidence(ctx);
      const cov = data.adlibraryCoverage;
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            columns={["Metric", "Count", "Table"]}
            rows={[
              ["Advertisers tracked", cov?.advertisersTracked ?? 0, "adlibrary_advertiser_candidates"],
              ["Ads indexed", cov?.adsIndexed ?? 0, "ad_placements (source_platform=adlibrary)"],
              ["Enriched ads", cov?.enrichedAds ?? 0, "adlibrary_enrichments"],
              ["Credits remaining (last run)", cov?.creditsRemaining ?? "—", "adlibrary_pipeline_runs"],
            ]}
            emptyMessage="AdLibrary optional tables not available."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "executive": {
      const evidence = buildExecutiveEvidence(ctx);
      const exec = data.marketIntel?.executivePack;
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          <EvidenceSampleTable
            label="Raw metrics"
            columns={["Field", "Value"]}
            rows={[
              ["Headline", data.brief?.headline ?? exec?.headline],
              ["Category", data.brief?.category ?? data.exec?.dominant_market],
              ["Client", data.brief?.client_name ?? data.workspace?.client_name],
              ["CEO summary", exec?.ceoSummary],
              ["Market temperature", exec?.marketTemperature],
              ["Recommended action", exec?.recommendedAction],
              ["Ads analysed", data.confidence?.ads_analysed],
              ["Brands tracked", data.confidence?.brands_tracked],
            ]}
          />
        </EvidenceDrawerFrame>
      );
    }

    case "evidence": {
      const evidence = buildEvidencePackEvidence(ctx, focus.rowLabel);
      const rows = data.marketIntel?.evidencePack ?? [];
      const exec = data.marketIntel?.executivePack;
      return (
        <EvidenceDrawerFrame ctx={evidence}>
          {exec ? (
            <EvidenceSampleTable
              label="Executive pack fields"
              columns={["Field", "Value"]}
              rows={[
                ["Headline", exec.headline],
                ["CEO summary", exec.ceoSummary],
                ["Market temperature", exec.marketTemperature],
                ["Outlook", exec.outlook],
                ["Recommended action", exec.recommendedAction],
              ]}
            />
          ) : null}
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Competitor", "Threat", "Creatives", "Demand", "Context", "Confidence", "Rank"]}
            rows={rows.map((r) => [
              r.competitorDomain,
              r.threatScore,
              r.creativeVolume,
              r.demand,
              r.threatContext,
              r.confidence,
              r.marketRank,
            ])}
            emptyMessage="No rows in ra_barbs_evidence_pack."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "challengers": {
      const rows = [...data.challengers].sort((a, b) => (Number(b.creative_volume) || 0) - (Number(a.creative_volume) || 0));
      return (
        <EvidenceDrawerFrame
          ctx={{
            claim: "Repeated market messages show which keywords competitors keep using in creatives.",
            sourceTable: "modules.challengers",
            sourceApi: data.intelBundle?.challengers.metadata.source ?? "GET /api/strategist/bundle",
            rowCount: rows.length,
            lastUpdated: data.intelBundle?.challengers.metadata.timestamp ?? null,
            dateRange: data.workspace ? `Category: ${data.workspace.category}` : null,
            brands: rows.map((r) => r.brand_domain).filter(Boolean) as string[],
            confidence: rows.length >= 5 ? "High" : rows.length >= 1 ? "Medium" : "Low",
            whySupports: "Keyword frequency across brand_domain rows indicates the messages the market keeps repeating.",
            calculation: "Sorted by creative_volume descending from modules.challengers.",
            missing: rows.length ? undefined : ["modules.challengers empty in strategist bundle"],
          }}
        >
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Brand", "Keyword", "Creatives", "Demand", "Trend", "Pressure"]}
            rows={rows.map((r) => [
              r.brand_domain,
              r.keyword,
              r.creative_volume,
              r.latest_interest,
              r.momentum,
              r.pressure,
            ])}
          />
        </EvidenceDrawerFrame>
      );
    }

    case "whitespace": {
      const rows = [...data.whitespace].sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0));
      return (
        <EvidenceDrawerFrame
          ctx={{
            claim: "Whitespace rows highlight emotional territories with room to position.",
            sourceTable: "modules.whitespace",
            sourceApi: data.intelBundle?.whitespace.metadata.source ?? "GET /api/strategist/bundle",
            rowCount: rows.length,
            lastUpdated: data.intelBundle?.whitespace.metadata.timestamp ?? null,
            dateRange: data.workspace ? `Category: ${data.workspace.category}` : null,
            brands: data.workspace ? [data.workspace.client_name, ...data.workspace.competitor_domains] : [],
            confidence: rows.length >= 3 ? "Medium" : "Low",
            whySupports: "Opportunity scores and market_density show where competitors are not crowded.",
            calculation: "Sorted by opportunity_score descending from modules.whitespace.",
            missing: rows.length ? undefined : ["modules.whitespace empty in strategist bundle"],
          }}
        >
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Category", "Emotion", "Priority", "Competition", "Score", "Recommendation"]}
            rows={rows.map((r) => [
              r.category,
              r.emotion,
              r.strategic_priority,
              r.market_density,
              r.opportunity_score,
              r.recommendation,
            ])}
          />
        </EvidenceDrawerFrame>
      );
    }

    case "momentum": {
      const rows = [...data.momentum].sort((a, b) => (Number(b.latest_interest) || 0) - (Number(a.latest_interest) || 0));
      return (
        <EvidenceDrawerFrame
          ctx={{
            claim: "Momentum rows show which brands are gaining observed demand and share of voice.",
            sourceTable: "modules.momentum",
            sourceApi: data.intelBundle?.momentum.metadata.source ?? "GET /api/strategist/bundle",
            rowCount: rows.length,
            lastUpdated: data.intelBundle?.momentum.metadata.timestamp ?? null,
            dateRange: data.workspace ? `Category: ${data.workspace.category}` : null,
            brands: rows.map((r) => r.brand_domain).filter(Boolean) as string[],
            confidence: rows.length >= 5 ? "High" : rows.length >= 1 ? "Medium" : "Low",
            whySupports: "latest_interest and momentum labels indicate brands getting louder in the category.",
            calculation: "Sorted by latest_interest descending from modules.momentum.",
            missing: rows.length ? undefined : ["modules.momentum empty in strategist bundle"],
          }}
        >
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Brand", "Keyword", "Demand", "Creatives", "Trend", "Pressure"]}
            rows={rows.map((r) => [
              r.brand_domain,
              r.keyword,
              r.latest_interest,
              r.creative_volume,
              r.momentum,
              r.pressure,
            ])}
          />
        </EvidenceDrawerFrame>
      );
    }

    case "meeting": {
      const rows = data.marketIntel?.meetingPrep ?? [];
      return (
        <EvidenceDrawerFrame
          ctx={{
            claim: "Meeting prep talking points structured for the next client call.",
            sourceTable: "ra_meeting_prep",
            sourceApi: "Supabase read (ra_meeting_prep)",
            rowCount: rows.length,
            lastUpdated: data.intelBundle?.brief.metadata.timestamp ?? null,
            dateRange: data.workspace ? `Workspace: ${data.workspace.client_name}` : null,
            brands: data.workspace ? [data.workspace.client_name] : [],
            confidence: rows.length >= 3 ? "Medium" : "Low",
            whySupports: "Each section/content pair is stored GPT narrative for meeting structure.",
            calculation: "All rows from ra_meeting_prep for the category.",
            missing: rows.length ? undefined : ["ra_meeting_prep returned 0 rows"],
          }}
        >
          <EvidenceSampleTable
            label="Sample records"
            columns={["Section", "Content"]}
            rows={rows.map((r) => [r.section, r.content])}
          />
        </EvidenceDrawerFrame>
      );
    }

    case "changes": {
      const rows = data.marketIntel?.dailyChanges ?? [];
      return (
        <EvidenceDrawerFrame
          ctx={{
            claim: "Weekly change feed highlights brands shifting momentum or pressure.",
            sourceTable: "ra_daily_change_feed",
            sourceApi: "Supabase read (ra_daily_change_feed)",
            rowCount: rows.length,
            lastUpdated: data.intelBundle?.brief.metadata.timestamp ?? null,
            dateRange: "Latest weekly change window",
            brands: rows.map((r) => r.brandDomain),
            confidence: rows.length >= 3 ? "Medium" : "Low",
            whySupports: "market_change, momentum, and pressure fields describe what moved for each brand.",
            calculation: "Ordered by latest_interest descending, limited to 8 workspace-scoped brands.",
            missing: rows.length ? undefined : ["ra_daily_change_feed returned 0 rows"],
          }}
        >
          <EvidenceSampleTable
            label="Raw metrics"
            highlightRow={hi}
            columns={["Brand", "Change", "Momentum", "Pressure", "Interest"]}
            rows={rows.map((r) => [r.brandDomain, r.marketChange, r.momentum, r.pressure, r.latestInterest])}
          />
        </EvidenceDrawerFrame>
      );
    }

    default:
      return null;
  }
}
