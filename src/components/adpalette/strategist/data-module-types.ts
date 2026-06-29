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

/** Market Intel sections — customer-facing titles only. */
export const MODULE_META: Record<
  DataModuleId,
  { index: string; title: string; subtitle: string }
> = {
  executive: {
    index: "01",
    title: "What's happening in the market",
    subtitle: "Headline read for your client meeting",
  },
  competitors: {
    index: "02",
    title: "Who is leading",
    subtitle: "Share of observed activity in the category",
  },
  momentum: {
    index: "03",
    title: "Who is getting louder",
    subtitle: "Brands gaining share of voice and search attention",
  },
  challengers: {
    index: "04",
    title: "What the market keeps saying",
    subtitle: "Repeated messages and emotional angles",
  },
  whitespace: {
    index: "05",
    title: "Angles nobody is owning",
    subtitle: "Open positioning competitors haven't claimed",
  },
  pitch: {
    index: "06",
    title: "Recommended next moves",
    subtitle: "What to say in tomorrow's client meeting",
  },
  territories: {
    index: "09",
    title: "Emotional territory map",
    subtitle: "Crowded vs open messaging space",
  },
  threats: {
    index: "10",
    title: "Threat radar",
    subtitle: "Competitors requiring immediate attention",
  },
  meeting: {
    index: "11",
    title: "Meeting prep",
    subtitle: "Structured client-call talking points",
  },
  changes: {
    index: "12",
    title: "What changed this week",
    subtitle: "Momentum and pressure shifts",
  },
  positioning: {
    index: "13",
    title: "Category positioning map",
    subtitle: "Share of voice across tracked brands",
  },
  evidence: {
    index: "07",
    title: "Executive evidence pack",
    subtitle: "Quantified threat and demand signals",
  },
  channelMix: {
    index: "03b",
    title: "Channel mix",
    subtitle: "Where category activity is showing up",
  },
  adlibrary: {
    index: "—",
    title: "Observed creative activity",
    subtitle: "Indexed creatives supporting market reads",
  },
  strategicActions: {
    index: "14",
    title: "Strategic actions",
    subtitle: "Priority moves from category intelligence",
  },
};
