import type { AdvertiserIntelWar } from "@/lib/advertiserPlacements";
import { placementCount } from "@/lib/advertiserPlacements";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import type { CampaignIntelligence } from "@/lib/campaignIntelligence";
import type { ChannelMixResult } from "@/lib/channelMix";

export type CampaignShare = { name: string; creatives: number; sharePct: number };
export type ChannelShare = { name: string; pct: number; ads: number };
export type ThemeShare = { label: string; pct: number };
export type ActivityDelta = { newCreatives: number; refreshed: number; adsThisWeek: number };
export type VisualMove = {
  kind: "channel" | "message" | "campaign" | "cta";
  label: string;
  value: string;
  hint: string;
};

export type AdvertiserVisualScan = {
  campaigns: CampaignShare[];
  channels: ChannelShare[];
  topMessage: ThemeShare | null;
  topCta: ThemeShare | null;
  delta: ActivityDelta;
  gapChannels: string[];
  moves: VisualMove[];
};

const RECENT_DAYS = 7;
const MS_PER_DAY = 86_400_000;

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

export function buildAdvertiserVisualScan(
  war: AdvertiserIntelWar | null | undefined,
  channelMix: ChannelMixResult,
  campaignIntel: CampaignIntelligence | null,
  strategistIntel: AdvertiserStrategistIntel | null,
  adsThisWeek: number,
): AdvertiserVisualScan {
  const rows = war?.placements ?? war?.recent_ads ?? [];
  const totalCreatives = Math.max(placementCount(war), rows.length, 1);

  const campaigns: CampaignShare[] = (campaignIntel?.currentCampaigns ?? []).slice(0, 4).map((c) => ({
    name: c.name,
    creatives: c.creativeCount,
    sharePct: Math.round((c.creativeCount / totalCreatives) * 100),
  }));

  const channels: ChannelShare[] = channelMix.rows
    .filter((r) => r.pct > 0 || (r.ads ?? 0) > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5)
    .map((r) => ({ name: r.channel, pct: r.pct, ads: r.ads ?? 0 }));

  const topMessageRaw = campaignIntel?.messagingBreakdown?.[0];
  const topCtaRaw = campaignIntel?.ctaBreakdown?.[0];
  const topMessage = topMessageRaw
    ? { label: topMessageRaw.label, pct: topMessageRaw.pct }
    : strategistIntel?.topEmotion
      ? { label: strategistIntel.topEmotion, pct: 0 }
      : null;
  const topCta = topCtaRaw
    ? { label: topCtaRaw.label, pct: topCtaRaw.pct }
    : strategistIntel?.topCta
      ? { label: strategistIntel.topCta, pct: 0 }
      : null;

  const newCreatives = rows.filter((r) => isRecent(r.first_seen)).length;
  const refreshed =
    campaignIntel?.timeline?.refreshed?.length ??
    (campaignIntel?.currentCampaigns ?? []).filter((c) => c.firstSeen !== c.lastSeen).length;

  const gapChannels =
    campaignIntel?.channelOwnership?.filter((c) => c.status === "gap").map((c) => c.channel) ?? [];

  const moves: VisualMove[] = [];

  if (gapChannels[0]) {
    moves.push({
      kind: "channel",
      label: gapChannels[0],
      value: "0%",
      hint: "Whitespace",
    });
  }

  if (topMessage && topMessage.label !== "Unspecified") {
    moves.push({
      kind: "message",
      label: topMessage.label,
      value: topMessage.pct > 0 ? `${topMessage.pct}%` : "Lead",
      hint: "Their theme",
    });
  }

  if (campaigns[0]) {
    moves.push({
      kind: "campaign",
      label: campaigns[0].name,
      value: `${campaigns[0].creatives}`,
      hint: "Lead line",
    });
  } else if (topCta && topCta.label !== "Unspecified") {
    moves.push({
      kind: "cta",
      label: topCta.label,
      value: topCta.pct > 0 ? `${topCta.pct}%` : "Lead",
      hint: "Top CTA",
    });
  }

  if (moves.length < 3 && gapChannels[1]) {
    moves.push({
      kind: "channel",
      label: gapChannels[1],
      value: "0%",
      hint: "Whitespace",
    });
  }

  return {
    campaigns,
    channels,
    topMessage,
    topCta,
    delta: { newCreatives, refreshed, adsThisWeek },
    gapChannels,
    moves: moves.slice(0, 3),
  };
}
