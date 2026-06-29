import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import type { ChannelMixResult } from "@/lib/channelMix";
import type { StrategistIntelBundle } from "@/lib/api-gateway";
import type { PanelFocus } from "./data-module-types";
import {
  EvidenceDrawerFrame,
  EvidenceSampleLinks,
  EvidenceSampleTable,
  type EvidenceDrawerExtras,
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

export function renderHardDataBody(
  focus: PanelFocus,
  data: HardDataPayload,
  extras?: EvidenceDrawerExtras,
) {
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
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Competitor metrics"
            highlightRow={hi}
            columns={["Brand", "Creatives", "Demand", "Threat score", "Efficiency"]}
            rows={rows.map((r) => {
              const d = Number(r.demand) || 0;
              const c = Number(r.creative_volume) || 0;
              const eff = c > 0 ? (d / c).toFixed(2) : "—";
              return [r.competitor_domain, r.creative_volume, r.demand, r.threat_score, eff];
            })}
            emptyMessage="No competitor rows available for this workspace."
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
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Threat metrics"
            highlightRow={hi}
            columns={["Competitor", "Threat score", "Risk level", "Narrative"]}
            rows={rows.map((r) => [r.competitorDomain, r.threatScore, r.riskLevel, r.narrative])}
            emptyMessage="No threat rows available for this workspace."
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
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Territory metrics"
            highlightRow={hi}
            columns={["Emotion", "Brands using", "Avg share %", "Status"]}
            rows={rows.map((r) => [r.emotion, r.brandsUsing, r.avgShare.toFixed(1), r.status])}
            emptyMessage="No territory data available."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "channelMix": {
      const evidence = buildChannelMixEvidence(ctx);
      const rows = data.channelMix?.rows ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Territory metrics"
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
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Recommended moves"
            highlightRow={hi}
            columns={["#", "Move", "Priority"]}
            rows={data.recommendedMoves.map((move, i) => [i + 1, move, i === 0 ? "Primary" : "Supporting"])}
            emptyMessage="No recommended moves composed for this workspace."
          />
          <EvidenceSampleTable
            label="Pitch details"
            columns={["Category", "Leader", "Action", "Recommendation"]}
            rows={data.pitch.map((r) => [r.category, r.category_leader, r.action, r.recommendation])}
            emptyMessage="No additional pitch details available."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "strategicActions": {
      const evidence = buildStrategicActionsEvidence(ctx);
      const rows = data.marketIntel?.strategicActions ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Sample records"
            highlightRow={hi}
            columns={["Priority", "Action"]}
            rows={rows.map((r) => [r.priority, r.action])}
            emptyMessage="No strategic actions available."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "positioning": {
      const evidence = buildPositioningEvidence(ctx, focus.rowLabel);
      const rows = data.marketIntel?.positioningMap ?? [];
      return (
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Positioning metrics"
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
            emptyMessage="No positioning data available."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "adlibrary": {
      const evidence = buildAdlibraryEvidence(ctx);
      const cov = data.adlibraryCoverage;
      return (
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Coverage metrics"
            columns={["Metric", "Count"]}
            rows={[
              ["Advertisers tracked", cov?.advertisersTracked ?? 0],
              ["Creatives indexed", cov?.adsIndexed ?? 0],
              ["Enriched creatives", cov?.enrichedAds ?? 0],
            ]}
            emptyMessage="Observed creative activity is still being indexed."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "executive": {
      const evidence = buildExecutiveEvidence(ctx);
      const exec = data.marketIntel?.executivePack;
      return (
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
          <EvidenceSampleTable
            label="Territory metrics"
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
        <EvidenceDrawerFrame ctx={evidence} extras={extras}>
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
            emptyMessage="No evidence pack rows available."
          />
        </EvidenceDrawerFrame>
      );
    }

    case "challengers": {
      const rows = [...data.challengers].sort((a, b) => (Number(b.creative_volume) || 0) - (Number(a.creative_volume) || 0));
      return (
        <EvidenceDrawerFrame
          extras={extras}
          ctx={{
            claim: "Repeated market messages show which themes competitors keep pushing in creatives.",
            confidence: rows.length >= 5 ? "High" : rows.length >= 1 ? "Medium" : "Low",
            dateRange: data.workspace ? `Category: ${data.workspace.category}` : null,
            basedOn: [
              `${rows.length} message themes tracked`,
              `${rows.reduce((s, r) => s + (Number(r.creative_volume) || 0), 0)} creatives behind themes`,
            ],
            whySupports: "Keyword frequency shows which messages the market keeps repeating.",
            methodology: "We cluster competitor keywords by brand and rank by creative volume.",
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
          extras={extras}
          ctx={{
            claim: "Whitespace highlights emotional territories with room to position.",
            confidence: rows.length >= 3 ? "Medium" : "Low",
            dateRange: data.workspace ? `Category: ${data.workspace.category}` : null,
            basedOn: [
              `${rows.length} open territories scored`,
              rows[0]?.emotion ? `Top opening: ${rows[0].emotion}` : "Category whitespace scan",
            ],
            whySupports: "Opportunity scores show where competitors are not crowded.",
            methodology: "We score emotional territories by competition density and opportunity gap.",
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
          extras={extras}
          ctx={{
            claim: "Market movement shows which brands are gaining observed demand.",
            confidence: rows.length >= 5 ? "High" : rows.length >= 1 ? "Medium" : "Low",
            dateRange: data.workspace ? `Category: ${data.workspace.category}` : null,
            basedOn: [
              `${rows.length} brands with momentum signals`,
              rows[0]?.momentum ? `${rows[0].brand_domain}: ${rows[0].momentum}` : "Demand trend scan",
            ],
            whySupports: "Demand and momentum labels indicate brands getting louder in the category.",
            methodology: "We rank brands by latest observed demand and momentum shift.",
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
          extras={extras}
          ctx={{
            claim: "Meeting prep talking points structured for the next client call.",
            confidence: rows.length >= 3 ? "Medium" : "Low",
            dateRange: data.workspace ? `Workspace: ${data.workspace.client_name}` : null,
            basedOn: [`${rows.length} talking-point sections`],
            whySupports: "Each section is a structured narrative for client-call flow.",
            methodology: "We assemble category talking points from strategist intelligence for your workspace.",
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
          extras={extras}
          ctx={{
            claim: "Weekly changes highlight brands shifting momentum or pressure.",
            confidence: rows.length >= 3 ? "Medium" : "Low",
            dateRange: "Latest weekly change window",
            basedOn: [
              `${rows.length} brands with movement`,
              rows[0]?.marketChange ? `${rows[0].brandDomain}: ${rows[0].marketChange}` : "Weekly movement scan",
            ],
            whySupports: "Change, momentum, and pressure fields describe what moved for each brand.",
            methodology: "We compare weekly movement signals across your watchlist brands.",
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
