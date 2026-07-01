import type { AdLibraryAd } from "./adlibraryClient.ts";
import { buildEnrichmentRequest } from "./adlibraryClient.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCanonicalFingerprint } from "../../src/lib/placementFingerprint.ts";
import { ingestPlacementRow } from "./ingestPlacement.ts";

export type PlacementUpsertStats = {
  inserted: number;
  updated: number;
  skipped: number;
};

export type MapAdInput = {
  ad: AdLibraryAd;
  category: string;
  domain?: string | null;
  advertiserName: string;
};

/** Platform-default CTAs that are not actionable creative signals. */
const GENERIC_CTAS = new Set([
  "learn more",
  "learn more.",
  "see more",
  "watch more",
  "discover more",
  "find out more",
  "find out more.",
  "more",
  "click here",
  "click here.",
  "view more",
  "read more",
  "see details",
  "details",
  "link",
  "website",
  "visit website",
  "go to website",
  "open",
  "tap to learn more",
]);

export function adlibraryCreativeHash(adKey: string): string {
  return `adlibrary:${adKey}`;
}

export function isGenericCta(cta: string | null | undefined): boolean {
  if (!cta?.trim()) return true;
  const norm = cta.trim().toLowerCase().replace(/[.!]+$/, "");
  return GENERIC_CTAS.has(norm);
}

export function mapAdToPlacement(input: MapAdInput): Record<string, unknown> {
  const { ad, category, domain, advertiserName } = input;
  const adKey = String(ad.ad_key ?? "");
  const platform = String(ad.platform ?? "unknown").toLowerCase();
  const videoUrl = pickMediaUrl(ad, "video");
  const imageUrl = pickMediaUrl(ad, "image");
  const landingUrl =
    (ad.landing_page_url as string | undefined) ??
    (ad.landing_url as string | undefined) ??
    null;
  const adType = inferAdType(ad);
  const daysRunning = computeDaysRunning(ad.first_seen ?? null, ad.last_seen ?? null);

  const isVideo = adType === "Video" || Boolean(videoUrl);
  const mediaUrl = isVideo ? videoUrl ?? imageUrl : imageUrl ?? videoUrl;

  const baseRow = {
    domain: domain ?? slugDomain(advertiserName),
    advertiser_name: ad.advertiser_name ?? advertiserName,
    category,
    ad_title: ad.title ?? null,
    ad_type: adType,
    raw_copy: ad.body ?? null,
    hook: ad.title ?? null,
    headline: ad.title ?? null,
    channel: platformChannel(platform),
    channel_platform: capitalizePlatform(platform),
    media_url: mediaUrl,
    creative_url: imageUrl ?? mediaUrl,
    times_seen: ad.impression ?? null,
    days_running: daysRunning,
    first_seen: ad.first_seen ?? null,
    last_seen: ad.last_seen ?? null,
    landing_url: landingUrl,
    source_platform: "adlibrary",
    source_archive_url: (ad.source_archive_url as string | undefined) ?? null,
    creative_hash: adKey ? adlibraryCreativeHash(adKey) : null,
    raw: {
      source: "adlibrary",
      ad_key: adKey,
      video_url: videoUrl,
      image_url: imageUrl,
      like_count: ad.like_count ?? null,
      share_count: ad.share_count ?? null,
      impression: ad.impression ?? null,
      geo: ad.geo ?? null,
      payload: ad,
    },
    data_quality: "adlibrary_ingest",
  };

  const canonical_fingerprint = computeCanonicalFingerprint({
    domain: String(baseRow.domain),
    channel: baseRow.channel,
    channelPlatform: baseRow.channel_platform,
    sourcePlatform: "adlibrary",
    adKey,
    sourceArchiveUrl: baseRow.source_archive_url,
    mediaUrl: baseRow.media_url,
    creativeUrl: baseRow.creative_url,
    landingUrl: baseRow.landing_url,
    headline: baseRow.headline,
    rawCopy: baseRow.raw_copy,
    adTitle: baseRow.ad_title,
    raw: baseRow.raw,
  });

  return { ...baseRow, canonical_fingerprint };
}

export async function upsertAdlibraryPlacement(
  supabase: SupabaseClient | null,
  row: Record<string, unknown>,
  dryRun: boolean,
): Promise<"inserted" | "updated" | "skipped"> {
  const creativeHash = row.creative_hash as string | null;
  if (!creativeHash && !row.canonical_fingerprint) return "skipped";

  const { result, skipped } = await ingestPlacementRow(supabase, row, dryRun);
  if (skipped || result === "skipped") return "skipped";
  if (result === "merged") return "updated";
  return result;
}

const GPT_FIELDS = [
  "hook_analysis",
  "strategist_takeaway",
  "buyer_stage",
  "emotional_driver",
  "offer_type",
  "primary_cta",
  "detected_cta",
  "product_type",
  "market_signal",
  "offer_signal",
  "extracted_offer",
  "page_title",
  "page_description",
  "description",
  "offer_theme",
  "product_category",
] as const;

