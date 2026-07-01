/**
 * "So what?" quality gates — filters labels, tags, and copy that don't earn screen space.
 *
 * A field must either:
 * 1. Answer "so what?" for an account manager (implication, gap, threat, pitch angle), OR
 * 2. Be a concrete observed fact that supports a so-what (channel, CTA %, campaign name)
 *
 * It must NOT merely restate the metric or describe what the UI already shows.
 */

const SKIP_TAG_VALUES = new Set([
  "unspecified",
  "unknown",
  "other",
  "none",
  "n/a",
  "na",
  "unclassified",
  "general",
  "general activity",
  "not available",
  "tbd",
]);

const GENERIC_CTAS = new Set([
  "learn more",
  "see more",
  "find out more",
  "click here",
  "read more",
  "view more",
  "shop now",
  "book now",
  "sign up",
  "apply now",
  "website",
  "link",
]);

const BOILERPLATE_PATTERNS: RegExp[] = [
  /^creative detected for/i,
  /^copy unavailable from source feed/i,
  /^activity across \d+ indexed creat/i,
  /^this ad aims to/i,
  /^the focus on/i,
  /^n\/a$/i,
  /^—$/,
  /^todo$/i,
  /^placeholder/i,
  /valueless/i,
  /^protect against/i,
  /^counter [a-z0-9.-]+$/i,
];

const META_COMMENTARY_PATTERNS: RegExp[] = [
  /^this (ad|campaign|creative) (aims|seeks|attempts|tries)/i,
  /^the (brand|advertiser) is (trying|aiming|seeking)/i,
  /^appears to (target|focus|emphasize)/i,
  /^likely (aimed|targeted|designed) at/i,
];

export type FieldKind =
  | "observed_fact"
  | "distribution_label"
  | "so_what_narrative"
  | "ai_tag"
  | "action";

export type QualityVerdict = {
  ok: boolean;
  reason?: string;
  severity: "error" | "warn" | "info";
};

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isSkipTagValue(raw: string | null | undefined): boolean {
  const t = norm(raw ?? "");
  if (!t) return true;
  return SKIP_TAG_VALUES.has(t);
}

export function isGenericCta(raw: string | null | undefined): boolean {
  const t = norm(raw ?? "").replace(/[.!]+$/, "");
  if (!t) return true;
  return GENERIC_CTAS.has(t);
}

export function isBoilerplateText(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return true;
  return BOILERPLATE_PATTERNS.some((re) => re.test(t));
}

export function isMetaCommentary(raw: string | null | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  return META_COMMENTARY_PATTERNS.some((re) => re.test(t));
}

/** Observed facts: channel, spend band, ad count, date — OK to show without narrative */
export function isObservedFact(kind: FieldKind, value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  if (kind !== "observed_fact" && kind !== "distribution_label") return false;
  return !isSkipTagValue(value) && !isBoilerplateText(value);
}

/**
 * So-what narratives must imply action, threat, gap, or competitive move.
 * Reject if they only restate the headline/label.
 */
export function isSoWhatWorthy(
  text: string | null | undefined,
  contextLabel?: string | null,
): boolean {
  const t = (text ?? "").trim();
  if (!t || t.length < 24) return false;
  if (isBoilerplateText(t)) return false;
  if (isMetaCommentary(t)) return false;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 8) return false;

  if (contextLabel) {
    const labelNorm = norm(contextLabel);
    const textNorm = norm(t);
    if (textNorm === labelNorm) return false;
    if (textNorm.startsWith(labelNorm) && words.length < 12) return false;
  }

  const implicationSignals =
    /\b(pitch|counter|gap|opening|threat|opportunity|differentiat|respond|re-balance|own|fatigue|pressure|invest|concentrat|under-index|over-index|mirror|outbid|whitespace|unclaimed)\b/i;
  return implicationSignals.test(t);
}

export function assessFieldQuality(
  kind: FieldKind,
  value: string | null | undefined,
  contextLabel?: string | null,
): QualityVerdict {
  const t = (value ?? "").trim();

  if (!t) {
    return { ok: false, reason: "empty", severity: kind === "so_what_narrative" ? "warn" : "info" };
  }

  if (isSkipTagValue(t)) {
    return { ok: false, reason: "unspecified tag value", severity: "error" };
  }

  if (kind === "ai_tag" && isGenericCta(t)) {
    return { ok: false, reason: "generic CTA — not a meaningful tag", severity: "warn" };
  }

  if (isBoilerplateText(t)) {
    return { ok: false, reason: "boilerplate / placeholder text", severity: "error" };
  }

  if (kind === "so_what_narrative") {
    if (isMetaCommentary(t)) {
      return { ok: false, reason: "describes the ad instead of implying action", severity: "error" };
    }
    if (!isSoWhatWorthy(t, contextLabel)) {
      return { ok: false, reason: "does not answer 'so what?' for an account manager", severity: "warn" };
    }
  }

  if (kind === "action") {
    const wordCount = t.split(/\s+/).filter(Boolean).length;
    if (wordCount > 18) {
      return { ok: false, reason: "action too long — should be a headline not a paragraph", severity: "warn" };
    }
  }

  return { ok: true, severity: "info" };
}

/** Placement row AI/enrichment fields to audit */
export const PLACEMENT_QUALITY_FIELDS = [
  { key: "strategist_takeaway", kind: "so_what_narrative" as const },
  { key: "hook_analysis", kind: "so_what_narrative" as const },
  { key: "market_signal", kind: "so_what_narrative" as const },
  { key: "offer_signal", kind: "so_what_narrative" as const },
  { key: "emotional_driver", kind: "ai_tag" as const },
  { key: "primary_cta", kind: "ai_tag" as const },
  { key: "detected_cta", kind: "ai_tag" as const },
  { key: "buyer_stage", kind: "ai_tag" as const },
  { key: "product_type", kind: "ai_tag" as const },
  { key: "campaign_cluster", kind: "distribution_label" as const },
  { key: "channel_platform", kind: "observed_fact" as const },
] as const;

export type PlacementQualityIssue = {
  placementId: number | string;
  domain: string;
  field: string;
  value: string;
  reason: string;
  severity: "error" | "warn" | "info";
};

export function auditPlacementRow(row: Record<string, unknown>): PlacementQualityIssue[] {
  const issues: PlacementQualityIssue[] = [];
  const id = row.id ?? "?";
  const domain = String(row.domain ?? "");

  for (const { key, kind } of PLACEMENT_QUALITY_FIELDS) {
    const value = row[key];
    if (value == null || String(value).trim() === "") continue;
    const verdict = assessFieldQuality(kind, String(value));
    if (!verdict.ok && verdict.reason) {
      issues.push({
        placementId: id as number | string,
        domain,
        field: key,
        value: String(value).slice(0, 80),
        reason: verdict.reason,
        severity: verdict.severity,
      });
    }
  }

  return issues;
}
