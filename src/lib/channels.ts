/**
 * Canonical display channels for channel mix, filters, and placement tagging.
 */

export const DISPLAY_CHANNELS = [
  "Display",
  "YouTube",
  "Search",
  "Meta",
  "TikTok",
  "LinkedIn",
  "Other",
] as const;

export type DisplayChannel = (typeof DISPLAY_CHANNELS)[number];

/** Map raw channel_platform / channel / ad_type to a display bucket. */
export function normaliseChannelBadge(raw: string | null | undefined): DisplayChannel | null {
  const r = String(raw ?? "").toLowerCase();
  if (!r) return null;
  if (r.includes("youtube")) return "YouTube";
  if (r.includes("search") || r === "google") return "Search";
  if (r.includes("display") || r.includes("programmatic")) return "Display";
  if (r.includes("meta") || r.includes("facebook") || r.includes("instagram")) return "Meta";
  if (r.includes("tiktok")) return "TikTok";
  if (r.includes("linkedin")) return "LinkedIn";
  return "Other";
}

export function isDisplayChannel(value: string): value is DisplayChannel {
  return (DISPLAY_CHANNELS as readonly string[]).includes(value);
}

export function bucketChannel(value: string): DisplayChannel {
  const badge = normaliseChannelBadge(value);
  if (badge && isDisplayChannel(badge)) return badge;
  return "Other";
}
