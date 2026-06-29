/**
 * Extract landing-page intelligence from ads that include a destination URL.
 */

import type { AdWithDestination, ExtractedDestination } from "./types";

function parseTags(raw: AdWithDestination["ai_tags"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return raw;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim() && !v.includes("{{")) return v.trim();
  }
  return null;
}

function firstFromArray(tags: Record<string, unknown>, key: string): string | null {
  const v = tags[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (Array.isArray(v)) {
    const s = v.find((x) => typeof x === "string" && x.trim());
    if (typeof s === "string") return s.trim();
  }
  return null;
}

/** Normalise URL for dedupe and storage. */
export function normalizeDestinationUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("{{")) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProtocol);
    if (!u.hostname || u.hostname === "localhost") return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function destinationHost(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? url;
  }
}

/** Stable hash key for advertiser + url dedupe. */
export function destinationUrlHash(url: string): string {
  return normalizeDestinationUrl(url)?.toLowerCase() ?? url.toLowerCase();
}

function resolveAdvertiserKey(ad: AdWithDestination, fallbackDomain?: string): string {
  const fromAd =
    ad.advertiser?.trim() ||
    ad.advertiser_name?.trim() ||
    ad.domain?.trim() ||
    fallbackDomain?.trim();
  if (!fromAd) return "unknown";
  return fromAd.toLowerCase().replace(/^www\./, "");
}

function resolveProduct(ad: AdWithDestination, tags: Record<string, unknown>): string | null {
  return firstString(
    ad.product_type,
    ad.product_category,
    tags.product_name,
    tags.product,
    tags.product_type,
    tags.finance_product,
  );
}

function resolveOffer(ad: AdWithDestination, tags: Record<string, unknown>): string | null {
  return firstString(
    ad.extracted_offer,
    ad.offer_signal,
    ad.offer_type,
    tags.finance_offer,
    tags.offer,
    tags.promotion,
  );
}

function resolveCta(ad: AdWithDestination, tags: Record<string, unknown>): string | null {
  return firstString(ad.primary_cta, ad.detected_cta, tags.call_to_action, tags.cta);
}

function resolvePersona(ad: AdWithDestination, tags: Record<string, unknown>): string | null {
  const demo = firstFromArray(tags, "demographics");
  if (demo) return demo;
  return firstString(
    ad.emotional_driver,
    tags.persona,
    tags.audience,
    tags.target_audience,
    tags.australian_context === true ? "Australian market" : null,
  );
}

function resolveTheme(ad: AdWithDestination, tags: Record<string, unknown>): string | null {
  const themes = tags.themes;
  if (Array.isArray(themes) && typeof themes[0] === "string") return themes[0];
  return firstString(ad.offer_theme, tags.dominant_emotion, tags.sentiment, tags.theme);
}

function resolveFunnelStage(ad: AdWithDestination, tags: Record<string, unknown>): string | null {
  return firstString(ad.buyer_stage, tags.funnel_stage, tags.buyer_stage, tags.funnel);
}

function resolveLandingUrl(ad: AdWithDestination): string | null {
  return normalizeDestinationUrl(ad.landing_url?.trim() || ad.destination_url?.trim() || "");
}

/** Extract destination intelligence from one ad record. */
export function extractDestinationFromAd(
  ad: AdWithDestination,
  opts?: { advertiserDomain?: string; source?: ExtractedDestination["source"] },
): ExtractedDestination | null {
  const url = resolveLandingUrl(ad);
  if (!url) return null;

  const tags = parseTags(ad.ai_tags);
  const advertiser = resolveAdvertiserKey(ad, opts?.advertiserDomain);

  return {
    advertiser,
    domain: destinationHost(url),
    url,
    url_hash: destinationUrlHash(url),
    page_title: firstString(ad.page_title, tags.page_title, ad.page_description),
    product: resolveProduct(ad, tags),
    offer: resolveOffer(ad, tags),
    cta: resolveCta(ad, tags),
    persona: resolvePersona(ad, tags),
    theme: resolveTheme(ad, tags),
    funnel_stage: resolveFunnelStage(ad, tags),
    first_seen: ad.first_seen ?? null,
    last_seen: ad.last_seen ?? null,
    source: opts?.source ?? "placement",
  };
}

/** Extract from many ads; skips rows without destination URLs. */
export function extractDestinationsFromAds(
  ads: AdWithDestination[],
  opts?: { advertiserDomain?: string; source?: ExtractedDestination["source"] },
): ExtractedDestination[] {
  const out: ExtractedDestination[] = [];
  for (const ad of ads) {
    const row = extractDestinationFromAd(ad, opts);
    if (row) out.push(row);
  }
  return out;
}
