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
  format: "image" | "video" | "unknown";
  platform: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  runningDays: number | null;
  timesSeen: number | null;
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

function pickHeadline(row: AdvertiserPlacementRow): string | null {
  return row.headline ?? row.ad_title ?? row.page_title ?? row.extracted_offer ?? null;
}

function pickBody(row: AdvertiserPlacementRow): string | null {
  return row.description ?? row.page_description ?? row.raw_copy ?? row.hook_analysis ?? null;
}

function pickCta(row: AdvertiserPlacementRow): string | null {
  return row.primary_cta ?? row.detected_cta ?? null;
}

function inferFormat(row: AdvertiserPlacementRow): CreativeProofCard["format"] {
  const t = (row.ad_type ?? "").toLowerCase();
  if (t.includes("video")) return "video";
  if (t.includes("image") || t.includes("static") || t.includes("carousel")) return "image";
  const url = (row.media_url ?? row.creative_url ?? "").toLowerCase();
  if (url.includes(".mp4") || url.includes("video")) return "video";
  if (url) return "image";
  return "unknown";
}

export function proofScoreForRow(row: AdvertiserPlacementRow): number {
  const days = runningDays(row) ?? 0;
  const seen = Number(row.times_seen) || 0;
  const hasMedia = Boolean(row.media_url ?? row.creative_url);
  const hasCopy = Boolean(pickHeadline(row) ?? pickBody(row));
  const hasTags = Boolean(row.emotional_driver || row.offer_type || row.buyer_stage);
  return days * 3 + seen * 2 + (hasMedia ? 8 : 0) + (hasCopy ? 4 : 0) + (hasTags ? 3 : 0);
}

function runningDays(row: AdvertiserPlacementRow): number | null {
  const explicit = (row as { days_running?: number | null }).days_running;
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
  const whySupports =
    row.strategist_takeaway?.trim() ||
    (tags.length
      ? `Supports the claim via ${tags.join(" · ")} messaging observed in market.`
      : claimContext ?? "Observed creative activity aligned with this market read.");

  return {
    id: row.id,
    advertiser,
    domain: row.domain ?? null,
    headline: pickHeadline(row),
    body: pickBody(row),
    cta: pickCta(row),
    thumbnailUrl: row.media_url ?? row.creative_url ?? null,
    format: inferFormat(row),
    platform: normaliseChannelBadge(row.channel_platform ?? row.channel),
    firstSeen: row.first_seen ?? null,
    lastSeen: row.last_seen ?? null,
    runningDays: runningDays(row),
    timesSeen: row.times_seen ?? null,
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
