/**
 * Advertiser detail insights — derived from existing warroom data only.
 */

import { territoryNounPhrase } from "@/lib/radInsightTranslator";

export type ChannelConfidence = "Observed" | "Modelled" | "Partial coverage" | "No signal detected";

export type AdvertiserChannelRow = {
  channel: string;
  pct: number;
  ads: number;
  confidence: ChannelConfidence;
};

export type ChannelMixDataSource = "channels" | "spend_weight" | "none";

export type AdvertiserChannelMixResult = {
  rows: AdvertiserChannelRow[];
  overallConfidence: ChannelConfidence;
  available: boolean;
  sourceLabel: string;
  estimationTooltip: string;
  dataSource: ChannelMixDataSource;
};

export type SpendBand = "Low" | "Medium" | "High" | "Very high";

const DISPLAY_CHANNELS = ["Display", "YouTube", "Search", "Meta", "TikTok", "Other"] as const;

const SPEND_BANDS: { band: SpendBand; label: string; min: number; max: number }[] = [
  { band: "Low", label: "Low — <$50k/month", min: 0, max: 50_000 },
  { band: "Medium", label: "Medium — $50k–$250k/month", min: 50_000, max: 250_000 },
  { band: "High", label: "High — $250k–$750k/month", min: 250_000, max: 750_000 },
  { band: "Very high", label: "Very high — $750k+/month", min: 750_000, max: Infinity },
];

export type WarChannelEntry = {
  channel?: string;
  name?: string;
  ad_count?: number;
  count?: number;
  pct?: number;
};

export type AdvertiserWarInput = {
  channels?: unknown;
  spend?: { est_monthly_aud?: number; spend_confidence?: string } | null;
  spend_weight?: {
    byChannel?: Record<string, { percentage?: number; adCount?: number; spend?: number } | number>;
  };
  top_themes?: ({ theme: string; count?: number; pct?: number } | string)[];
  themes?: { theme: string; count?: number }[];
  top_cta?: string | null;
  total_ads?: number;
  creative_fatigue?: {
    score?: number;
    portfolioFatigueScore?: number;
    fatigueLabel?: string;
    needsRefresh?: number;
    fatigued?: number;
    fresh?: number;
  };
  recent_ads?: { ai_tags?: Record<string, unknown> | string | null }[];
};

function normaliseBadge(ch: unknown): string | null {
  const r = String(ch ?? "").toLowerCase();
  if (!r) return null;
  if (r.includes("youtube")) return "YouTube";
  if (r.includes("search")) return "Search";
  if (r.includes("display") || r.includes("programmatic")) return "Display";
  if (r.includes("meta") || r.includes("facebook") || r.includes("instagram")) return "Meta";
  if (r.includes("tiktok")) return "TikTok";
  if (r.includes("linkedin") || r.includes("programmatic")) return "Other";
  return "Other";
}

export function warChannelEntries(war: AdvertiserWarInput | null | undefined): WarChannelEntry[] {
  const c = war?.channels;
  if (Array.isArray(c) && c.length && typeof c[0] === "object") return c as WarChannelEntry[];
  return [];
}

export function channelByBadgeFromWar(
  war: AdvertiserWarInput | null | undefined,
): Record<string, { pct: number; ads: number }> {
  const out: Record<string, { pct: number; ads: number }> = {};
  for (const entry of warChannelEntries(war)) {
    const badge = normaliseBadge(entry.channel ?? entry.name);
    if (!badge) continue;
    const target = badge === "Display" ? "Display" : badge;
    const bucket = DISPLAY_CHANNELS.includes(target as (typeof DISPLAY_CHANNELS)[number]) ? target : "Other";
    const ads = Number(entry.ad_count ?? entry.count ?? 0);
    const pct = Number(entry.pct ?? 0);
    const existing = out[bucket];
    if (existing) {
      existing.ads += ads;
      if (entry.pct != null) existing.pct += pct;
    } else {
      out[bucket] = { pct, ads };
    }
  }
  return out;
}

function modelledFromSpendWeight(war: AdvertiserWarInput): Record<string, { pct: number; ads: number }> {
  const by = war.spend_weight?.byChannel;
  if (!by) return {};
  const out: Record<string, { pct: number; ads: number }> = {};
  for (const [key, val] of Object.entries(by)) {
    const badge = normaliseBadge(key) ?? (key === "Other" ? "Other" : null);
    if (!badge) continue;
    const pct = typeof val === "number" ? val : Number(val?.percentage ?? 0);
    const ads = typeof val === "number" ? 0 : Number(val?.adCount ?? 0);
    if (pct > 0 || ads > 0) out[badge] = { pct, ads };
  }
  return out;
}

