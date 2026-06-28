/** Theme selection for Market Intel — must pass count + commercial-value gates. */

const MIN_DISTINCT_ADS = 3;

/** Single-word abstract nouns — never surface as insights regardless of count. */
const BLOCKED_SINGLE_WORD = new Set([
  "belonging",
  "globalization",
  "choice",
  "trust",
  "freedom",
  "community",
  "innovation",
]);

export type ThemeAdRow = {
  keyword?: string | null;
  /** Distinct ads this theme was observed on (or creative volume proxy). */
  ad_count?: number | null;
  creative_volume?: number | null;
};

export function normalizeTheme(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function adCountForRow(row: ThemeAdRow): number {
  const n = Number(row.ad_count ?? row.creative_volume ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function isBlockedAbstractNoun(phrase: string): boolean {
  const normalized = normalizeTheme(phrase);
  if (!normalized) return true;
  const words = normalized.split(" ");
  if (words.length === 1 && BLOCKED_SINGLE_WORD.has(normalized)) return true;
  for (const w of words) {
    if (BLOCKED_SINGLE_WORD.has(w)) return true;
  }
  return false;
}

/** Aggregate themes by distinct-ad count across rows. */
export function aggregateThemeAdCounts(rows: ThemeAdRow[]): Map<string, { label: string; ads: number }> {
  const counts = new Map<string, { label: string; ads: number }>();
  for (const row of rows) {
    const raw = row.keyword?.trim();
    if (!raw) continue;
    const key = normalizeTheme(raw);
    const add = adCountForRow(row);
    const prev = counts.get(key);
    counts.set(key, {
      label: prev?.label ?? raw,
      ads: (prev?.ads ?? 0) + add,
    });
  }
  return counts;
}

/** Themes that qualify for surfacing on Market Intel. */
export function selectSurfacedThemes(rows: ThemeAdRow[]): string[] {
  return Array.from(aggregateThemeAdCounts(rows).values())
    .filter(({ label, ads }) => ads >= MIN_DISTINCT_ADS && !isBlockedAbstractNoun(label))
    .sort((a, b) => b.ads - a.ads)
    .map(({ label }) => label)
    .slice(0, 8);
}

export function selectDominantTheme(
  rows: ThemeAdRow[],
  candidate: string | null | undefined,
): string | null {
  if (!candidate?.trim()) return null;
  const key = normalizeTheme(candidate);
  const entry = aggregateThemeAdCounts(rows).get(key);
  if (!entry || entry.ads < MIN_DISTINCT_ADS) return null;
  if (isBlockedAbstractNoun(entry.label)) return null;
  return entry.label;
}

export function isThemeAllowed(phrase: string | null | undefined): boolean {
  if (!phrase?.trim()) return false;
  return !isBlockedAbstractNoun(phrase);
}
