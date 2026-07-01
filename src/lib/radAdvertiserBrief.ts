/**
 * Advertiser detail insights — derived from placement rows and warroom metadata.
 * Uses flattened ad_placements / normalized_ad_placements columns only.
 */

import {
  type AdvertiserIntelWar,
  type AdvertiserPlacementRow,
  buildChannelsFromPlacements,
  hasPlacementIntel,
  isUsableText,
  normaliseChannelBadge,
  placementCount,
} from "@/lib/advertiserPlacements";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import {
  buildChannelMix,
  type BuildChannelMixInput,
  type ChannelConfidence,
  type ChannelMixResult,
} from "@/lib/channelMix";
import { ctaFromPlacement, dedupeProductLabels, isBrandLikeLabel, isMeaningfulCta } from "@/lib/placementCta";
import { isGenericCta, isSkipTagValue, isSoWhatWorthy } from "@/lib/soWhatQuality";

export type { ChannelConfidence } from "@/lib/channelMix";

export type AdvertiserChannelRow = {
  channel: string;
  pct: number;
  ads: number;
  confidence: ChannelConfidence;
};

/** @deprecated Use ChannelMixResult.source */
export type ChannelMixDataSource = "channels" | "spend_weight" | "none";

export type AdvertiserChannelMixResult = ChannelMixResult;

export type SpendBand = "Low" | "Medium" | "High" | "Very high";

const DISPLAY_CHANNELS = ["Display", "YouTube", "Search", "Meta", "TikTok", "LinkedIn", "Other"] as const;

const SPEND_BANDS: { band: SpendBand; label: string; min: number; max: number }[] = [
  { band: "Low", label: "Low (<$50k/month)", min: 0, max: 50_000 },
  { band: "Medium", label: "Medium ($50k–$250k/month)", min: 50_000, max: 250_000 },
  { band: "High", label: "High ($250k–$750k/month)", min: 250_000, max: 750_000 },
  { band: "Very high", label: "Very high ($750k+/month)", min: 750_000, max: Infinity },
];

export type WarChannelEntry = {
  channel?: string;
  name?: string;
  ad_count?: number;
  count?: number;
  pct?: number;
};

/** @deprecated Use AdvertiserIntelWar from advertiserPlacements */
export type AdvertiserWarInput = AdvertiserIntelWar;

function placements(war: AdvertiserIntelWar | null | undefined): AdvertiserPlacementRow[] {
  return war?.placements ?? war?.recent_ads ?? [];
}

function topByFrequency(
  values: (string | null | undefined)[],
  limit = 6,
): string[] {
  const counts = new Map<string, number>();
  for (const raw of values) {
    if (!isUsableText(raw)) continue;
    const label = raw.trim();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label)
    .slice(0, limit);
}

