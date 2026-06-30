import type { AdvertiserPlacementRow } from "@/lib/advertiserPlacements";
import { normaliseChannelBadge } from "@/lib/advertiserPlacements";
import { displayBrand } from "@/utils/brandDisplay";

export type CreativeProofCard = {
  id: string | number;
  advertiser: string;
  domain: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  format: "image" | "video" | "unknown";
  platform: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  runningDays: number | null;
  timesSeen: number | null;
  likeCount: number | null;
  shareCount: number | null;
  targetAudience: string | null;
  estimatedCpc: string | null;
  kpiSignal: string | null;
  landingInsight: string | null;
  archiveUrl: string | null;
  landingUrl: string | null;
  emotionalDriver: string | null;
  offerType: string | null;
  buyerStage: string | null;
  productType: string | null;
  whySupports: string;
  /** Internal sort key — higher = stronger proof */
  proofScore: number;
};

export type MarketSignalView = {
  movement: string;
  detail: string;
  categoryPosition: string | null;
  searchMix: string | null;
};

const GENERIC_CTAS = new Set([
  "learn more",
  "see more",
  "watch more",
  "discover more",
  "find out more",
  "click here",
  "view more",
  "read more",
  "visit website",
  "go to website",
]);

function pickHeadline(row: AdvertiserPlacementRow): string | null {
  return row.headline ?? row.ad_title ?? row.page_title ?? row.extracted_offer ?? null;
}

function pickBody(row: AdvertiserPlacementRow): string | null {
  return row.description ?? row.page_description ?? row.raw_copy ?? row.hook_analysis ?? null;
}

function isGenericCta(cta: string): boolean {
  const norm = cta.trim().toLowerCase().replace(/[.!]+$/, "");
  return GENERIC_CTAS.has(norm);
}

function pickCta(row: AdvertiserPlacementRow): string | null {
  const candidates = [row.detected_cta, row.primary_cta].filter(Boolean) as string[];
  for (const cta of candidates) {
    if (!isGenericCta(cta)) return cta;
  }
  return null;
}

function pickTargetAudience(row: AdvertiserPlacementRow): string | null {
  const desc = row.description?.trim();
  if (desc?.toLowerCase().startsWith("target:")) {
    return desc.replace(/^target:\s*/i, "").trim();
  }
  return row.offer_theme?.trim() ?? null;
}

function pickRawEngagement(row: AdvertiserPlacementRow): {
  likes: number | null;
  shares: number | null;
  videoUrl: string | null;
} {
  const raw = (row as { raw?: Record<string, unknown> }).raw;
  if (!raw || typeof raw !== "object") {
    return { likes: null, shares: null, videoUrl: null };
  }
  return {
    likes: raw.like_count != null ? Number(raw.like_count) : null,
    shares: raw.share_count != null ? Number(raw.share_count) : null,
    videoUrl: typeof raw.video_url === "string" ? raw.video_url : null,
  };
}

function inferFormat(row: AdvertiserPlacementRow, videoUrl: string | null): CreativeProofCard["format"] {
  const t = (row.ad_type ?? "").toLowerCase();
  if (t.includes("video") || videoUrl) return "video";
  if (t.includes("image") || t.includes("static") || t.includes("carousel")) return "image";
  const url = (row.media_url ?? row.creative_url ?? "").toLowerCase();
  if (url.includes(".mp4") || url.includes("video") || url.includes("youtube")) return "video";
  if (url) return "image";
  return "unknown";
}

export function proofScoreForRow(row: AdvertiserPlacementRow): number {
  const days = runningDays(row) ?? 0;
  const seen = Number(row.times_seen) || 0;
  const { likes } = pickRawEngagement(row);
  const hasMedia = Boolean(row.media_url ?? row.creative_url);
  const hasCopy = Boolean(pickHeadline(row) ?? pickBody(row));
  const hasTags = Boolean(row.emotional_driver || row.offer_type || row.buyer_stage);
  const hasAudience = Boolean(pickTargetAudience(row));
  const hasRealCta = Boolean(pickCta(row));
  return (
    days * 3 +
    seen * 2 +
    (likes ?? 0) * 0.05 +
    (hasMedia ? 8 : 0) +
    (hasCopy ? 4 : 0) +
    (hasTags ? 3 : 0) +
    (hasAudience ? 4 : 0) +
    (hasRealCta ? 3 : 0)
  );
}

