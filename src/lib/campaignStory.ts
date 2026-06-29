/**
 * Campaign Story — top-of-page executive summary + campaign table.
 * Uses normalized_ad_placements rows only. No new APIs.
 */

import type { AdvertiserIntelWar, AdvertiserPlacementRow } from "@/lib/advertiserPlacements";
import { normaliseChannelBadge, placementCount } from "@/lib/advertiserPlacements";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import { buildCampaignGroups } from "@/lib/campaignIntelligence";

const MS_PER_DAY = 86_400_000;
const RECENT_DAYS = 7;

function placements(war: AdvertiserIntelWar | null | undefined): AdvertiserPlacementRow[] {
  return war?.placements ?? war?.recent_ads ?? [];
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function daysAgo(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function isRecent(iso?: string | null): boolean {
  const d = daysAgo(iso);
  return d != null && d <= RECENT_DAYS;
}

function topValue(
  rows: AdvertiserPlacementRow[],
  picker: (r: AdvertiserPlacementRow) => string | null | undefined,
  fallback = "—",
): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = picker(row)?.trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? fallback;
}

function channelMix(placements: AdvertiserPlacementRow[]): { channel: string; pct: number }[] {
  const counts = new Map<string, number>();
  for (const row of placements) {
    const ch = normaliseChannelBadge(row.channel_platform ?? row.channel) ?? "Other";
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  const total = placements.length || 1;
  return [...counts.entries()]
    .map(([channel, count]) => ({ channel, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

function dominantForGroup(rows: AdvertiserPlacementRow[], picker: (r: AdvertiserPlacementRow) => string | null | undefined): string {
  return topValue(rows, picker, "—");
}

function productLabel(row: AdvertiserPlacementRow): string {
  return row.product_type?.trim() || row.normalized_product?.trim() || "—";
}

export type CampaignStoryTableRow = {
  campaign: string;
  product: string;
  firstSeen: string;
  lastSeen: string;
  channels: string;
  message: string;
  offerSignal: string;
  marketSignal: string;
  cta: string;
  strategistTakeaway: string;
  creatives: number;
};

export type CampaignStoryQuickAnswers = {
  whatDoing: string;
  whereSpending: string;
  whatSaying: string;
  whatChanged: string;
  clientShouldDo: string;
};

export type CampaignStory = {
  rowCount: number;
  available: boolean;
  executiveSummary: string;
  quickAnswers: CampaignStoryQuickAnswers;
  table: CampaignStoryTableRow[];
};

export function buildCampaignStory(
  brand: string,
  war: AdvertiserIntelWar | null | undefined,
  strategist?: AdvertiserStrategistIntel | null,
): CampaignStory {
  const rows = placements(war);
  const rowCount = placementCount(war);
  const emptyAnswers: CampaignStoryQuickAnswers = {
    whatDoing: "No indexed campaigns yet.",
    whereSpending: "—",
    whatSaying: "—",
    whatChanged: "—",
    clientShouldDo: "Run a scan to index placements before pitching.",
  };

  if (!rowCount) {
    return {
      rowCount: 0,
      available: false,
      executiveSummary: `${brand} has no indexed placement rows available from the browser client yet.`,
      quickAnswers: emptyAnswers,
      table: [],
    };
  }

  const groups = buildCampaignGroups(rows);
  const lead = groups[0];
  const secondary = groups[1];
  const channels = channelMix(rows);
  const topChannel = channels[0];
  const secondChannel = channels[1];
  const emotion = topValue(rows, (r) => r.emotional_driver, "mixed messaging");
  const cta = topValue(rows, (r) => r.primary_cta, "soft brand-led asks");
  const takeaway = lead?.summary ?? topValue(rows, (r) => r.strategist_takeaway, "");

  const newCreatives = rows.filter((r) => isRecent(r.first_seen)).length;
  const refreshed = groups.filter((g) => g.firstSeen && !isRecent(g.firstSeen) && isRecent(g.lastSeen)).length;
  const gapChannels = ["Display", "YouTube", "Search", "Meta", "TikTok", "Other"].filter(
    (ch) => !channels.some((c) => c.channel === ch),
  );

  const campaignNames = groups.slice(0, 3).map((g) => g.key).join(", ");
  const channelPhrase = topChannel
    ? secondChannel
      ? `${topChannel.channel} (${topChannel.pct}%) and ${secondChannel.channel} (${secondChannel.pct}%)`
      : `${topChannel.channel} (${topChannel.pct}%)`
    : "a narrow set of channels";

  const whatDoing = lead
    ? `${brand} is actively running ${groups.length} campaign line${groups.length === 1 ? "" : "s"}, led by ${lead.key} (${lead.creativeCount} creatives${secondary ? `, then ${secondary.key}` : ""}).`
    : `${brand} has ${rowCount} indexed placements without a clear campaign split.`;

  const whereSpending = `Most observed spend is on ${channelPhrase}.`;

  const whatSaying = `Messaging is ${emotion.toLowerCase()}-led${cta !== "—" && cta !== "soft brand-led asks" ? `, asking consumers to "${cta}"` : ", with light direct-response pressure"}.`;

  let whatChanged: string;
  if (newCreatives > 0) {
    whatChanged = `${newCreatives} new creative${newCreatives === 1 ? "" : "s"} landed in the last ${RECENT_DAYS} days${refreshed ? ` and ${refreshed} existing campaign${refreshed === 1 ? "" : "s"} were refreshed` : ""}.`;
  } else if (war?.ads_this_week && war.ads_this_week > 0) {
    whatChanged = `Warroom shows ${war.ads_this_week} new ad${war.ads_this_week === 1 ? "" : "s"} this week — they are still investing.`;
  } else {
    whatChanged = "No new creatives in the last 7 days — activity looks steady, not escalating.";
  }

  const gapNote = gapChannels.length
    ? `test ${gapChannels.slice(0, 2).join(" and ")} where ${brand} is not visible`
    : "out-message them on their lead channels";
  const clientShouldDo = strategist?.recommendation
    ?? (lead
      ? `Counter ${lead.key} with a fresher ${emotion.toLowerCase()} execution and ${gapNote}.`
      : `Build a challenger story on ${topChannel?.channel ?? "their lead channel"} before the next client meeting.`);

  const summaryLead = strategist?.strategistSummary ?? strategist?.strategySummary;
  const executiveParts = [
    summaryLead ?? whatDoing.replace(/\.$/, ""),
    whereSpending.replace(/\.$/, ""),
    whatSaying.replace(/\.$/, ""),
    whatChanged.replace(/\.$/, ""),
    !summaryLead && takeaway ? `Strategist read: ${takeaway.replace(/\.$/, "")}` : null,
    strategist?.narrativeGap ? `Narrative gap: ${strategist.narrativeGap.replace(/\.$/, "")}` : null,
    clientShouldDo.replace(/\.$/, ""),
  ].filter(Boolean);
  const executiveSummary = executiveParts.join(". ") + ".";

  const table: CampaignStoryTableRow[] = groups.slice(0, 8).map((g) => ({
    campaign: g.key,
    product: dominantForGroup(g.rows, (r) => r.product_type || r.normalized_product),
    firstSeen: fmtDate(g.firstSeen),
    lastSeen: fmtDate(g.lastSeen),
    channels: g.channels.length ? g.channels.join(", ") : "—",
    message: dominantForGroup(g.rows, (r) => r.emotional_driver),
    offerSignal: dominantForGroup(g.rows, (r) => r.offer_signal),
    marketSignal: dominantForGroup(g.rows, (r) => r.market_signal),
    cta: dominantForGroup(g.rows, (r) => r.primary_cta),
    strategistTakeaway: g.summary ?? "—",
    creatives: g.creativeCount,
  }));

  return {
    rowCount,
    available: true,
    executiveSummary,
    quickAnswers: { whatDoing, whereSpending, whatSaying, whatChanged, clientShouldDo },
    table,
  };
}
