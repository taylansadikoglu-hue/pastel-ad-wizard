/**
 * Campaign Intelligence — derived from normalized_ad_placements rows + warroom metadata.
 * No new APIs. Plain-English outputs for account directors.
 */

import type { AdvertiserIntelWar, AdvertiserPlacementRow } from "@/lib/advertiserPlacements";
import { normaliseChannelBadge, placementCount } from "@/lib/advertiserPlacements";
import {
  campaignGroupKey,
  formatObservedDate,
  mergeDistributionRows,
  normalizeCampaignLabel,
  normalizeCtaLabel,
} from "@/lib/dataTrust";
import { ctaFromPlacement } from "@/lib/placementCta";

const MS_PER_DAY = 86_400_000;
const RECENT_DAYS = 7;
const FATIGUE_DAYS = 60;

function rows(war: AdvertiserIntelWar | null | undefined): AdvertiserPlacementRow[] {
  return war?.placements ?? war?.recent_ads ?? [];
}

function parseTime(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function fmtShortDate(iso?: string | null): string {
  return formatObservedDate(iso) ?? "—";
}

function daysAgo(iso?: string | null): number | null {
  const t = parseTime(iso);
  if (t == null) return null;
  return Math.floor((Date.now() - t) / MS_PER_DAY);
}

function isRecent(iso?: string | null, withinDays = RECENT_DAYS): boolean {
  const d = daysAgo(iso);
  return d != null && d <= withinDays;
}

function usableLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (["other", "unknown", "unclassified", "none"].includes(v.toLowerCase())) return null;
  return v;
}

function campaignKey(row: AdvertiserPlacementRow): string {
  const raw =
    usableLabel(row.campaign_cluster)
    ?? usableLabel(row.product_type)
    ?? usableLabel(row.normalized_product)
    ?? "General activity";
  return normalizeCampaignLabel(raw);
}