function channelMixSourceMeta(
  dataSource: ChannelMixDataSource,
  overallConfidence: ChannelConfidence,
): { sourceLabel: string; estimationTooltip: string } {
  if (dataSource === "channels") {
    return {
      sourceLabel: "Observed ad counts",
      estimationTooltip:
        "Channel share is the percentage of indexed ads attributed to each platform from your latest warroom scan. Percentages sum from observed ad counts per channel.",
    };
  }
  if (dataSource === "spend_weight") {
    return {
      sourceLabel: "Modelled spend weights",
      estimationTooltip:
        "Direct ad-count splits were unavailable. Shares are estimated from spend-weight signals across channels and should be treated as directional.",
    };
  }
  return {
    sourceLabel: "No indexed placements",
    estimationTooltip: "Run a scan to index live placements before channel mix can be estimated.",
  };
}

/** Estimated channel mix with per-row confidence. */
export function buildAdvertiserChannelMix(
  war: AdvertiserWarInput | null | undefined,
): AdvertiserChannelMixResult {
  if (!war) {
    const meta = channelMixSourceMeta("none", "No signal detected");
    return {
      rows: [],
      overallConfidence: "No signal detected",
      available: false,
      sourceLabel: meta.sourceLabel,
      estimationTooltip: meta.estimationTooltip,
      dataSource: "none",
    };
  }

  const observed = channelByBadgeFromWar(war);
  const hasObserved = Object.values(observed).some((r) => r.pct > 0 || r.ads > 0);
  const modelled = hasObserved ? {} : modelledFromSpendWeight(war);
  const source = hasObserved ? observed : modelled;
  const dataSource: ChannelMixDataSource = hasObserved
    ? "channels"
    : Object.keys(modelled).length
      ? "spend_weight"
      : "none";
  const rowConfidence: ChannelConfidence = hasObserved
    ? "Observed"
    : Object.keys(modelled).length
      ? "Modelled"
      : "No signal detected";

  const rows: AdvertiserChannelRow[] = DISPLAY_CHANNELS.map((channel) => {
    const data = source[channel];
    const pct = data?.pct ?? 0;
    const ads = data?.ads ?? 0;
    let confidence: ChannelConfidence = "No signal detected";
    if (pct > 0 || ads > 0) {
      confidence = rowConfidence === "Modelled" ? "Modelled" : "Observed";
    }
    return { channel, pct, ads, confidence };
  });

  const activeCount = rows.filter((r) => r.pct > 0 || r.ads > 0).length;
  const totalAds = Number(war.total_ads ?? 0);
  let overallConfidence = rowConfidence;
  if (rowConfidence !== "No signal detected" && (activeCount < 3 || totalAds < 5)) {
    overallConfidence = "Partial coverage";
  }

  const available = rows.some((r) => r.pct > 0 || r.ads > 0);
  const meta = channelMixSourceMeta(dataSource, overallConfidence);
  let estimationTooltip = meta.estimationTooltip;
  if (overallConfidence === "Partial coverage") {
    estimationTooltip +=
      " Coverage is limited — fewer than five indexed ads or fewer than three active channels.";
  }

  return {
    rows,
    overallConfidence,
    available,
    sourceLabel: meta.sourceLabel,
    estimationTooltip,
    dataSource,
  };
}

/** Directional spend band — no fake precision. */
export function buildAdvertiserSpendBand(war: AdvertiserWarInput | null | undefined): {
  band: SpendBand | null;
  label: string | null;
  disclaimer: string;
} {
  const disclaimer = "Directional range from observed activity — not verified media spend.";
  const monthly = Number(war?.spend?.est_monthly_aud ?? 0);
  if (!Number.isFinite(monthly) || monthly <= 0) {
    return { band: null, label: null, disclaimer };
  }
  const match = SPEND_BANDS.find((b) => monthly >= b.min && monthly < b.max) ?? SPEND_BANDS[SPEND_BANDS.length - 1];
  return { band: match.band, label: match.label, disclaimer };
}

function extractThemes(war: AdvertiserWarInput | null | undefined): string[] {
  if (!war) return [];
  const fromObjects = (war.themes ?? []).map((t) => t.theme).filter(Boolean);
  if (fromObjects.length) return fromObjects;
  const fromTop = (war.top_themes ?? []).map((t) => (typeof t === "string" ? t : t.theme)).filter(Boolean);
  return fromTop;
}

