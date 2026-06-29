export type DataModuleId =
  | "competitors"
  | "challengers"
  | "whitespace"
  | "momentum"
  | "executive"
  | "pitch"
  | "territories"
  | "threats"
  | "meeting"
  | "changes"
  | "positioning"
  | "evidence"
  | "channelMix"
  | "adlibrary"
  | "strategicActions";

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
  territories: {
    index: "09",
    title: "Emotional territory map",
    subtitle: "Crowded vs open messaging space",
    source: "ra_strategic_territories",
  },
  threats: {
    index: "10",
    title: "Threat radar",
    subtitle: "Competitors requiring immediate attention",
    source: "ra_strategic_risks",
  },
  meeting: {
    index: "11",
    title: "Meeting prep",
    subtitle: "Structured client-call talking points",
    source: "ra_meeting_prep",
  },
  changes: {
    index: "12",
    title: "What changed this week",
    subtitle: "Momentum and pressure shifts",
    source: "ra_daily_change_feed",
  },
  positioning: {
    index: "13",
    title: "Category positioning map",
    subtitle: "Share of voice across tracked brands",
    source: "ra_market_intelligence",
  },
  evidence: {
    index: "07",
    title: "Executive evidence pack",
    subtitle: "Quantified threat and demand signals",
    source: "ra_barbs_evidence_pack",
  },
  channelMix: {
    index: "03b",
    title: "Channel mix",
    subtitle: "Where category activity is showing up",
    source: "strategist bundle · brief.channels",
  },
  adlibrary: {
    index: "—",
    title: "AdLibrary coverage",
    subtitle: "Optional AdLibrary pipeline indexing",
    source: "adlibrary_* tables",
  },
  strategicActions: {
    index: "14",
    title: "Strategic actions",
    subtitle: "Priority moves from intelligence engine",
    source: "ra_strategic_actions",
  },
};
