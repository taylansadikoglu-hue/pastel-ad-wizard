/** AI tag cache freshness — retag URLs older than this many days. */

export const TAG_RETAG_DAYS = Number(process.env.TAG_RETAG_DAYS ?? 30);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TagCacheStatus = "new" | "fresh" | "stale";

export function tagCacheStatus(
  aiTaggedAt: string | null | undefined,
  now = Date.now(),
): TagCacheStatus {
  if (!aiTaggedAt) return "new";
  const taggedMs = new Date(aiTaggedAt).getTime();
  if (Number.isNaN(taggedMs)) return "new";
  const ageDays = (now - taggedMs) / MS_PER_DAY;
  return ageDays < TAG_RETAG_DAYS ? "fresh" : "stale";
}

export function isAiTagFresh(
  aiTaggedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  return tagCacheStatus(aiTaggedAt, now) === "fresh";
}

export function tagRetagAfterIso(now = Date.now()): string {
  return new Date(now - TAG_RETAG_DAYS * MS_PER_DAY).toISOString();
}
