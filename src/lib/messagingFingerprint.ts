import type { CampaignIntelligence } from "@/lib/campaignIntelligence";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import type { SayingSection } from "@/lib/radAdvertiserBrief";

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

function mapSlices(
  rows: { label: string; pct: number }[],
  limit = 4,
): MessagingSlice[] {
  return rows
    .filter((r) => r.pct > 0 && shortMessagingLabel(r.label))
    .slice(0, limit)
    .map((r) => ({
      label: r.label,
      shortLabel: shortMessagingLabel(r.label),
      pct: r.pct,
    }));
}

function pickHeadline(saying: SayingSection | null | undefined): string | null {
  if (!saying) return null;
  for (const raw of [...saying.hooks, ...saying.copySnippets]) {
    const short = shortMessagingLabel(raw, 6);
    if (short && short.length <= 42) return short;
  }
  return null;
}

export function buildMessagingFingerprint(
  campaignIntel: CampaignIntelligence | null,
  strategistIntel: AdvertiserStrategistIntel | null,
  saying: SayingSection | null | undefined,
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
    (campaignIntel?.ctaBreakdown ?? []).map((r) => ({ label: r.label, pct: r.pct })),
  );

  if (!ctas.length && strategistIntel?.topCta) {
    ctas.push({
      label: strategistIntel.topCta,
      shortLabel: shortMessagingLabel(strategistIntel.topCta),
      pct: 100,
    });
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
    headline: pickHeadline(saying),
  };
}

export { TONE_COLOURS };