function uniqueStrings(values: (string | null | undefined)[], limit = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    if (!isUsableText(raw)) continue;
    const label = raw.trim();
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

export function warChannelEntries(war: AdvertiserIntelWar | null | undefined): WarChannelEntry[] {
  const c = war?.channels;
  if (Array.isArray(c) && c.length) {
    return c.map((entry) => ({
      channel: entry.channel,
      ad_count: entry.ad_count,
      pct: entry.pct,
    }));
  }
  return buildChannelsFromPlacements(placements(war)).map((entry) => ({
    channel: entry.channel,
    ad_count: entry.ad_count,
    pct: entry.pct,
  }));
}

export function channelByBadgeFromWar(
  war: AdvertiserIntelWar | null | undefined,
): Record<string, { pct: number; ads: number }> {
  const out: Record<string, { pct: number; ads: number }> = {};
  for (const entry of warChannelEntries(war)) {
    const badge = normaliseChannelBadge(entry.channel);
    if (!badge) continue;
    const bucket = DISPLAY_CHANNELS.includes(badge as (typeof DISPLAY_CHANNELS)[number]) ? badge : "Other";
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

function modelledFromSpendWeight(war: AdvertiserIntelWar): Record<string, { pct: number; ads: number }> {
  const by = war.spend_weight?.byChannel;
  if (!by) return {};
  const out: Record<string, { pct: number; ads: number }> = {};
  for (const [key, val] of Object.entries(by)) {
    const badge = normaliseChannelBadge(key) ?? (key === "Other" ? "Other" : null);
    if (!badge) continue;
    const pct = typeof val === "number" ? val : Number(val?.percentage ?? 0);
    const ads = typeof val === "number" ? 0 : Number(val?.adCount ?? 0);
    if (pct > 0 || ads > 0) out[badge] = { pct, ads };
  }
  return out;
}

/** Channel mix — placement → AdLibrary → warroom → estimated; always visible. */
export function buildAdvertiserChannelMix(
  war: AdvertiserIntelWar | null | undefined,
  options?: Omit<BuildChannelMixInput, "placementRows"> & { placementRows?: AdvertiserPlacementRow[] },
): AdvertiserChannelMixResult {
  const placementRows = options?.placementRows ?? placements(war);
  const warroomChannels =
    options?.warroomChannels
    ?? (Array.isArray(war?.channels) && war.channels.length ? war.channels : undefined);

  return buildChannelMix({
    placementRows,
    adlibraryRows: options?.adlibraryRows,
    warroomChannels,
  });
}

/** Directional spend band — no fake precision. */
export function buildAdvertiserSpendBand(war: AdvertiserIntelWar | null | undefined): {
  band: SpendBand | null;
  label: string | null;
  disclaimer: string;
  channelBreakdown: string | null;
} {
  const disclaimer =
    "Directional estimate from indexed activity — not invoiced media spend. Split below is share of observed placements by channel.";
  const monthly = Number(war?.spend?.est_monthly_aud ?? 0);
  const mix = buildAdvertiserChannelMix(war);
  const activeChannels = mix.rows
    .filter((r) => r.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);
  const channelBreakdown = activeChannels.length
    ? activeChannels.map((r) => `${r.channel} ${Math.round(r.pct)}%`).join(" · ")
    : null;

  if (!Number.isFinite(monthly) || monthly <= 0) {
    return { band: null, label: null, disclaimer, channelBreakdown };
  }
  const match = SPEND_BANDS.find((b) => monthly >= b.min && monthly < b.max) ?? SPEND_BANDS[SPEND_BANDS.length - 1];
  return { band: match.band, label: match.label, disclaimer, channelBreakdown };
}

/** Products and services surfaced in indexed placements. */
export function buildProductsPromoted(
  war: AdvertiserIntelWar | null | undefined,
  brand?: string | null,
): string[] {
  const rows = placements(war);
  const candidates: string[] = [];
  for (const row of rows) {
    for (const field of [row.campaign_cluster, row.normalized_product, row.product_type, row.product_category]) {
      if (!isUsableText(field)) continue;
      candidates.push(field.trim());
    }
  }
  return dedupeProductLabels(candidates, brand ?? war?.advertiser ?? war?.name, 4);
}

export type AudienceLabel = {
  label: string;
  inferred: boolean;
};

/** Audience and persona signals — explicit fields first, careful inference second. */
export function buildAudiencesPersonas(war: AdvertiserIntelWar | null | undefined): AudienceLabel[] {
  const rows = placements(war);
  const counts = new Map<string, { label: string; inferred: boolean }>();

  const add = (label: string, inferred: boolean) => {
    const key = label.toLowerCase();
    const existing = counts.get(key);
    if (!existing || (!existing.inferred && inferred)) {
      counts.set(key, { label, inferred });
    }
  };

  for (const row of rows) {
    if (isUsableText(row.product_category)) {
      add(row.product_category.trim(), false);
    }

    const corpus = [
      row.page_title,
      row.page_description,
      row.raw_copy,
      row.headline,
      row.description,
    ]
      .filter(isUsableText)
      .join(" ")
      .toLowerCase();

    if (!corpus) continue;

    if (/personal banking|everyday banking|bank accounts|credit cards/.test(corpus)) {
      add("Likely audience: Personal banking customers", true);
    }
    if (/business solutions|business banking|institutional banking|company information/.test(corpus)) {
      add("Likely audience: Business banking clients", true);
    }
    if (/home loans|mortgage|property finance/.test(corpus)) {
      add("Likely audience: Home loan prospects", true);
    }
    if (/insurance|cover\b/.test(corpus)) {
      add("Likely audience: Insurance buyers", true);
    }
    if (/savings|deposit|interest rate/.test(corpus)) {
      add("Likely audience: Savers and depositors", true);
    }
  }

  return [...counts.values()].slice(0, 6);
}

export function buildCtAs(war: AdvertiserIntelWar | null | undefined): string[] {
  const rows = placements(war);
  const brand = war?.advertiser ?? war?.name;
  return uniqueStrings(
    rows.map((row) => ctaFromPlacement(row, brand)).filter((c): c is string => Boolean(c)),
    4,
  );
}

export type SayingSection = {
  emotionalDrivers: string[];
  buyerStages: string[];
  offerTypes: string[];
  offerThemes: string[];
  offerSignals: string[];
  marketSignals: string[];
  hooks: string[];
  copySnippets: string[];
  ctas: string[];
};

/** Messaging surfaced from placement copy and strategist fields. */
export function buildWhatTheyreSaying(war: AdvertiserIntelWar | null | undefined): SayingSection {
  const rows = placements(war);
  return {
    emotionalDrivers: topByFrequency(rows.map((r) => r.emotional_driver), 4),
    buyerStages: topByFrequency(rows.map((r) => r.buyer_stage), 4),
    offerTypes: topByFrequency(rows.map((r) => r.offer_type), 4),
    offerThemes: topByFrequency(rows.map((r) => r.offer_theme), 4),
    offerSignals: topByFrequency(rows.map((r) => r.offer_signal), 4),
    marketSignals: topByFrequency(rows.map((r) => r.market_signal), 4),
    hooks: uniqueStrings(rows.map((r) => r.hook_analysis), 3),
    copySnippets: uniqueStrings(
      rows.flatMap((r) => [r.raw_copy, r.headline, r.description]),
      3,
    ),
    ctas: buildCtAs(war),
  };
}

function dominantField(rows: AdvertiserPlacementRow[], key: keyof AdvertiserPlacementRow): string | null {
  const ranked = topByFrequency(rows.map((r) => r[key] as string | null | undefined), 1);
  return ranked[0] ?? null;
}

/** One-paragraph account-director read. */
export function buildCurrentMarketingRead(
  brand: string,
  war: AdvertiserIntelWar | null | undefined,
): string {
  const rows = placements(war);
  const mix = buildAdvertiserChannelMix(war);
  const active = mix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);

  const takeaway = uniqueStrings(rows.map((r) => r.strategist_takeaway), 1)[0];
  if (takeaway) {
    const emotional = dominantField(rows, "emotional_driver");
    const stage = dominantField(rows, "buyer_stage");
    const channelNote = active.length
      ? ` Observed mix leans ${active.slice(0, 2).map((r) => `${r.channel} (${Math.round(r.pct)}%)`).join(" and ")}.`
      : "";
    const toneNote = emotional && stage
      ? ` ${emotional}-led messaging at the ${stage} stage.`
      : emotional
        ? ` ${emotional}-led messaging across the portfolio.`
        : stage
          ? ` Activity sits at the ${stage} stage.`
          : "";
    return `${takeaway}${toneNote}${channelNote}`.trim();
  }

  const hook = uniqueStrings(rows.map((r) => r.hook_analysis), 1)[0];
  const emotional = dominantField(rows, "emotional_driver");
  const stage = dominantField(rows, "buyer_stage");

  if (hook || emotional || active.length) {
    const channelPhrase = active.length
      ? active.slice(0, 2).map((r) => `${r.channel} (${Math.round(r.pct)}%)`).join(" and ")
      : "a narrow set of channels";
    const messageLead = hook
      ? hook
      : emotional
        ? `${brand} is running ${emotional.toLowerCase()}-led creative`
        : `${brand} has active placements indexed`;
    const stageNote = stage ? ` at the ${stage} stage` : "";
    return `${messageLead}${stageNote}, concentrated on ${channelPhrase}.`;
  }

  if (!hasPlacementIntel(war)) {
    return `${brand} has no indexed placements yet. Run a scan to pick up live ads.`;
  }

  return `${brand} has indexed placements but limited strategist copy on file. Channel mix and product fields below reflect stored rows.`;
}

/** Gaps an account director can act on — channel coverage only. */
export function buildWhatTheyreMissing(
  brand: string,
  war: AdvertiserIntelWar | null | undefined,
): string[] {
  const gaps: string[] = [];
  const mix = buildAdvertiserChannelMix(war);
  const byChannel = Object.fromEntries(mix.rows.map((r) => [r.channel, r]));
  const rowCount = placementCount(war);

  if (!rowCount) {
    return ["No channel coverage indexed yet — run a scan to map where they are active."];
  }

  if ((byChannel.Search?.pct ?? 0) < 5 && (byChannel.Search?.ads ?? 0) < 2) {
    gaps.push("Limited Search coverage — little visible demand-capture pressure.");
  }
  if ((byChannel.Meta?.pct ?? 0) < 10 && (byChannel.Meta?.ads ?? 0) < 2) {
    gaps.push("Low Meta share relative to other indexed channels.");
  }
  if ((byChannel.YouTube?.pct ?? 0) <= 0 && (byChannel.YouTube?.ads ?? 0) <= 0) {
    gaps.push("No YouTube placements in the indexed set.");
  }
  if ((byChannel.TikTok?.pct ?? 0) <= 0 && (byChannel.TikTok?.ads ?? 0) <= 0) {
    gaps.push("No TikTok placements in the indexed set.");
  }
  if ((byChannel.Display?.pct ?? 0) < 5 && (byChannel.Display?.ads ?? 0) < 2) {
    gaps.push("Thin Display coverage across observed placements.");
  }

  const topPct = Math.max(...mix.rows.map((r) => r.pct), 0);
  if (topPct >= 65) {
    const dominant = mix.rows.find((r) => r.pct === topPct)?.channel;
    if (dominant) gaps.push(`Heavy concentration on ${dominant} (${Math.round(topPct)}% of indexed placements).`);
  }

  if (!gaps.length) {
    gaps.push(`${brand} shows breadth across indexed channels — whitespace is in offer and message differentiation, not distribution.`);
  }

  return gaps.slice(0, 5);
}

/** Drop stub strategist lines (e.g. "Protect against Westpac" with no detail). */
function isSubstantiveMove(text: string): boolean {
  const s = text.trim();
  if (!s) return false;
  if (s.length < 48) return false;
  if (/^(protect|counter|defend)\s+(against\s+)?[a-z0-9.-]+\.?$/i.test(s)) return false;
  return s.split(/\s+/).length >= 8;
}

/** Three concrete advertiser-level recommendations. */
export function buildAdvertiserRecommendedMoves(
  brand: string,
  war: AdvertiserIntelWar | null | undefined,
  strategist?: AdvertiserStrategistIntel | null,
): string[] {
  const mix = buildAdvertiserChannelMix(war);
  const topChannel = mix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct)[0]?.channel ?? "Search";
  const gaps = buildWhatTheyreMissing(brand, war);
  const rows = placements(war);
  const moves: string[] = [];

  if (strategist?.recommendation && isSubstantiveMove(strategist.recommendation)) {
    moves.push(strategist.recommendation);
  }
  if (strategist?.narrativeGap) {
    const clause = strategist.narrativeGap.split(/[.!?]/)[0]?.trim();
    if (clause && isSubstantiveMove(clause)) {
      moves.push(`Close the narrative gap: ${clause}.`);
    }
  }
  if (strategist?.positioningArchetype) {
    moves.push(
      `Position against their ${strategist.positioningArchetype.toLowerCase()} play — own an adjacent emotional territory with proof-led creative.`,
    );
  }

  const takeaway = uniqueStrings(rows.map((r) => r.strategist_takeaway), 1)[0];
  if (takeaway) {
    const trimmed = takeaway.split(/[.!?]/)[0]?.trim();
    if (trimmed && isSubstantiveMove(trimmed)) {
      moves.push(`Act on strategist read: ${trimmed}.`);
    }
  }

  const byChannel = Object.fromEntries(mix.rows.map((r) => [r.channel, r]));
  const weakest = ["YouTube", "TikTok", "Search", "Meta", "Display"]
    .map((channel) => ({ channel, row: byChannel[channel] }))
    .filter(({ row }) => (row?.ads ?? 0) <= 0 && (row?.pct ?? 0) <= 0);
  if (weakest.length) {
    moves.push(
      `Test ${weakest[0].channel} while ${brand} under-indexes it — ${gaps[0] ?? "competitors may own that channel"}.`,
    );
  } else if (gaps[0]) {
    moves.push(`Counter their gap: ${gaps[0].replace(/^Limited |^Low |^No /, "Own ")}`);
  }

  const emotional = dominantField(rows, "emotional_driver");
  if (emotional) {
    moves.push(
      `Build a challenger ${emotional.toLowerCase()}-led execution on ${topChannel} with a clearer CTA than their current portfolio.`,
    );
  } else {
    moves.push(
      `Review ${topChannel} and Search coverage for key competitors before deciding whether to defend or attack those channels.`,
    );
  }

  return [...new Set(moves.filter(isSubstantiveMove))].slice(0, 3);
}

/** Bullets for tomorrow's client meeting. */
export function buildMeetingTalkingPoints(
  brand: string,
  war: AdvertiserIntelWar | null | undefined,
  strategist?: AdvertiserStrategistIntel | null,
): string[] {
  const points: string[] = [];

  const pushIfUsable = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (!t || t.length < 24) return;
    if (isSkipTagValue(t) || /unknown/i.test(t)) return;
    if (isBrandLikeLabel(t, brand)) return;
    if (/^cta pattern:/i.test(t) && isGenericCta(t.replace(/^cta pattern:\s*/i, ""))) return;
    if (strategist?.strategistSummary && t === strategist.strategistSummary && !isSoWhatWorthy(t)) return;
    if (!points.some((p) => p.toLowerCase() === t.toLowerCase())) points.push(t);
  };

  if (strategist?.strategistSummary && isSoWhatWorthy(strategist.strategistSummary)) {
    pushIfUsable(strategist.strategistSummary);
  }
  if (strategist?.narrativeGap && !/unknown/i.test(strategist.narrativeGap)) {
    pushIfUsable(`Narrative gap: ${strategist.narrativeGap}`);
  }

  const mix = buildAdvertiserChannelMix(war);
  const saying = buildWhatTheyreSaying(war);
  const products = buildProductsPromoted(war, brand);
  const rows = placements(war);
  const takeaway = uniqueStrings(rows.map((r) => r.strategist_takeaway), 1)[0];

  const topChannels = mix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 2);
  if (topChannels.length) {
    pushIfUsable(
      `${brand} indexed activity splits ${topChannels.map((c) => `${c.channel} (${Math.round(c.pct)}%)`).join(" and ")} across ${placementCount(war)} deduped creatives.`,
    );
  }

  if (products.length) {
    pushIfUsable(`Lead products in market: ${products.slice(0, 3).join(", ")}.`);
  }

  const meaningfulCtas = saying.ctas.filter((c) => isMeaningfulCta(c, brand));
  if (meaningfulCtas.length) {
    pushIfUsable(`Action prompts on ads: ${meaningfulCtas.slice(0, 2).join(" · ")}.`);
  } else if (saying.emotionalDrivers.length) {
    pushIfUsable(`Dominant message theme: ${saying.emotionalDrivers[0]} — CTAs are mostly soft/generic in indexed copy.`);
  }

  if (takeaway && isSoWhatWorthy(takeaway)) {
    pushIfUsable(takeaway.split(/[.!?]/)[0] + ".");
  } else if (saying.hooks[0] && !isBrandLikeLabel(saying.hooks[0], brand)) {
    pushIfUsable(saying.hooks[0]);
  }

  if (!points.length && hasPlacementIntel(war)) {
    points.push(
      `${brand}: ${placementCount(war)} creatives indexed — open with channel mix and product focus before recommending new channels.`,
    );
  }

  return points.slice(0, 5);
}
