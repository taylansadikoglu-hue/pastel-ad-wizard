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

/** Market Intel sections — agency-facing titles only (no internal source names in UI). */
export const MODULE_META: Record<
  DataModuleId,
  { index: string; title: string; subtitle: string; source: string }
> = {
  executive: {
    index: "01",
    title: "What's happening in the market",
    subtitle: "Headline read for your client meeting",
    source: "ra_executive_summary",
  },
  competitors: {
    index: "02",
    title: "Who is leading",
    subtitle: "Share of observed activity in the category",
    source: "ra_client_threats",
  },
  momentum: {
    index: "03",
    title: "Who is getting louder",
    subtitle: "Brands gaining share of voice and search attention",
    source: "ra_market_pressure",
  },
  challengers: {
    index: "04",
    title: "What the market keeps saying",
    subtitle: "Repeated messages and emotional angles",
    source: "ra_brand_opportunities",
  },
  whitespace: {
    index: "05",
    title: "Angles nobody is owning",
    subtitle: "Open positioning competitors haven't claimed",
    source: "ra_top_opportunities",
  },
  pitch: {
    index: "06",
    title: "Recommended next moves",
    subtitle: "What to say in tomorrow's client meeting",
    source: "ra_pitch_brief",
  },
};