function normalizeEmotionLabel(raw: string): string | null {
  const t = raw.trim();
  if (!t || /^(unspecified|unknown|other|none)$/i.test(t)) return null;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function campaignSummary(row: AdvertiserPlacementRow): string | null {
  const takeaway = row.strategist_takeaway?.trim();
  if (takeaway) return takeaway.split(/[.!?]/)[0] + ".";
  const market = row.market_signal?.trim();
  if (market) return market.split(/[.!?]/)[0] + ".";
  const offer = row.offer_signal?.trim();
  if (offer) return offer.split(/[.!?]/)[0] + ".";
  const hook = row.hook_analysis?.trim();
  if (hook) return hook.split(/[.!?]/)[0] + ".";
  return null;
}

export type CampaignGroup = {
  key: string;
  rows: AdvertiserPlacementRow[];
  firstSeen: string | null;
  lastSeen: string | null;
  channels: string[];
  creativeCount: number;
  summary: string | null;
  daysRunning: number | null;
};

export function buildCampaignGroups(placements: AdvertiserPlacementRow[]): CampaignGroup[] {
  const map = new Map<string, { displayKey: string; rows: AdvertiserPlacementRow[] }>();
  for (const row of placements) {
    const displayKey = campaignKey(row);
    const gkey = campaignGroupKey(displayKey);
    const bucket = map.get(gkey) ?? { displayKey, rows: [] };
    bucket.rows.push(row);
    map.set(gkey, bucket);
  }

  return [...map.entries()]
    .map(([, { displayKey, rows: groupRows }]) => {
      const times = groupRows
        .flatMap((r) => [parseTime(r.first_seen), parseTime(r.last_seen)])
        .filter((t): t is number => t != null);
      const firstSeen = times.length ? new Date(Math.min(...times)).toISOString() : null;
      const lastSeen = times.length ? new Date(Math.max(...times)).toISOString() : null;
      const channelSet = new Set<string>();
      for (const r of groupRows) {
        const ch = normaliseChannelBadge(r.channel_platform ?? r.channel);
        if (ch) channelSet.add(ch);
      }
      const summaries = groupRows.map(campaignSummary).filter(Boolean) as string[];
      const daysRunning =
        firstSeen != null ? Math.max(1, Math.floor((Date.now() - new Date(firstSeen).getTime()) / MS_PER_DAY)) : null;

      return {
        key: displayKey,
        rows: groupRows,
        firstSeen,
        lastSeen,
        channels: [...channelSet].sort(),
        creativeCount: groupRows.length,
        summary: summaries[0] ?? null,
        daysRunning,
      };
    })
    .sort((a, b) => b.creativeCount - a.creativeCount);
}

function distribution(
  placements: AdvertiserPlacementRow[],
  picker: (row: AdvertiserPlacementRow) => string | null,
  label = "Unspecified",
): { label: string; count: number; pct: number }[] {
  const counts = new Map<string, number>();
  for (const row of placements) {
    const key = picker(row)?.trim() || label;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = placements.length || 1;
  return [...counts.entries()]
    .map(([l, count]) => ({ label: l, count, pct: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);
}

export type CurrentCampaignRow = {
  name: string;
  firstSeen: string;
  lastSeen: string;
  channels: string;
  creativeCount: number;
  summary: string;
  soWhat: string;
};

export type DistributionRow = {
  label: string;
  count: number;
  pct: number;
  soWhat: string;
};

export type TimelineItem = {
  title: string;
  detail: string;
  soWhat: string;
};

export type FatigueItem = {
  campaign: string;
  daysRunning: number;
  creativeCount: number;
  detail: string;
  soWhat: string;
};

export type ChangeItem = {
  headline: string;
  detail: string;
  soWhat: string;
};

export type ChannelOwnershipRow = {
  channel: string;
  count: number;
  pct: number;
  status: "active" | "gap";
  soWhat: string;
};

export type CampaignIntelligence = {
  rowCount: number;
  available: boolean;
  currentCampaigns: CurrentCampaignRow[];
  messagingBreakdown: DistributionRow[];
  ctaBreakdown: DistributionRow[];
  timeline: {
    newest: TimelineItem[];
    refreshed: TimelineItem[];
    oldestActive: TimelineItem[];
  };
  creativeFatigue: FatigueItem[];
  whatsChanged: ChangeItem[];
  channelOwnership: ChannelOwnershipRow[];
  blockSoWhat: string;
};

function soWhatForCampaign(group: CampaignGroup, brand: string): string {
  if (group.creativeCount >= 5) {
    return `${brand} is putting real weight behind ${group.key} — worth treating this as a priority line in your pitch.`;
  }
  if (group.channels.length === 1) {
    return `This campaign is concentrated on ${group.channels[0]} only — an opening to compete where they are not diversifying.`;
  }
  return `A smaller campaign line for ${brand} — useful context, but not their main bet right now.`;
}

function soWhatForEmotion(label: string, pct: number, brand: string): string {
  if (pct >= 40) {
    return `${brand} is leaning heavily on ${label.toLowerCase()} messaging (${pct}%) — match or challenge that tone in your recommendation.`;
  }
  return `A secondary message theme (${pct}%) — room to differentiate on a different emotional angle.`;
}

function soWhatForCta(label: string, pct: number): string {
  if (label === "Unspecified") return "Many ads lack a clear CTA in the data — their ask to consumers may be soft or brand-led.";
  if (pct >= 30) return `Consumers are most often asked to "${label}" — align your counter-offer to that same action or outbid it.`;
  return `"${label}" appears on a smaller share of ads — test whether your client should own this action instead.`;
}

export function buildCampaignIntelligence(
  brand: string,
  war: AdvertiserIntelWar | null | undefined,
): CampaignIntelligence {
  const placements = rows(war);
  const rowCount = placementCount(war);
  const empty: CampaignIntelligence = {
    rowCount: 0,
    available: false,
    currentCampaigns: [],
    messagingBreakdown: [],
    ctaBreakdown: [],
    timeline: { newest: [], refreshed: [], oldestActive: [] },
    creativeFatigue: [],
    whatsChanged: [],
    channelOwnership: [],
    blockSoWhat: "No placement rows available to summarise campaigns yet.",
  };

  if (!rowCount) return empty;

  const groups = buildCampaignGroups(placements);

  const currentCampaigns: CurrentCampaignRow[] = groups.slice(0, 8).map((g) => ({
    name: g.key,
    firstSeen: fmtShortDate(g.firstSeen),
    lastSeen: fmtShortDate(g.lastSeen),
    channels: g.channels.length ? g.channels.join(", ") : "—",
    creativeCount: g.creativeCount,
    summary: g.summary ?? `Activity across ${g.creativeCount} indexed creative${g.creativeCount === 1 ? "" : "s"}.`,
    soWhat: soWhatForCampaign(g, brand),
  }));

  const messagingRaw = mergeDistributionRows(
    distribution(placements, (r) => r.emotional_driver),
    (label) => normalizeEmotionLabel(label),
  );
  const messagingBreakdown: DistributionRow[] = messagingRaw.map((d) => ({
    ...d,
    soWhat: soWhatForEmotion(d.label, d.pct, brand),
  }));

  const ctaRaw = mergeDistributionRows(
    distribution(placements, (r) => ctaFromPlacement(r, brand)),
    (label) => normalizeCtaLabel(label),
  );
  const ctaBreakdown: DistributionRow[] = ctaRaw.map((d) => ({
    ...d,
    soWhat: soWhatForCta(d.label, d.pct),
  }));

  const newest: TimelineItem[] = [...groups]
    .sort((a, b) => (parseTime(b.lastSeen) ?? 0) - (parseTime(a.lastSeen) ?? 0))
    .slice(0, 4)
    .map((g) => ({
      title: g.key,
      detail: `Last seen ${fmtShortDate(g.lastSeen)} · ${g.creativeCount} creative${g.creativeCount === 1 ? "" : "s"}`,
      soWhat: `Still active in market — ${brand} has not gone dark on this line.`,
    }));

  const refreshed: TimelineItem[] = groups
    .filter((g) => g.firstSeen && !isRecent(g.firstSeen) && isRecent(g.lastSeen))
    .slice(0, 4)
    .map((g) => ({
      title: g.key,
      detail: `Running since ${fmtShortDate(g.firstSeen)} · updated ${fmtShortDate(g.lastSeen)}`,
      soWhat: `${brand} refreshed this campaign recently — they are investing to keep it live, not letting it fade.`,
    }));

  const oldestActive: TimelineItem[] = groups
    .filter((g) => g.daysRunning != null && g.daysRunning >= 14)
    .sort((a, b) => (b.daysRunning ?? 0) - (a.daysRunning ?? 0))
    .slice(0, 4)
    .map((g) => ({
      title: g.key,
      detail: `Running ~${g.daysRunning} days · last seen ${fmtShortDate(g.lastSeen)}`,
      soWhat:
        (g.daysRunning ?? 0) >= FATIGUE_DAYS
          ? `Long-running line for ${brand} — audiences may be tiring of it; good moment to bring fresh creative.`
          : `Established campaign — ${brand} is defending this space over time.`,
    }));

  const creativeFatigue: FatigueItem[] = groups
    .filter((g) => (g.daysRunning ?? 0) > FATIGUE_DAYS && g.creativeCount <= 2)
    .map((g) => ({
      campaign: g.key,
      daysRunning: g.daysRunning ?? 0,
      creativeCount: g.creativeCount,
      detail: `${g.creativeCount} creative${g.creativeCount === 1 ? "" : "s"} running ~${g.daysRunning} days with little rotation.`,
      soWhat: `Fatigue risk for ${brand} — you can pitch a fresher alternative while they stay on ageing assets.`,
    }));

  // Fix typo in filter - I used g.first_seen instead of comparing dates
  // Let me fix in the file - actually the filter has a bug. Let me use proper logic:
  // running > 60 days AND creativeCount <= 2 (little refresh)

  const whatsChanged: ChangeItem[] = [];

  const newCreatives = placements.filter((r) => isRecent(r.first_seen));
  if (newCreatives.length) {
    whatsChanged.push({
      headline: `${newCreatives.length} new creative${newCreatives.length === 1 ? "" : "s"} in the last ${RECENT_DAYS} days`,
      detail: [...new Set(newCreatives.map(campaignKey))].slice(0, 3).join(", "),
      soWhat: `${brand} is still putting new work into market — they have not gone quiet this week.`,
    });
  }

  const newCampaigns = groups.filter((g) => g.firstSeen && isRecent(g.firstSeen));
  if (newCampaigns.length) {
    whatsChanged.push({
      headline: `${newCampaigns.length} campaign launch${newCampaigns.length === 1 ? "" : "es"} this week`,
      detail: newCampaigns.map((g) => g.key).join(", "),
      soWhat: `New bets from ${brand} — worth flagging in your client meeting as fresh competitive pressure.`,
    });
  }

  const recentChannels = new Map<string, number>();
  const olderChannels = new Map<string, number>();
  for (const row of placements) {
    const ch = normaliseChannelBadge(row.channel_platform ?? row.channel) ?? "Other";
    const bucket = isRecent(row.first_seen) ? recentChannels : olderChannels;
    bucket.set(ch, (bucket.get(ch) ?? 0) + 1);
  }
  const channelShifts: string[] = [];
  for (const [ch, recent] of recentChannels) {
    const older = olderChannels.get(ch) ?? 0;
    if (recent > older && older > 0) channelShifts.push(`more on ${ch}`);
    if (recent > 0 && older === 0) channelShifts.push(`new activity on ${ch}`);
  }
  if (channelShifts.length) {
    whatsChanged.push({
      headline: "Channel shifts in the last week",
      detail: channelShifts.join(" · "),
      soWhat: `${brand} is moving spend across channels — adjust your media recommendation to where they are heading, not just where they were.`,
    });
  }

  if (war?.ads_this_week && war.ads_this_week > 0) {
    whatsChanged.push({
      headline: `${war.ads_this_week} ad${war.ads_this_week === 1 ? "" : "s"} added this week (warroom)`,
      detail: "Observed from live warroom activity counts.",
      soWhat: `Confirms ${brand} is in market now — timely moment for your client to respond.`,
    });
  }

  const channelCounts = new Map<string, number>();
  for (const row of placements) {
    const ch = normaliseChannelBadge(row.channel_platform ?? row.channel) ?? "Other";
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
  const total = placements.length;
  const ALL_CHANNELS = ["Display", "YouTube", "Search", "Meta", "TikTok", "LinkedIn", "Other"];
  const channelOwnership: ChannelOwnershipRow[] = ALL_CHANNELS.map((channel) => {
    const count = channelCounts.get(channel) ?? 0;
    const pct = total ? Math.round((count / total) * 1000) / 10 : 0;
    const status = count > 0 ? "active" as const : "gap" as const;
    return {
      channel,
      count,
      pct,
      status,
      soWhat:
        status === "gap"
          ? `${brand} has no indexed ${channel} placements — open ground for your client.`
          : pct >= 40
            ? `${brand} owns ${channel} in this set (${pct}%) — expect them to defend it.`
            : `${brand} has some ${channel} presence (${pct}%) — room to outbid or out-message.`,
    };
  });

  const topCampaign = groups[0]?.key ?? "their campaigns";
  const topEmotion = messagingBreakdown[0]?.label ?? "mixed messaging";
  const blockSoWhat = `Across ${rowCount} indexed placements, ${brand} is most active on ${topCampaign} with ${topEmotion.toLowerCase()}-led creative — use the sections below to brief your client on where to compete.`;

  return {
    rowCount,
    available: true,
    currentCampaigns,
    messagingBreakdown,
    ctaBreakdown,
    timeline: { newest, refreshed, oldestActive },
    creativeFatigue,
    whatsChanged,
    channelOwnership,
    blockSoWhat,
  };
}
