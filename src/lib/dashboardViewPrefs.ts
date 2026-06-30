import type { DataModuleId } from "@/components/adpalette/strategist/data-module-types";

/** Market Intel sections — togglable on the dashboard and mapped to PPTX slides. */
export type MarketIntelSectionId =
  | "masthead"
  | "watchlist"
  | "kpis"
  | "heroSignals"
  | "weeklyChanges"
  | "competitors"
  | "channelMix"
  | "productThemes"
  | "whitespace"
  | "recommendedActions"
  | "deepEvidence";

export type DashboardViewPreset = "essentials" | "meeting" | "full" | "pptx" | "custom";

export const MARKET_INTEL_SECTIONS: {
  id: MarketIntelSectionId;
  label: string;
  short: string;
  pptx?: boolean;
}[] = [
  { id: "masthead", label: "Pulse headline", short: "Headline", pptx: true },
  { id: "watchlist", label: "Watchlist", short: "Brands" },
  { id: "kpis", label: "Category KPIs", short: "KPIs", pptx: true },
  { id: "heroSignals", label: "Hero signals", short: "Signals", pptx: true },
  { id: "weeklyChanges", label: "Weekly changes", short: "Weekly", pptx: true },
  { id: "competitors", label: "Competitor SOV", short: "SOV", pptx: true },
  { id: "channelMix", label: "Channel mix", short: "Channels", pptx: true },
  { id: "productThemes", label: "Product themes", short: "Products", pptx: true },
  { id: "whitespace", label: "White space", short: "Gaps", pptx: true },
  { id: "recommendedActions", label: "Recommended actions", short: "Actions", pptx: true },
  { id: "deepEvidence", label: "Analyst depth", short: "Depth" },
];

export const VIEW_PRESET_META: Record<
  DashboardViewPreset,
  { label: string; description: string; icon: string }
> = {
  essentials: {
    label: "Essentials",
    description: "80/20 — scan in 10 seconds",
    icon: "⚡",
  },
  meeting: {
    label: "Meeting",
    description: "Client-call ready narrative",
    icon: "🎯",
  },
  full: {
    label: "Full intel",
    description: "Every section expanded",
    icon: "📊",
  },
  pptx: {
    label: "Deck export",
    description: "Matches PPTX slide selection",
    icon: "📽",
  },
  custom: {
    label: "Custom",
    description: "Pick sections individually",
    icon: "✦",
  },
};

const ALL_SECTIONS = MARKET_INTEL_SECTIONS.map((s) => s.id);

const PRESET_SECTIONS: Record<Exclude<DashboardViewPreset, "custom">, MarketIntelSectionId[]> = {
  essentials: [
    "masthead",
    "watchlist",
    "kpis",
    "heroSignals",
    "competitors",
    "recommendedActions",
  ],
  meeting: [
    "masthead",
    "heroSignals",
    "weeklyChanges",
    "channelMix",
    "whitespace",
    "recommendedActions",
  ],
  full: ALL_SECTIONS,
  pptx: [
    "masthead",
    "kpis",
    "heroSignals",
    "weeklyChanges",
    "competitors",
    "channelMix",
    "productThemes",
    "whitespace",
    "recommendedActions",
  ],
};

export type DashboardViewState = {
  preset: DashboardViewPreset;
  sections: MarketIntelSectionId[];
};

export function sectionsForPreset(preset: DashboardViewPreset, custom?: MarketIntelSectionId[]): MarketIntelSectionId[] {
  if (preset === "custom") return custom?.length ? custom : PRESET_SECTIONS.essentials;
  return PRESET_SECTIONS[preset];
}

export function defaultViewState(): DashboardViewState {
  return { preset: "essentials", sections: PRESET_SECTIONS.essentials };
}

export function isSectionVisible(state: DashboardViewState, id: MarketIntelSectionId): boolean {
  return state.sections.includes(id);
}

const STORAGE_KEY = "rad-market-intel-view";

export function loadViewState(): DashboardViewState {
  if (typeof window === "undefined") return defaultViewState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultViewState();
    const parsed = JSON.parse(raw) as DashboardViewState;
    if (!parsed.preset || !Array.isArray(parsed.sections)) return defaultViewState();
    return {
      preset: parsed.preset,
      sections: sectionsForPreset(parsed.preset, parsed.sections),
    };
  } catch {
    return defaultViewState();
  }
}

