/** Minimum creatives a message must appear in before we surface it on Market Intel. */
const MIN_CREATIVE_COUNT = 3;

/** Generic AI tags that are not pitch-ready on their own. */
const BLOCKED_PHRASES = new Set([
  "globalization",
  "belonging",
  "importance of choice",
  "trust",
  "community",
  "innovation",
  "quality",
  "value",
  "lifestyle",
  "empowerment",
  "connection",
  "authenticity",
]);

export function normalizeThemePhrase(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isCommerciallyMeaningfulPhrase(phrase: string): boolean {
  const normalized = normalizeThemePhrase(phrase);
  if (!normalized || normalized.length < 4) return false;
  if (BLOCKED_PHRASES.has(normalized)) return false;
  if (/^(positive|neutral|negative|happy|sad|urgency)$/.test(normalized)) return false;
  return true;
}

type ThemeCountInput = {
  keyword?: string | null;
  creative_volume?: number | null;
};

/** Aggregate keyword/message counts from challenger rows (best available proxy for creative volume). */
export function aggregateThemeCounts(rows: ThemeCountInput[]): Map<string, { label: string; count: number }> {
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of rows) {
    const raw = row.keyword?.trim();
    if (!raw) continue;
    const key = normalizeThemePhrase(raw);
    const add = Math.max(1, Number(row.creative_volume) || 1);
    const prev = counts.get(key);
    counts.set(key, {
      label: prev?.label ?? raw,
      count: (prev?.count ?? 0) + add,
    });
  }
  return counts;
}

export function qualifyingMarketThemes(
  rows: ThemeCountInput[],
  extras: Array<string | null | undefined> = [],
): string[] {
  const counts = aggregateThemeCounts(rows);

  for (const extra of extras) {
    const raw = extra?.trim();
    if (!raw) continue;
    const key = normalizeThemePhrase(raw);
    const prev = counts.get(key);
    counts.set(key, {
      label: prev?.label ?? raw,
      count: (prev?.count ?? 0) + 1,
    });
  }

  return Array.from(counts.values())
    .filter(({ label, count }) => count >= MIN_CREATIVE_COUNT && isCommerciallyMeaningfulPhrase(label))
    .sort((a, b) => b.count - a.count)
    .map(({ label }) => label)
    .slice(0, 8);
}

export function dominantQualifyingTheme(
  rows: ThemeCountInput[],
  candidate: string | null | undefined,
): string | null {
  if (!candidate?.trim()) return null;
  const key = normalizeThemePhrase(candidate);
  const counts = aggregateThemeCounts(rows);
  const entry = counts.get(key);
  if (!entry || entry.count < MIN_CREATIVE_COUNT) return null;
  if (!isCommerciallyMeaningfulPhrase(entry.label)) return null;
  return entry.label;
}
