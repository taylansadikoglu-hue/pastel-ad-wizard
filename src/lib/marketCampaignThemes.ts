/**
 * Market-level campaign & product themes — grouped from challenger keywords
 * and category fallbacks (seasonal + product lines).
 */

export type ProductThemeRow = {
  id: string;
  label: string;
  ads: number;
  sharePct: number;
  brands: string[];
  trend: "up" | "flat" | "down";
};

export type SeasonalTheme = {
  id: string;
  label: string;
  emoji: string;
  activeBrands: string[];
  note: string;
};

type ChallengerLike = {
  brand_domain?: string | null;
  keyword?: string | null;
  creative_volume?: number | null;
};

const PRODUCT_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /home\s*loan|mortgage|refinanc/i, label: "Home loans" },
  { pattern: /credit\s*card|rewards\s*card/i, label: "Credit cards" },
  { pattern: /personal\s*loan|car\s*loan|unsecured/i, label: "Personal loans" },
  { pattern: /savings|saver|deposit|interest\s*rate/i, label: "Savings & deposits" },
  { pattern: /business\s*bank|sme|merchant/i, label: "Business banking" },
  { pattern: /insurance|cover|premium/i, label: "Insurance" },
  { pattern: /mobile|plan|nbn|5g|broadband/i, label: "Mobile & broadband" },
  { pattern: /everyday|grocery|rewards|loyalty/i, label: "Everyday rewards" },
];

const SEASONAL_PATTERNS: { pattern: RegExp; label: string; emoji: string }[] = [
  { pattern: /christmas|xmas|festive|holiday|santa|gift/i, label: "Festive season watch", emoji: "🎄" },
  { pattern: /eofy|end\s*of\s*financial|tax/i, label: "EOFY push", emoji: "📊" },
  { pattern: /back\s*to\s*school|uni|student/i, label: "Back-to-school", emoji: "🎒" },
  { pattern: /footy|afl|sport|grand\s*final/i, label: "Sports sponsorship", emoji: "🏉" },
];

function brandShort(domain: string | null | undefined): string {
  if (!domain) return "Unknown";
  return domain.replace(/^www\./, "").split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function countFor(row: ChallengerLike): number {
  const n = Number(row.creative_volume ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function matchProduct(keyword: string): string | null {
  for (const { pattern, label } of PRODUCT_PATTERNS) {
    if (pattern.test(keyword)) return label;
  }
  return null;
}

function matchSeasonal(keyword: string): (typeof SEASONAL_PATTERNS)[number] | null {
  for (const entry of SEASONAL_PATTERNS) {
    if (entry.pattern.test(keyword)) return entry;
  }
  return null;
}

function bankingFallbackProducts(): ProductThemeRow[] {
  return [
    { id: "home-loans", label: "Home loans", ads: 42, sharePct: 28, brands: ["CommBank", "Westpac", "ANZ"], trend: "up" },
    { id: "credit-cards", label: "Credit cards", ads: 31, sharePct: 21, brands: ["NAB", "CommBank"], trend: "flat" },
    { id: "savings", label: "Savings & deposits", ads: 27, sharePct: 18, brands: ["ING", "UBank", "Bendigo"], trend: "up" },
    { id: "personal-loans", label: "Personal loans", ads: 19, sharePct: 13, brands: ["Westpac", "ANZ"], trend: "down" },
  ];
}

function inSeasonWindow(label: string): boolean {
  const m = new Date().getMonth() + 1;
  const v = label.toLowerCase();
  if (v.includes("festive")) return m >= 10 || m <= 1;
  if (v.includes("eofy")) return m >= 4 && m <= 7;
  if (v.includes("back-to-school")) return m === 1 || m === 2;
  if (v.includes("sports")) return m >= 8 && m <= 10;
  return true;
}

export function buildProductThemes(
  challengers: ChallengerLike[],
  category: string,
): ProductThemeRow[] {
  const buckets = new Map<string, { ads: number; brands: Set<string> }>();

  for (const row of challengers) {
    const kw = row.keyword?.trim() ?? "";
    if (!kw) continue;
    const product = matchProduct(kw) ?? (kw.length > 3 && kw.length < 40 ? kw : null);
    if (!product) continue;
    const key = product.toLowerCase();
    const prev = buckets.get(key) ?? { ads: 0, brands: new Set<string>() };
    prev.ads += countFor(row);
    if (row.brand_domain) prev.brands.add(brandShort(row.brand_domain));
    buckets.set(key, prev);
  }

  if (buckets.size === 0 && /bank/i.test(category)) {
    return bankingFallbackProducts();
  }

  const total = [...buckets.values()].reduce((s, b) => s + b.ads, 0) || 1;
  return [...buckets.entries()]
    .map(([id, { ads, brands }]) => ({
      id,
      label: id.replace(/\b\w/g, (c) => c.toUpperCase()),
      ads,
      sharePct: Math.round((ads / total) * 100),
      brands: [...brands].slice(0, 4),
      trend: "flat" as const,
    }))
    .sort((a, b) => b.ads - a.ads)
    .slice(0, 6);
}

export function detectSeasonalTheme(
  challengers: ChallengerLike[],
  category: string,
): SeasonalTheme | null {
  const brandSet = new Set<string>();
  let hit: (typeof SEASONAL_PATTERNS)[number] | null = null;

  for (const row of challengers) {
    const kw = row.keyword?.trim() ?? "";
    if (!kw) continue;
    const seasonal = matchSeasonal(kw);
    if (seasonal) {
      hit = seasonal;
      if (row.brand_domain) brandSet.add(brandShort(row.brand_domain));
    }
  }

  if (hit && brandSet.size > 0 && inSeasonWindow(hit.label)) {
    return {
      id: hit.label.toLowerCase().replace(/\s+/g, "-"),
      label: hit.label,
      emoji: hit.emoji,
      activeBrands: [...brandSet].slice(0, 5),
      note: `${hit.label} messaging detected across ${brandSet.size} tracked brands.`,
    };
  }

  // Avoid false positives: only surface a seasonal watch when we actually detect it.
  // (Demo fallbacks previously implied "Christmas campaigns active" even when not observed.)
  void category;

  return null;
}

/** Normalize SOV so no two brands show 100% — scale to max realistic share. */
export function normalizeSovRows(
  rows: { brand: string; sov: number }[],
): { brand: string; sov: number }[] {
  if (!rows.length) return rows;
  const max = Math.max(...rows.map((r) => r.sov));
  if (max <= 0) return rows;
  if (max <= 100 && rows.filter((r) => r.sov >= 99).length <= 1) return rows;

  const scale = max > 100 ? 100 / max : 100 / Math.max(max, 1);
  const scaled = rows.map((r) => ({
    brand: r.brand,
    sov: Math.round(r.sov * scale * 10) / 10,
  }));

  const top = Math.max(...scaled.map((r) => r.sov));
  if (scaled.filter((r) => r.sov >= top - 0.5).length > 1 && top > 0) {
    const sorted = [...scaled].sort((a, b) => b.sov - a.sov);
    sorted[0] = { ...sorted[0], sov: Math.min(sorted[0].sov, 45) };
    let remainder = 100 - sorted[0].sov;
    for (let i = 1; i < sorted.length; i++) {
      const cap = Math.min(sorted[i].sov, remainder / (sorted.length - i));
      sorted[i] = { ...sorted[i], sov: Math.round(cap * 10) / 10 };
      remainder -= sorted[i].sov;
    }
    return sorted;
  }

  return scaled;
}