export function saveViewState(state: DashboardViewState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function applyPreset(preset: DashboardViewPreset, currentCustom?: MarketIntelSectionId[]): DashboardViewState {
  const sections = sectionsForPreset(preset, currentCustom);
  return { preset, sections };
}

export function toggleSection(state: DashboardViewState, id: MarketIntelSectionId): DashboardViewState {
  const set = new Set(state.sections);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const sections = [...set];
  return { preset: "custom", sections: sections.length ? sections : [id] };
}

/** Map visible dashboard sections → PPTX module slides. */
export function sectionsToPptxModules(sections: MarketIntelSectionId[]): DataModuleId[] {
  const map: Partial<Record<MarketIntelSectionId, DataModuleId[]>> = {
    heroSignals: ["executive"],
    weeklyChanges: ["momentum"],
    competitors: ["competitors"],
    channelMix: ["momentum"],
    productThemes: ["challengers"],
    whitespace: ["whitespace"],
    recommendedActions: ["pitch"],
  };

  const out = new Set<DataModuleId>();
  for (const section of sections) {
    for (const mod of map[section] ?? []) out.add(mod);
  }
  if (!out.size) return ["executive", "competitors", "pitch"];
  return [...out];
}

/** Advertiser war-room insight sections */
export type AdvertiserInsightSectionId =
  | "marketingRead"
  | "channelMix"
  | "spend"
  | "products"
  | "messaging"
  | "audiences"
  | "gaps"
  | "nextMoves"
  | "talkingPoints";

export const ADVERTISER_INSIGHT_SECTIONS: { id: AdvertiserInsightSectionId; label: string; short: string }[] = [
  { id: "marketingRead", label: "Marketing read", short: "Read" },
  { id: "channelMix", label: "Channel mix", short: "Channels" },
  { id: "spend", label: "Spend range", short: "Spend" },
  { id: "products", label: "Products promoted", short: "Products" },
  { id: "messaging", label: "Messaging", short: "Copy" },
  { id: "audiences", label: "Audiences", short: "Demo" },
  { id: "gaps", label: "Gaps", short: "Gaps" },
  { id: "nextMoves", label: "Next moves", short: "Moves" },
  { id: "talkingPoints", label: "Talking points", short: "Talk" },
];

export type AdvertiserViewPreset = "essentials" | "pitch" | "full" | "custom";

const ADVERTISER_PRESETS: Record<Exclude<AdvertiserViewPreset, "custom">, AdvertiserInsightSectionId[]> = {
  essentials: ["marketingRead", "channelMix", "products", "nextMoves"],
  pitch: ["marketingRead", "spend", "messaging", "audiences", "nextMoves", "talkingPoints"],
  full: ADVERTISER_INSIGHT_SECTIONS.map((s) => s.id),
};

export type AdvertiserViewState = {
  preset: AdvertiserViewPreset;
  sections: AdvertiserInsightSectionId[];
};

const ADV_STORAGE_KEY = "rad-advertiser-view";

export function defaultAdvertiserViewState(): AdvertiserViewState {
  return { preset: "essentials", sections: ADVERTISER_PRESETS.essentials };
}

export function loadAdvertiserViewState(): AdvertiserViewState {
  if (typeof window === "undefined") return defaultAdvertiserViewState();
  try {
    const raw = localStorage.getItem(ADV_STORAGE_KEY);
    if (!raw) return defaultAdvertiserViewState();
    const parsed = JSON.parse(raw) as AdvertiserViewState;
    if (!parsed.preset || !Array.isArray(parsed.sections)) return defaultAdvertiserViewState();
    return parsed;
  } catch {
    return defaultAdvertiserViewState();
  }
}

export function saveAdvertiserViewState(state: AdvertiserViewState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADV_STORAGE_KEY, JSON.stringify(state));
}

export function applyAdvertiserPreset(preset: AdvertiserViewPreset): AdvertiserViewState {
  if (preset === "custom") return defaultAdvertiserViewState();
  return { preset, sections: ADVERTISER_PRESETS[preset] };
}

export function toggleAdvertiserSection(
  state: AdvertiserViewState,
  id: AdvertiserInsightSectionId,
): AdvertiserViewState {
  const set = new Set(state.sections);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return { preset: "custom", sections: [...set] };
}

export function isAdvertiserSectionVisible(state: AdvertiserViewState, id: AdvertiserInsightSectionId): boolean {
  return state.sections.includes(id);
}
