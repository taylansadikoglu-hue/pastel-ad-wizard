/**
 * Data trust helpers — normalisation, preview math, provenance labels.
 * Every surfaced number should be traceable to observed rows or marked preview/estimated.
 */

export type DataConfidence = "High" | "Medium" | "Low" | "Preview";

export type DataProvenance = {
  sampleSize: number;
  source: string;
  confidence: DataConfidence;
  updatedLabel?: string | null;
  note?: string | null;
};

const CTA_ALIASES: [RegExp, string][] = [
  [/^learn\s+more(\s+about)?$/i, "Learn more"],
  [/^get\s+a\s+quote$/i, "Get a quote"],
  [/^open\s+an?\s+account$/i, "Open account"],
  [/^apply\s+now$/i, "Apply now"],
  [/^sign\s+up$/i, "Sign up"],
  [/^find\s+out\s+more$/i, "Find out more"],
  [/^book\s+now$/i, "Book now"],
  [/^shop\s+now$/i, "Shop now"],
];

export function normalizeCtaLabel(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || /^(unspecified|unknown|other|none|n\/a)$/i.test(t)) return null;
  for (const [pattern, label] of CTA_ALIASES) {
    if (pattern.test(t)) return label;
  }
  if (t.length > 28) return t.split(/\s+/).slice(0, 3).join(" ");
  return t;
}

export function normalizeCampaignLabel(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "General activity";
  const collapsed = t.replace(/\s+/g, " ");
  return collapsed
    .split(" ")
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function campaignGroupKey(raw: string | null | undefined): string {
  return normalizeCampaignLabel(raw).toLowerCase();
}

/** Merge distribution rows by normalised label (e.g. Learn More + Learn More About). */
export function mergeDistributionRows(
  rows: { label: string; count: number; pct: number }[],
  normalizer: (label: string) => string | null,
): { label: string; count: number; pct: number }[] {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const key = normalizer(row.label) ?? row.label;
    if (!key || /^(unspecified|unknown)$/i.test(key)) continue;
    merged.set(key, (merged.get(key) ?? 0) + row.count);
  }
  const total = [...merged.values()].reduce((a, b) => a + b, 0) || 1;
  return [...merged.entries()]
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Preview SOV weights that always sum to 100. */
export function previewSovWeights(brandCount: number): number[] {
  if (brandCount <= 0) return [];
  const raw = Array.from({ length: brandCount }, (_, i) => Math.max(1, brandCount - i));
  const sum = raw.reduce((a, b) => a + b, 0);
  const pcts = raw.map((w) => (w / sum) * 100);
  const rounded = pcts.map((p) => Math.round(p * 10) / 10);
  const drift = Math.round((100 - rounded.reduce((a, b) => a + b, 0)) * 10) / 10;
  if (rounded.length && Math.abs(drift) >= 0.1) rounded[0] = Math.round((rounded[0] + drift) * 10) / 10;
  return rounded;
}

export function isUsableHeadline(raw: string | null | undefined): string | null {
  const t = (raw ?? "").trim();
  if (!t || t.length < 12) return null;
  if (!/[.!?]$/.test(t) && t.length > 48) return null;
  if (/^(the focus on|aims to|this ad|creative)/i.test(t) && !t.includes(".")) return null;
  if (t.length > 56) return `${t.slice(0, 55).trim()}…`;
  return t;
}

export function formatProvenanceLine(p: DataProvenance): string {
  const parts = [
    p.sampleSize > 0 ? `n=${p.sampleSize.toLocaleString()}` : null,
    p.source,
    `confidence: ${p.confidence}`,
    p.updatedLabel,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function dedupeActions(actions: string[], exclude?: string | null): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const excludeNorm = exclude ? norm(exclude) : "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of actions) {
    const s = raw.trim();
    if (!s) continue;
    const key = norm(s);
    if (!key || seen.has(key)) continue;
    if (excludeNorm && (key === excludeNorm || key.includes(excludeNorm) || excludeNorm.includes(key))) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** One-line action for hero cards — not a paragraph. */
export function shortActionHeadline(text: string | null | undefined, maxWords = 10): string {
  const t = (text ?? "").trim();
  if (!t) return "—";
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return t;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function formatObservedDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const now = Date.now();
  if (d.getTime() > now + 86_400_000) return null;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