function humanizeTheme(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (["trust", "curiosity", "greed", "aspiration", "fear", "belonging"].includes(key)) {
    return territoryNounPhrase(key);
  }
  if (key === "savings") return "value and savings";
  return key.replace(/_/g, " ");
}

function collectOffers(war: AdvertiserWarInput | null | undefined): string[] {
  const offers = new Set<string>();
  for (const ad of war?.recent_ads ?? []) {
    const tags = typeof ad.ai_tags === "string"
      ? (() => { try { return JSON.parse(ad.ai_tags) as Record<string, unknown>; } catch { return {}; } })()
      : (ad.ai_tags ?? {});
    for (const key of ["finance_offer", "offer", "promotion"]) {
      const v = tags[key];
      if (typeof v === "string" && v.trim() && !v.includes("{{")) offers.add(v.trim());
    }
  }
  return [...offers].slice(0, 4);
}

function collectCtas(war: AdvertiserWarInput | null | undefined): string[] {
  const ctas = new Set<string>();
  if (war?.top_cta?.trim()) ctas.add(war.top_cta.trim());
  for (const ad of war?.recent_ads ?? []) {
    const tags = typeof ad.ai_tags === "string"
      ? (() => { try { return JSON.parse(ad.ai_tags) as Record<string, unknown>; } catch { return {}; } })()
      : (ad.ai_tags ?? {});
    const cta = tags.call_to_action;
    if (typeof cta === "string" && cta.trim()) ctas.add(cta.trim());
  }
  return [...ctas].slice(0, 4);
}

function collectAudienceSignals(war: AdvertiserWarInput | null | undefined): string[] {
  const signals = new Set<string>();
  for (const ad of war?.recent_ads ?? []) {
    const tags = typeof ad.ai_tags === "string"
      ? (() => { try { return JSON.parse(ad.ai_tags) as Record<string, unknown>; } catch { return {}; } })()
      : (ad.ai_tags ?? {});
    const demo = tags.demographics;
    if (Array.isArray(demo)) {
      for (const d of demo) if (typeof d === "string" && d.trim()) signals.add(d.trim());
    }
    if (tags.australian_context === true) signals.add("Australian market context");
    const platforms = tags.publisher_platforms;
    if (Array.isArray(platforms)) {
      for (const p of platforms) if (typeof p === "string") signals.add(`${p} placements`);
    }
  }
  return [...signals].slice(0, 5);
}

/** One-paragraph account-director read. */
export function buildCurrentMarketingRead(
  brand: string,
  war: AdvertiserWarInput | null | undefined,
): string {
  const mix = buildAdvertiserChannelMix(war);
  const active = mix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
  const themes = extractThemes(war).map(humanizeTheme);

  if (!active.length && !themes.length) {
    return `${brand} has limited indexed activity so far. Run another scan as more placements are picked up.`;
  }

  const channelPhrase = active.length
    ? active.slice(0, 2).map((r) => `${r.channel} (${Math.round(r.pct)}%)`).join(" and ")
    : "a narrow set of channels";

  const themePhrase = themes.length
    ? themes.slice(0, 2).join(" and ")
    : "general brand messaging";

  const awarenessLed = active.some((r) => r.channel === "YouTube" || r.channel === "Display")
    && !active.some((r) => r.channel === "Search" || r.channel === "Meta");

  const strategyNote = awarenessLed
    ? "Activity appears more awareness-led than direct acquisition."
    : active.some((r) => r.channel === "Search" || r.channel === "Meta")
      ? "The mix balances brand reach with demand-capture channels."
      : "Channel strategy is still forming as more ads are indexed.";

  return (
    `${brand} is leaning heavily into ${channelPhrase} activity, with messaging focused on ${themePhrase}. ${strategyNote}`
  );
}

export type SayingSection = {
  themes: string[];
  offers: string[];
  ctas: string[];
  audienceSignals: string[];
};

export function buildWhatTheyreSaying(war: AdvertiserWarInput | null | undefined): SayingSection {
  return {
    themes: extractThemes(war).map(humanizeTheme).slice(0, 8),
    offers: collectOffers(war),
    ctas: collectCtas(war),
    audienceSignals: collectAudienceSignals(war),
  };
}

