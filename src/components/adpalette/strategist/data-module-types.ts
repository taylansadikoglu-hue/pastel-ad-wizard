export type DataModuleId =
  | "competitors"
  | "challengers"
  | "whitespace"
  | "momentum"
  | "executive"
  | "pitch";

export type PanelFocus = {
  moduleId: DataModuleId;
  rowIndex?: number;
  rowLabel?: string;
};

export const MODULE_META: Record<
  DataModuleId,
  { index: string; title: string; subtitle: string; source: string }
> = {
  competitors: {
    index: "01",
    title: "Competitors",
    subtitle: "agency_watchlist → client_threats",
    source: "ra_client_threats",
  },
  challengers: {
    index: "02",
    title: "Emerging Challengers",
    subtitle: "brand_opportunities",
    source: "ra_brand_opportunities",
  },
  whitespace: {
    index: "03",
    title: "Strategic Whitespace",
    subtitle: "top_opportunities",
    source: "ra_top_opportunities",
  },
  momentum: {
    index: "04",
    title: "Momentum Watchlist",
    subtitle: "market_pressure",
    source: "ra_market_pressure",
  },
  executive: {
    index: "05",
    title: "Executive Summary",
    subtitle: "executive_summary",
    source: "ra_executive_summary",
  },
  pitch: {
    index: "06",
    title: "Strategic Advisor",
    subtitle: "pitch_brief",
    source: "ra_pitch_brief",
  },
};