function runningDays(row: AdvertiserPlacementRow): number | null {
  const explicit = row.days_running;
  if (explicit != null && Number.isFinite(Number(explicit))) return Number(explicit);
  if (row.first_seen && row.last_seen) {
    const a = new Date(row.first_seen).getTime();
    const b = new Date(row.last_seen).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      return Math.max(1, Math.round((b - a) / 86_400_000));
    }
  }
  return row.times_seen != null && row.times_seen > 0 ? row.times_seen : null;
}

export function placementToCreativeProof(
  row: AdvertiserPlacementRow,
  claimContext?: string,
): CreativeProofCard {
  const advertiser = row.advertiser_name ?? displayBrand(row.domain ?? "Unknown");
  const tags = [row.emotional_driver, row.offer_type, row.buyer_stage].filter(Boolean);
  const engagement = pickRawEngagement(row);
  const videoUrl = engagement.videoUrl;
  const targetAudience = pickTargetAudience(row);
  const whySupports =
    row.strategist_takeaway?.trim() ||
    (tags.length
      ? `Supports the claim via ${tags.join(" · ")} messaging observed in market.`
      : claimContext ?? "Observed creative activity aligned with this market read.");

  const thumb =
    row.media_url ??
    row.creative_url ??
    (videoUrl ? youtubeThumb(videoUrl) : null);

  return {
    id: row.id,
    advertiser,
    domain: row.domain ?? null,
    headline: pickHeadline(row),
    body: pickBody(row),
    cta: pickCta(row),
    thumbnailUrl: thumb,
    videoUrl,
    format: inferFormat(row, videoUrl),
    platform: normaliseChannelBadge(row.channel_platform ?? row.channel),
    firstSeen: row.first_seen ?? null,
    lastSeen: row.last_seen ?? null,
    runningDays: runningDays(row),
    timesSeen: row.times_seen ?? null,
    likeCount: engagement.likes,
    shareCount: engagement.shares,
    targetAudience,
    estimatedCpc: row.offer_signal?.includes("CPC") ? row.offer_signal : row.offer_signal,
    kpiSignal: row.market_signal ?? null,
    landingInsight: row.page_description ?? row.page_title ?? null,
    archiveUrl: row.source_archive_url ?? null,
    landingUrl: row.landing_url ?? null,
    emotionalDriver: row.emotional_driver ?? null,
    offerType: row.offer_type ?? null,
    buyerStage: row.buyer_stage ?? null,
    productType: row.product_type ?? row.normalized_product ?? row.product_category ?? null,
    whySupports,
    proofScore: proofScoreForRow(row),
  };
}

function youtubeThumb(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
  return m?.[1] ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}

export function rankCreativeProof(cards: CreativeProofCard[]): CreativeProofCard[] {
  return [...cards].sort((a, b) => b.proofScore - a.proofScore);
}

export function domainMatchesBrand(domain: string, brandOrDomain: string): boolean {
  const a = domain.toLowerCase().replace(/^www\./, "");
  const b = brandOrDomain.toLowerCase().replace(/^www\./, "");
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aRoot = a.split(".")[0] ?? a;
  const bRoot = b.split(".")[0] ?? b;
  return aRoot === bRoot || a.includes(bRoot) || b.includes(aRoot);
}

export function filterCreativeProof(
  cards: CreativeProofCard[],
  brandOrDomain: string | null | undefined,
  limit = 6,
): CreativeProofCard[] {
  const ranked = rankCreativeProof(cards);
  if (!brandOrDomain?.trim()) return ranked.slice(0, limit);
  const filtered = ranked.filter(
    (c) =>
      (c.domain && domainMatchesBrand(c.domain, brandOrDomain)) ||
      domainMatchesBrand(c.advertiser, brandOrDomain),
  );
  return (filtered.length ? filtered : ranked).slice(0, limit);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function quickScanLine(card: CreativeProofCard): string {
  const parts: string[] = [];
  if (card.runningDays != null) parts.push(`${card.runningDays}d`);
  if (card.timesSeen != null && card.timesSeen > 0) parts.push(`${fmtCompact(card.timesSeen)} imp`);
  if (card.likeCount != null && card.likeCount > 0) parts.push(`${fmtCompact(card.likeCount)} likes`);
  if (card.estimatedCpc) parts.push(card.estimatedCpc.replace(/^Est\.\s*/i, ""));
  if (card.targetAudience) parts.push(card.targetAudience.slice(0, 40));
  return parts.join(" · ");
}