export function mergePlacementRow(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(incoming)) {
    if (value == null || value === "") continue;

    if ((GPT_FIELDS as readonly string[]).includes(key)) {
      const cur = existing[key];
      if (cur != null && String(cur).trim() !== "") continue;
    }

    if (key === "raw" && existing.raw && typeof existing.raw === "object") {
      patch.raw = { ...(existing.raw as object), ...(value as object) };
      continue;
    }

    patch[key] = value;
  }

  for (const metric of ["times_seen", "last_seen", "days_running"] as const) {
    if (incoming[metric] != null) patch[metric] = incoming[metric];
  }

  return patch;
}

export type EnrichmentTags = {
  hook_analysis: string | null;
  strategist_takeaway: string | null;
  buyer_stage: string | null;
  emotional_driver: string | null;
  offer_type: string | null;
  primary_cta: string | null;
  detected_cta: string | null;
  product_type: string | null;
  market_signal: string | null;
  offer_signal: string | null;
  extracted_offer: string | null;
  page_title: string | null;
  page_description: string | null;
  description: string | null;
  offer_theme: string | null;
  product_category: string | null;
};

export function parseEnrichmentTags(enrichment: {
  summary?: string | null;
  analysis?: string | null;
  markdown?: string | null;
  transcription?: string | null;
}): EnrichmentTags {
  const blob = [enrichment.markdown, enrichment.analysis, enrichment.summary, enrichment.transcription]
    .filter(Boolean)
    .join("\n");

  const brand = extractMarkdownField(blob, "Brand") ?? extractMarkdownField(blob, "Advertiser");
  const product = extractMarkdownField(blob, "Product");
  const keyMessage = extractMarkdownField(blob, "Key Message") ?? extractMarkdownField(blob, "Key message");

  const targetAudience =
    extractSection(blob, /target\s*audience/i) ??
    extractSection(blob, /ideal\s*customer/i) ??
    extractSection(blob, /buyer\s*persona/i) ??
    extractSection(blob, /demographic/i);

  const landingInsight =
    extractSection(blob, /landing\s*page/i) ??
    extractMarkdownField(blob, "Landing page") ??
    extractMarkdownField(blob, "Landing Page");

  const kpi =
    extractSection(blob, /\bKPI\b/i) ??
    extractSection(blob, /primary\s*KPI/i) ??
    extractSection(blob, /conversion\s*goal/i) ??
    extractSection(blob, /key\s*metric/i);

  const cpc =
    extractCpc(blob) ??
    extractField(blob, /estimated\s*cpc[:\s]+(.+?)(?:\n|$)/i) ??
    extractField(blob, /CPC[:\s]+(.+?)(?:\n|$)/i);

  const rawCta =
    extractSection(blob, /\bCTA\b/i) ??
    extractMarkdownField(blob, "CTA") ??
    extractField(blob, /call[\s-]*to[\s-]*action[:\s]+(.+?)(?:\n|$)/i);

  const cta = sanitiseCta(rawCta);

  const hook =
    extractSection(blob, /hook\s*forensics/i) ??
    extractMarkdownField(blob, "Hook") ??
    extractField(blob, /hook[:\s]+(.+?)(?:\n|$)/i);

  const takeaway =
    keyMessage ??
    extractField(blob, /(?:takeaway|summary)[:\s]+(.+?)(?:\n|$)/i) ??
    (enrichment.summary?.trim() ? enrichment.summary.trim().slice(0, 280) : null);

  const buyerStage = extractField(blob, /buyer\s*stage[:\s]+(.+?)(?:\n|$)/i);
  const emotionalDriver = extractField(blob, /emotional\s*driver[:\s]+(.+?)(?:\n|$)/i);
  const offerType = extractField(blob, /offer\s*type[:\s]+(.+?)(?:\n|$)/i);

  const marketParts = [kpi, brand ? `Brand: ${brand}` : null].filter(Boolean);
  const offerParts = [cpc ? `Est. CPC ${cpc}` : null].filter(Boolean);

  return {
    hook_analysis: hook,
    strategist_takeaway: takeaway,
    buyer_stage: buyerStage,
    emotional_driver: emotionalDriver,
    offer_type: offerType,
    primary_cta: cta && !isGenericCta(cta) ? cta : null,
    detected_cta: cta,
    product_type: product,
    market_signal: marketParts.length ? marketParts.join(" · ") : null,
    offer_signal: offerParts.length ? offerParts.join(" · ") : null,
    extracted_offer: keyMessage ?? extractField(blob, /offer[:\s]+(.+?)(?:\n|$)/i),
    page_title: landingInsight ? landingInsight.slice(0, 120) : null,
    page_description: landingInsight,
    description: targetAudience ? `Target: ${targetAudience}` : null,
    offer_theme: targetAudience ? targetAudience.slice(0, 80) : null,
    product_category: product ?? brand,
  };
}

