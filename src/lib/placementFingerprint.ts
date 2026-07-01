/**
 * Canonical placement fingerprinting — cross-source dedup for ad_placements.
 *
 * All ingest paths (AdLibrary, DataForSEO, Apify) must compute the same fingerprint
 * before insert. Matching rows merge metadata; only net-new creatives insert.
 */

import { bucketChannel, type DisplayChannel } from "@/lib/channels";

export type SourcePlatform = "adlibrary" | "dataforseo" | "apify";

/** Which source owns writes per channel (secondary sources enrich only). */
export const SOURCE_AUTHORITY: Record<DisplayChannel, { primary: SourcePlatform | null; secondary: SourcePlatform[] }> = {
  Meta: { primary: "adlibrary", secondary: ["apify"] },
  TikTok: { primary: "adlibrary", secondary: [] },
  LinkedIn: { primary: "adlibrary", secondary: [] },
  YouTube: { primary: "adlibrary", secondary: ["dataforseo"] },
  Search: { primary: "dataforseo", secondary: [] },
  Display: { primary: "dataforseo", secondary: [] },
  Other: { primary: null, secondary: ["adlibrary", "dataforseo", "apify"] },
};

export type PlacementFingerprintInput = {
  domain: string;
  channel?: string | null;
  channelPlatform?: string | null;
  sourcePlatform?: string | null;
  /** AdLibrary ad_key */
  adKey?: string | null;
  /** Meta library / archive id from Apify */
  archiveId?: string | null;
  sourceArchiveUrl?: string | null;
  mediaUrl?: string | null;
  creativeUrl?: string | null;
  landingUrl?: string | null;
  headline?: string | null;
  rawCopy?: string | null;
  adTitle?: string | null;
  raw?: Record<string, unknown> | null;
};

export type SourceReceipt = {
  sourcePlatform: SourcePlatform;
  sourceNativeId: string;
  ingestedAt?: string;
};

/** FNV-1a 32-bit → base36 (browser + Node safe). */
export function stableHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function normalizeDomain(domain: string | null | undefined): string {
  return (domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function domainRoot(domain: string): string {
  const d = normalizeDomain(domain);
  const parts = d.split(".");
  if (parts.length >= 2) return parts.slice(-2).join(".");
  return d;
}

function normalizeUrlForHash(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    return `${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase().split("?")[0] ?? null;
  }
}

function normalizeTextForHash(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .join("|");
}

function extractFromRaw(raw: Record<string, unknown> | null | undefined): {
  adKey: string | null;
  archiveId: string | null;
} {
  if (!raw) return { adKey: null, archiveId: null };
  const adKey = typeof raw.ad_key === "string" ? raw.ad_key : null;
  const payload = raw.payload;
  let archiveId: string | null = null;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    archiveId =
      (typeof p.library_id === "string" ? p.library_id : null) ??
      (typeof p.ad_archive_id === "string" ? p.ad_archive_id : null) ??
      (typeof p.id === "string" ? p.id : null);
  }
  if (!archiveId && typeof raw.library_id === "string") archiveId = raw.library_id;
  return { adKey, archiveId };
}

/**
 * Strongest available creative signature for cross-source matching.
 * Priority: adlibrary ad_key > archive id > media URL > headline+landing
 */
export function creativeSignature(input: PlacementFingerprintInput): string {
  const rawExtract = extractFromRaw(input.raw);
  const adKey = input.adKey ?? rawExtract.adKey;
  if (adKey?.trim()) return `adk:${adKey.trim()}`;

  const archiveId = input.archiveId ?? rawExtract.archiveId;
  if (archiveId?.trim()) return `arc:${archiveId.trim()}`;

  const archiveUrl = input.sourceArchiveUrl?.trim();
  if (archiveUrl) return `url:${stableHash(normalizeUrlForHash(archiveUrl) ?? archiveUrl)}`;

  const media = normalizeUrlForHash(input.mediaUrl) ?? normalizeUrlForHash(input.creativeUrl);
  if (media) return `med:${stableHash(media)}`;

  const landingHost = (() => {
    if (!input.landingUrl?.trim()) return null;
    try {
      return new URL(input.landingUrl.trim()).hostname;
    } catch {
      return input.landingUrl.trim();
    }
  })();

  const text = normalizeTextForHash(
    input.headline ?? input.adTitle,
    input.rawCopy?.slice(0, 120),
    landingHost,
  );
  if (text.length >= 12) return `txt:${stableHash(text)}`;

  return `weak:${stableHash(normalizeTextForHash(input.domain, input.channelPlatform ?? input.channel ?? "unknown"))}`;
}

export function resolveChannelBucket(input: PlacementFingerprintInput): DisplayChannel {
  return bucketChannel(input.channelPlatform ?? input.channel ?? "Other");
}

/** Canonical fingerprint stored on ad_placements.canonical_fingerprint */
export function computeCanonicalFingerprint(input: PlacementFingerprintInput): string {
  const domain = domainRoot(input.domain);
  const channel = resolveChannelBucket(input);
  const sig = creativeSignature(input);
  return `can:${channel}:${domain}:${sig}`;
}

/** Legacy AdLibrary hash — kept for backward compat during backfill */
export function adlibraryNativeHash(adKey: string): string {
  return `adlibrary:${adKey}`;
}

export function fingerprintFromPlacementRow(row: Record<string, unknown>): string {
  const raw = (row.raw as Record<string, unknown> | null) ?? null;
  return computeCanonicalFingerprint({
    domain: String(row.domain ?? ""),
    channel: row.channel as string | null,
    channelPlatform: row.channel_platform as string | null,
    sourcePlatform: row.source_platform as string | null,
    adKey: raw?.ad_key as string | null,
    sourceArchiveUrl: row.source_archive_url as string | null,
    mediaUrl: row.media_url as string | null,
    creativeUrl: row.creative_url as string | null,
    landingUrl: row.landing_url as string | null,
    headline: row.headline as string | null,
    rawCopy: row.raw_copy as string | null,
    adTitle: row.ad_title as string | null,
    raw,
  });
}

export function sourceNativeIdFromRow(
  row: Record<string, unknown>,
  sourcePlatform: SourcePlatform,
): string | null {
  const raw = (row.raw as Record<string, unknown> | null) ?? null;
  if (sourcePlatform === "adlibrary") {
    const adKey = raw?.ad_key;
    if (typeof adKey === "string" && adKey.trim()) return adKey.trim();
  }
  if (sourcePlatform === "apify") {
    const id = raw?.library_id ?? raw?.ad_archive_id ?? raw?.id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  const archive = row.source_archive_url;
  if (typeof archive === "string" && archive.trim()) return archive.trim();
  const hash = row.creative_hash ?? row.canonical_fingerprint;
  if (typeof hash === "string" && hash.trim()) return hash.trim();
  return row.id != null ? String(row.id) : null;
}

/** Whether an incoming row should be skipped because a higher-authority source owns this channel. */
export function shouldSkipRedundantSource(
  channel: DisplayChannel,
  incomingSource: SourcePlatform,
  existingSources: SourcePlatform[],
): boolean {
  const auth = SOURCE_AUTHORITY[channel];
  if (!auth?.primary) return false;
  if (incomingSource === auth.primary) return false;
  if (!auth.secondary.includes(incomingSource)) return false;
  return existingSources.includes(auth.primary);
}
