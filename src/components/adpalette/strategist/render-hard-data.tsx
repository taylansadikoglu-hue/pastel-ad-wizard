import type { PanelFocus } from "./data-module-types";
import { HardDataSection, HardDataTable, HardDataTrend } from "./hard-data-content";

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
};

function avg(nums: number[]): string {
  if (!nums.length) return "—";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
}

export function renderHardDataBody(focus: PanelFocus, data: HardDataPayload) {
  const hi = focus.rowIndex;

  switch (focus.moduleId) {
    case "competitors": {
      const rows = [...data.threats].sort((a, b) => (Number(b.threat_score) || 0) - (Number(a.threat_score) || 0));
      const focusRow = hi != null ? rows[hi] : rows[0];
      const seed = focusRow?.competitor_domain ?? "threats";
      const current = Number(focusRow?.threat_score) || 0;
      return (
        <>
          <HardDataSection title="Raw threat registry">
            <HardDataTable
              highlightRow={hi}
              columns={["Domain", "Threat", "Demand", "Creative", "Efficiency"]}
              rows={rows.map((r) => {
                const d = Number(r.demand) || 0;
                const c = Number(r.creative_volume) || 0;
                const eff = c > 0 ? (d / c).toFixed(2) : "—";
                return [r.competitor_domain, r.threat_score, r.demand, r.creative_volume, eff];
              })}
            />
          </HardDataSection>
          <HardDataSection title="Granular breakdown">
            <HardDataTable
              columns={["Metric", "Portfolio", "Focused row"]}
              rows={[
                ["Threat score", avg(rows.map((r) => Number(r.threat_score) || 0)), focusRow?.threat_score],
                ["Demand", avg(rows.map((r) => Number(r.demand) || 0)), focusRow?.demand],
                ["Creative vol", avg(rows.map((r) => Number(r.creative_volume) || 0)), focusRow?.creative_volume],
              ]}
            />
          </HardDataSection>
          <HardDataTrend seed={seed} current={current} metricLabel="Threat score" />
        </>
      );
    }
    case "challengers": {
      const rows = [...data.challengers].sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0));
      const focusRow = hi != null ? rows[hi] : rows[0];
      return (
        <>
          <HardDataSection title="Raw challenger registry">
            <HardDataTable
              highlightRow={hi}
              columns={["Domain", "Keyword", "Opportunity", "Interest", "Creative", "Momentum", "Pressure"]}
              rows={rows.map((r) => [
                r.brand_domain, r.keyword, r.opportunity_score, r.latest_interest, r.creative_volume, r.momentum, r.pressure,
              ])}
            />
          </HardDataSection>
          <HardDataTrend
            seed={focusRow?.brand_domain ?? "challengers"}
            current={Number(focusRow?.opportunity_score) || 0}
            metricLabel="Opportunity score"
          />
        </>
      );
    }
    case "whitespace": {
      const rows = [...data.whitespace].sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0));
      return (
        <HardDataSection title="Whitespace opportunity matrix">
          <HardDataTable
            highlightRow={hi}
            columns={["Category", "Emotion", "Priority", "Density", "Score", "Recommendation"]}
            rows={rows.map((r) => [
              r.category, r.emotion, r.strategic_priority, r.market_density, r.opportunity_score, r.recommendation,
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
          <HardDataSection title="Momentum pressure table">
            <HardDataTable
              highlightRow={hi}
              columns={["Domain", "Keyword", "Interest", "Creative", "Momentum", "Pressure"]}
              rows={rows.map((r) => [
                r.brand_domain, r.keyword, r.latest_interest, r.creative_volume, r.momentum, r.pressure,
              ])}
            />
          </HardDataSection>
          <HardDataTrend
            seed={focusRow?.brand_domain ?? "momentum"}
            current={Number(focusRow?.latest_interest) || 0}
            metricLabel="Search interest"
          />
        </>
      );
    }
    case "executive":
      return (
        <HardDataSection title="Executive summary fields">
          <HardDataTable
            columns={["Field", "Value"]}
            rows={[
              ["Dominant market", data.exec?.dominant_market],
              ["Strongest brand", data.exec?.strongest_brand],
              ["Dominant emotion", data.exec?.dominant_emotion],
              ["Top opportunity category", data.exec?.top_opportunity_category],
              ["Top opportunity emotion", data.exec?.top_opportunity_emotion],
            ]}
          />
        </HardDataSection>
      );
    case "pitch":
      return (
        <HardDataSection title="Pitch brief registry">
          <HardDataTable
            highlightRow={hi}
            columns={["Category", "Leader", "Action", "Dominant", "Whitespace", "Recommendation"]}
            rows={data.pitch.map((r) => [
              r.category, r.category_leader, r.action, r.dominant_emotion, r.whitespace_emotion, r.recommendation,
            ])}
          />
        </HardDataSection>
      );
    default:
      return null;
  }
}