export function applyEnrichmentToRow(
  row: Record<string, unknown>,
  enrichment: Record<string, unknown>,
): void {
  const tags = parseEnrichmentTags({
    summary: enrichment.summary as string | null,
    analysis: enrichment.analysis as string | null,
    markdown: enrichment.markdown as string | null,
    transcription: enrichment.transcription as string | null,
  });

  for (const [k, v] of Object.entries(tags)) {
    if (v) row[k] = v;
  }

  const enrichmentPlatform = enrichment.platform as string | undefined;
  if (enrichmentPlatform && !row.channel_platform) {
    row.channel_platform = enrichmentPlatform;
    row.channel = row.channel ?? enrichmentPlatform;
  }

  const raw = (row.raw ?? {}) as Record<string, unknown>;
  row.raw = {
    ...raw,
    enrichment_source: enrichment.source ?? "adlibrary",
    target_audience: tags.description,
    estimated_cpc: tags.offer_signal,
    enrichment_at: new Date().toISOString(),
  };
}

/** Re-export for ingest/enrich scripts. */
export { buildEnrichmentRequest };

function pickMediaUrl(ad: AdLibraryAd, kind: "video" | "image"): string | null {
  if (kind === "video") {
    return (
      (ad.video_url as string | undefined) ??
      (typeof ad.video === "string" ? ad.video : null) ??
      null
    );
  }
  return (
    (ad.image_url as string | undefined) ??
    ad.preview_img_url ??
    (typeof ad.image === "string" ? ad.image : null) ??
    null
  );
}

function inferAdType(ad: AdLibraryAd): string | null {
  const explicit = ad.adsType ?? ad.ad_type;
  if (explicit === "1" || explicit === 1) return "Image";
  if (explicit === "2" || explicit === 2) return "Video";
  if (explicit === "3" || explicit === 3) return "Carousel";
  const t = String(explicit ?? "").toLowerCase();
  if (t.includes("video")) return "Video";
  if (t.includes("carousel")) return "Carousel";
  if (t.includes("image") || t.includes("static")) return "Image";
  if (ad.video_url) return "Video";
  if (String(ad.platform ?? "").includes("youtube")) return "Video";
  if (ad.preview_img_url || ad.image_url) return "Image";
  return null;
}

function computeDaysRunning(firstSeen: string | null, lastSeen: string | null): number | null {
  if (!firstSeen || !lastSeen) return null;
  const a = new Date(firstSeen).getTime();
  const b = new Date(lastSeen).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

function sanitiseCta(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  let cta = raw.trim();
  cta = cta.replace(/^cta[:\s]*/i, "");
  cta = cta.replace(/^[#*\-]+\s*/, "");
  cta = cta.split("\n")[0]?.trim() ?? cta;
  if (cta.length > 80) cta = cta.slice(0, 77) + "…";
  return cta || null;
}

function extractCpc(text: string): string | null {
  const range = text.match(/\$[\d,.]+(?:\s*[-–]\s*\$[\d,.]+)?(?:\s*(?:AUD|USD))?/i);
  if (range) return range[0].trim();
  const aud = text.match(/(?:AUD|USD)\s*\$?[\d,.]+/i);
  return aud?.[0]?.trim() ?? null;
}

function extractMarkdownField(text: string, label: string): string | null {
  const re = new RegExp(`\\*\\*${escapeRe(label)}:\\*\\*\\s*(.+?)(?=\\n\\*\\*|\\n##|$)`, "is");
  const m = text.match(re);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function extractSection(text: string, heading: RegExp): string | null {
  const lines = text.split("\n");
  let capture = false;
  const buf: string[] = [];

  for (const line of lines) {
    const isHeading = /^#{1,3}\s/.test(line) || /^\*\*[A-Z]/.test(line);
    if (isHeading && heading.test(line)) {
      capture = true;
      const inline = line.replace(/^#{1,3}\s*/, "").replace(/\*\*/g, "").trim();
      const afterColon = inline.split(/:\s*/).slice(1).join(": ").trim();
      if (afterColon) buf.push(afterColon);
      continue;
    }
    if (capture) {
      if (/^#{1,3}\s/.test(line) || (/^\*\*[A-Z]/.test(line) && !heading.test(line))) break;
      const trimmed = line.trim();
      if (trimmed) buf.push(trimmed.replace(/^[-*]\s*/, ""));
      if (buf.join(" ").length > 200) break;
    }
  }

  const joined = buf.join(" ").replace(/\s+/g, " ").trim();
  return joined || null;
}

function extractField(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.replace(/\s+/g, " ").trim() ?? null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slugDomain(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}.com.au`;
}

function platformChannel(platform: string): string {
  if (platform.includes("linkedin")) return "LinkedIn";
  if (platform.includes("youtube")) return "YouTube";
  if (platform.includes("tiktok")) return "TikTok";
  if (platform.includes("insta")) return "Meta";
  if (platform.includes("face")) return "Meta";
  if (platform.includes("google")) return "Google";
  return "Social";
}

function capitalizePlatform(platform: string): string {
  if (platform.includes("linkedin")) return "LinkedIn";
  if (platform.includes("youtube")) return "YouTube";
  if (platform.includes("tiktok")) return "TikTok";
  if (platform.includes("insta")) return "Instagram";
  if (platform.includes("face")) return "Facebook";
  if (platform.includes("google") && platform.includes("search")) return "Google Search";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