/** Gaps an account director can act on. */
export function buildWhatTheyreMissing(
  brand: string,
  war: AdvertiserWarInput | null | undefined,
): string[] {
  if (!war) return ["Not enough indexed activity to identify gaps yet."];

  const gaps: string[] = [];
  const mix = buildAdvertiserChannelMix(war);
  const byChannel = Object.fromEntries(mix.rows.map((r) => [r.channel, r]));

  if ((byChannel.Search?.pct ?? 0) < 5 && (byChannel.Search?.ads ?? 0) < 5) {
    gaps.push("Limited Search activity — little visible demand-capture pressure.");
  }
  if ((byChannel.Meta?.pct ?? 0) < 10 && (byChannel.Meta?.ads ?? 0) < 8) {
    gaps.push("Little Meta activity relative to upper-funnel channels.");
  }
  if ((byChannel.TikTok?.pct ?? 0) <= 0) {
    gaps.push("No meaningful TikTok presence in observed placements.");
  }

  const themes = extractThemes(war);
  if (themes.length <= 2) {
    gaps.push("Concentrated messaging — few distinct themes across the portfolio.");
  }

  const fatigueScore = Number(
    war.creative_fatigue?.portfolioFatigueScore ?? war.creative_fatigue?.score ?? 0,
  );
  const fatigued = Number(war.creative_fatigue?.fatigued ?? war.creative_fatigue?.needsRefresh ?? 0);
  if (fatigueScore >= 50 || fatigued >= 5) {
    gaps.push("Stale creative rotation — several ads show fatigue or long run times.");
  }

  const topPct = Math.max(...mix.rows.map((r) => r.pct), 0);
  if (topPct >= 60) {
    const dominant = mix.rows.find((r) => r.pct === topPct)?.channel;
    if (dominant) gaps.push(`Heavy channel concentration on ${dominant} — limited diversification.`);
  }

  if (!gaps.length) {
    gaps.push(`${brand} is active across multiple channels with varied messaging — gaps are in differentiation, not distribution.`);
  }

  return gaps.slice(0, 5);
}

/** Three concrete advertiser-level recommendations. */
export function buildAdvertiserRecommendedMoves(
  brand: string,
  war: AdvertiserWarInput | null | undefined,
): string[] {
  const mix = buildAdvertiserChannelMix(war);
  const byChannel = Object.fromEntries(mix.rows.map((r) => [r.channel, r]));
  const moves: string[] = [];

  if ((byChannel.Search?.pct ?? 0) < 10) {
    moves.push(`Test Search capture while ${brand} leans on ${byChannel.Display?.pct ? "Display" : "upper-funnel"} activity — competitors may own demand moments they are not defending.`);
  } else {
    moves.push(`Test discovery-led messaging against ${brand}'s trust-led control creative.`);
  }

  if ((byChannel.Meta?.pct ?? 0) < 15) {
    moves.push("Build one offer-led Meta execution around value, savings, or everyday banking benefits.");
  } else {
    moves.push("Build one offer-led execution around value, savings, or everyday banking benefits.");
  }

  moves.push("Review Meta and Search coverage for key competitors before deciding whether to defend or attack those channels.");

  return moves.slice(0, 3);
}

/** Bullets for tomorrow's client meeting. */
export function buildMeetingTalkingPoints(
  brand: string,
  war: AdvertiserWarInput | null | undefined,
): string[] {
  const read = buildCurrentMarketingRead(brand, war);
  const mix = buildAdvertiserChannelMix(war);
  const spend = buildAdvertiserSpendBand(war);
  const saying = buildWhatTheyreSaying(war);
  const gaps = buildWhatTheyreMissing(brand, war);

  const topChannels = mix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 2);
  const channelNote = topChannels.length
    ? `${brand} is putting most observed activity into ${topChannels.map((c) => c.channel).join(" and ")}.`
    : `Channel mix for ${brand} is still thin — treat reads as directional.`;

  const points = [
    read.split(".")[0] + ".",
    channelNote,
  ];

  if (saying.themes.length) {
    points.push(`Messaging keeps returning to ${saying.themes.slice(0, 2).join(" and ")} — ${brand} is not yet owning a distinctive message.`);
  }

  if (spend.label) {
    points.push(`Directional spend sits in the ${spend.band ?? "estimated"} range — useful for scale context, not budget sign-off.`);
  }

  if (gaps[0]) {
    points.push(gaps[0]);
  }

  points.push(`Recommended test: discovery-led messaging with a clear offer and channel-specific execution.`);

  return points.slice(0, 5);
}
