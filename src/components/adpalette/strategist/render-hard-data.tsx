import type { PanelFocus } from "./data-module-types";
import { HardDataSection, HardDataTable, HardDataTrend } from "./hard-data-content";

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
};

function avg(nums: number[]): string {
  if (!nums.length) return "—";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
}

export function renderHardDataBody(focus: PanelFocus, data: HardDataPayload) {
  const hi = focus.rowIndex;

  switch (focus.moduleId) {
    case "competitors": {
      const rows = [...data.threats].sort(
        (a, b) => (Number(b.creative_volume) || Number(b.demand) || 0) - (Number(a.creative_volume) || Number(a.demand) || 0),
      );
      const focusRow = hi != null ? rows[hi] : rows[0];
      const seed = focusRow?.competitor_domain ?? "leaders";
      const current = Number(focusRow?.creative_volume) || Number(focusRow?.demand) || 0;
      return (
        <>
          <HardDataSection title="Share of observed activity">
            <HardDataTable
              highlightRow={hi}
              columns={["Brand", "Creatives", "Observed demand", "Efficiency"]}
              rows={rows.map((r) => {
                const d = Number(r.demand) || 0;
                const c = Number(r.creative_volume) || 0;
                const eff = c > 0 ? (d / c).toFixed(2) : "—";
                return [r.competitor_domain, r.creative_volume, r.demand, eff];
              })}
            />
          </HardDataSection>
          <HardDataSection title="Focused brand comparison">
            <HardDataTable
              columns={["Metric", "Category average", "Selected brand"]}
              rows={[
                ["Observed demand", avg(rows.map((r) => Number(r.demand) || 0)), focusRow?.demand],
                ["Active creatives", avg(rows.map((r) => Number(r.creative_volume) || 0)), focusRow?.creative_volume],
              ]}
            />
          </HardDataSection>
          <HardDataTrend seed={seed} current={current} metricLabel="Observed activity" />
        </>
      );
    }
    case "challengers": {
      const rows = [...data.challengers].sort((a, b) => (Number(b.creative_volume) || 0) - (Number(a.creative_volume) || 0));
      const focusRow = hi != null ? rows[hi] : rows[0];
      return (
        <>
          <HardDataSection title="Repeated market messages">
            <HardDataTable
              highlightRow={hi}
              columns={["Brand", "Message / keyword", "Creatives", "Observed demand", "Trend", "Pressure"]}
              rows={rows.map((r) => [
                r.brand_domain, r.keyword, r.creative_volume, r.latest_interest, r.momentum, r.pressure,
              ])}
            />
          </HardDataSection>
          <HardDataTrend
            seed={focusRow?.brand_domain ?? "messages"}
            current={Number(focusRow?.creative_volume) || 0}
            metricLabel="Creatives observed"
          />
        </>
      );
    }
    case "whitespace": {
      const rows = [...data.whitespace].sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0));
      return (
        <HardDataSection title="Angles nobody is owning">
          <HardDataTable
            highlightRow={hi}
            columns={["Category", "Emotion", "Priority", "Competition level", "Recommendation"]}
            rows={rows.map((r) => [
              r.category, r.emotion, r.strategic_priority, r.market_density, r.recommendation,
            ])}
          />
        </HardDataSection>
      );
    }
    case "momentum": {
      const rows = [...data.momentum].sort((a, b) => (Number(b.latest_interest) || 0) - (Number(a.latest_interest) || 0));
      const focusRow = hi != null ? rows[hi] : rows[0];
      return (
        <>
          <HardDataSection title="Brands getting louder">
            <HardDataTable
              highlightRow={hi}
              columns={["Brand", "Keyword", "Observed demand", "Creatives", "Trend", "Pressure"]}
              rows={rows.map((r) => [
                r.brand_domain, r.keyword, r.latest_interest, r.creative_volume, r.momentum, r.pressure,
              ])}
            />
          </HardDataSection>
          <HardDataTrend
            seed={focusRow?.brand_domain ?? "momentum"}
            current={Number(focusRow?.latest_interest) || 0}
            metricLabel="Observed demand"
          />
        </>
      );
    }
    case "executive":
      return (
        <HardDataSection title="Market snapshot fields">
          <HardDataTable
            columns={["Field", "Value"]}
            rows={[
              ["Category", data.exec?.dominant_market],
              ["Market leader", data.exec?.strongest_brand],
              ["Dominant message", data.exec?.dominant_emotion],
              ["Top open category", data.exec?.top_opportunity_category],
              ["Top open message", data.exec?.top_opportunity_emotion],
            ]}
          />
        </HardDataSection>
      );
    case "pitch":
      return (
        <HardDataSection title="Recommended next moves">
          <HardDataTable
            highlightRow={hi}
            columns={["Category", "Leader", "Action", "Dominant message", "Open angle", "Recommendation"]}
            rows={data.pitch.map((r) => [
              r.category, r.category_leader, r.action, r.dominant_emotion, r.whitespace_emotion, r.recommendation,
            ])}
          />
        </HardDataSection>
      );
    case "territories": {
      const rows = data.marketIntel?.territories ?? [];
      return (
        <HardDataSection title="Emotional territories">
          <HardDataTable
            highlightRow={hi}
            columns={["Emotion", "Brands", "Avg share %", "Status"]}
            rows={rows.map((r) => [r.emotion, r.brandsUsing, r.avgShare.toFixed(1), r.status])}
          />
        </HardDataSection>
      );
    }
    case "threats": {
      const rows = data.marketIntel?.risks ?? [];
      return (
        <HardDataSection title="Strategic risks">
          <HardDataTable
            highlightRow={hi}
            columns={["Competitor", "Threat score", "Risk level", "Narrative"]}
            rows={rows.map((r) => [r.competitorDomain, r.threatScore, r.riskLevel, r.narrative])}
          />
        </HardDataSection>
      );
    }
    case "meeting": {
      const rows = data.marketIntel?.meetingPrep ?? [];
      return (
        <HardDataSection title="Meeting prep">
          <HardDataTable
            columns={["Section", "Content"]}
            rows={rows.map((r) => [r.section, r.content])}
          />
        </HardDataSection>
      );
    }
    case "changes": {
      const rows = data.marketIntel?.dailyChanges ?? [];
      return (
        <HardDataSection title="Weekly changes">
          <HardDataTable
            highlightRow={hi}
            columns={["Brand", "Change", "Momentum", "Pressure", "Interest"]}
            rows={rows.map((r) => [r.brandDomain, r.marketChange, r.momentum, r.pressure, r.latestInterest])}
          />
        </HardDataSection>
      );
    }
    case "positioning": {
      const rows = data.marketIntel?.positioningMap ?? [];
      return (
        <HardDataSection title="Positioning map">
          <HardDataTable
            highlightRow={hi}
            columns={["Brand", "Category", "SOV %", "Placements", "Emotion", "X", "Y"]}
            rows={rows.map((r) => [r.brand, r.category, r.shareOfVoice, r.placements, r.topEmotion, r.x, r.y])}
          />
        </HardDataSection>
      );
    }
    case "evidence": {
      const rows = data.marketIntel?.evidencePack ?? [];
      const exec = data.marketIntel?.executivePack;
      return (
        <>
          {exec && (
            <HardDataSection title="Executive pack">
              <HardDataTable
                columns={["Field", "Value"]}
                rows={[
                  ["Headline", exec.headline],
                  ["CEO summary", exec.ceoSummary],
                  ["Market temperature", exec.marketTemperature],
                  ["Outlook", exec.outlook],
                  ["Pressure", exec.pressureSummary],
                  ["Recommended action", exec.recommendedAction],
                ]}
              />
            </HardDataSection>
          )}
          <HardDataSection title="Evidence pack">
            <HardDataTable
              highlightRow={hi}
              columns={["Competitor", "Threat", "Creatives", "Demand", "Context", "Confidence"]}
              rows={rows.map((r) => [
                r.competitorDomain, r.threatScore, r.creativeVolume, r.demand, r.threatContext, r.confidence,
              ])}
            />
          </HardDataSection>
        </>
      );
    }
    default:
      return null;
  }
}
