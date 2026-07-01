import type { CampaignIntelligence } from "@/lib/campaignIntelligence";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import type { SayingSection } from "@/lib/radAdvertiserBrief";
import { isUsableHeadline, normalizeCtaLabel } from "@/lib/dataTrust";
import { isBrandLikeLabel, isMeaningfulCta } from "@/lib/placementCta";
import { isGenericCta } from "@/lib/soWhatQuality";

export type MessagingSlice = {
  label: string;
  shortLabel: string;
  pct: number;
};

export type MessagingFingerprint = {
  tones: MessagingSlice[];
  ctas: MessagingSlice[];
  stage: string | null;
  archetype: string | null;
  headline: string | null;
};

const TONE_COLOURS = ["#7C3AED", "#A78BFA", "#C4B5FD", "#DDD6FE"];

const SKIP_LABELS = new Set(["unspecified", "unknown", "other", "none", "unclassified"]);

export function shortMessagingLabel(raw: string, maxWords = 3): string {
  const t = raw.trim();
  if (!t || SKIP_LABELS.has(t.toLowerCase())) return "";
  if (t.length <= 18 && t.split(/\s+/).length <= 2) return t;
  return t.split(/\s+/).slice(0, maxWords).join(" ");
}

function mergeSlicesByLabel(
  rows: { label: string; pct: number }[],
  normalizer?: (label: string) => string | null,
): { label: string; pct: number }[] {
  const merged = new Map<string, { label: string; pct: number }>();
  for (const row of rows) {
    const label = normalizer?.(row.label) ?? row.label;
    if (!label || !shortMessagingLabel(label)) continue;
    const key = label.toLowerCase();
    const existing = merged.get(key);
    if (existing) existing.pct = Math.round((existing.pct + row.pct) * 10) / 10;
    else merged.set(key, { label, pct: row.pct });
  }
  return [...merged.values()].sort((a, b) => b.pct - a.pct);
}

function mapSlices(
  rows: { label: string; pct: number }[],
  limit = 4,
  normalizer?: (label: string) => string | null,
): MessagingSlice[] {
  return mergeSlicesByLabel(rows, normalizer)
    .filter((r) => r.pct > 0)
    .slice(0, limit)
    .map((r) => ({
      label: r.label,
      shortLabel: shortMessagingLabel(r.label),
      pct: r.pct,
    }));
}

function pickHeadline(saying: SayingSection | null | undefined, brand?: string | null): string | null {
  if (!saying) return null;
  for (const raw of saying.copySnippets) {
    const usable = isUsableHeadline(raw);
    if (usable && !isBrandLikeLabel(usable, brand)) return usable;
  }
  for (const raw of saying.hooks) {
    const usable = isUsableHeadline(raw);
    if (usable && !isBrandLikeLabel(usable, brand)) return usable;
  }
  return null;
}

export function buildMessagingFingerprint(
  campaignIntel: CampaignIntelligence | null,
  strategistIntel: AdvertiserStrategistIntel | null,
  saying: SayingSection | null | undefined,
  brand?: string | null,
): MessagingFingerprint {
  const tones = mapSlices(
    (campaignIntel?.messagingBreakdown ?? []).map((r) => ({ label: r.label, pct: r.pct })),
  );

  if (!tones.length && strategistIntel?.topEmotion) {
    tones.push({
      label: strategistIntel.topEmotion,
      shortLabel: shortMessagingLabel(strategistIntel.topEmotion),
      pct: 100,
    });
  }

  const ctas = mapSlices(
    (campaignIntel?.ctaBreakdown ?? []).map((r) => ({
      label: normalizeCtaLabel(r.label) ?? r.label,
      pct: r.pct,
    })),
    4,
    (label) => {
      const n = normalizeCtaLabel(label) ?? label;
      if (!n || isBrandLikeLabel(n, brand)) return null;
      if (!isMeaningfulCta(n, brand) && isGenericCta(n)) return null;
      return n;
    },
  );

  if (!ctas.length && strategistIntel?.topCta) {
    const cta = normalizeCtaLabel(strategistIntel.topCta) ?? strategistIntel.topCta;
    if (isMeaningfulCta(cta, brand)) {
      ctas.push({
        label: cta,
        shortLabel: shortMessagingLabel(cta),
        pct: 100,
      });
    }
  }

  const stage =
    shortMessagingLabel(saying?.buyerStages?.[0] ?? "") ||
    shortMessagingLabel(strategistIntel?.topBuyerStage ?? "") ||
    null;

  const archetype = shortMessagingLabel(strategistIntel?.positioningArchetype ?? "") || null;

  return {
    tones,
    ctas,
    stage,
    archetype,
    headline: pickHeadline(saying, brand),
  };
}

export { TONE_COLOURS };
