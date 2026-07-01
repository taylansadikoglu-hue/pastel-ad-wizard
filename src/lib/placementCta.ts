/**
 * CTA + label quality — reject brand names masquerading as CTAs.
 */
import { normalizeCtaLabel } from "@/lib/dataTrust";
import { isGenericCta, isSkipTagValue } from "@/lib/soWhatQuality";
import type { AdvertiserPlacementRow } from "@/lib/advertiserPlacements";

const LEGAL_SUFFIXES = /\b(limited|ltd|pty|inc|corp|corporation|bank|group)\b/gi;

export function brandTokens(brand: string | null | undefined): string[] {
  const b = (brand ?? "").trim().toLowerCase();
  if (!b) return [];
  const root = b.replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
  const words = b.split(/\s+/).filter((w) => w.length > 2);
  return [...new Set([root, ...words, b.replace(LEGAL_SUFFIXES, "").trim()])].filter(Boolean);
}

/** True when text is mostly the advertiser name, not a consumer action. */
export function isBrandLikeLabel(text: string | null | undefined, brand?: string | null): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  const norm = t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/^(commonwealth bank|commbank|cba)\b/.test(norm)) return true;
  for (const token of brandTokens(brand)) {
    const tok = token.replace(/[^a-z0-9]+/g, " ");
    if (tok.length >= 4 && norm === tok) return true;
    if (tok.length >= 5 && norm.startsWith(tok) && norm.length < tok.length + 12) return true;
  }
  if (/^commbank\b/i.test(t) && t.length < 40) return true;
  return false;
}

function labelFromLandingUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || last.length < 3) return null;
    if (/^[a-f0-9-]{16,}$/i.test(last)) return null;
    const words = last.replace(/[-_]+/g, " ").replace(/\.[a-z]+$/i, "");
    if (words.length < 3) return null;
    return words
      .split(" ")
      .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join(" ");
  } catch {
    return null;
  }
}

/** Best CTA for a placement — prefers enriched fields, then landing path. */
export function ctaFromPlacement(
  row: AdvertiserPlacementRow,
  brand?: string | null,
): string | null {
  const candidates = [
    row.primary_cta,
    row.detected_cta,
    row.extracted_offer,
    labelFromLandingUrl(row.landing_url),
  ];

  for (const raw of candidates) {
    const normalized = normalizeCtaLabel(raw);
    if (!normalized) continue;
    if (isSkipTagValue(normalized)) continue;
    if (isBrandLikeLabel(normalized, brand)) continue;
    return normalized;
  }
  return null;
}

export function isMeaningfulCta(label: string | null | undefined, brand?: string | null): boolean {
  if (!label?.trim()) return false;
  if (isBrandLikeLabel(label, brand)) return false;
  if (isSkipTagValue(label)) return false;
  return !isGenericCta(label);
}

/** Product labels — reject comma-lists and brand boilerplate. */
export function isListyProductLabel(text: string): boolean {
  const t = text.trim();
  if ((t.match(/,/g)?.length ?? 0) >= 2) return true;
  if (t.length > 52 && /\band\b/i.test(t)) return true;
  return false;
}

export function normalizeProductLabel(text: string, brand?: string | null): string | null {
  const t = text.trim();
  if (!t || isSkipTagValue(t)) return null;
  if (isBrandLikeLabel(t, brand) && t.length > 24) return null;
  if (isListyProductLabel(t)) return null;
  if (/^commbank\s*[-–—]/i.test(t)) {
    const rest = t.replace(/^commbank\s*[-–—]\s*/i, "").trim();
    if (isListyProductLabel(rest)) return null;
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return t;
}

export function dedupeProductLabels(labels: string[], brand?: string | null, limit = 4): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of labels) {
    const label = normalizeProductLabel(raw, brand);
    if (!label) continue;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}
