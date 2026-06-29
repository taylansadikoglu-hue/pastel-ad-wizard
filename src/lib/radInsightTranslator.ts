/** Theme selection and agency-facing copy for Market Intel — existing data only. */

const MIN_DISTINCT_ADS = 3;

/** Single-word abstract nouns — never surface raw in UI regardless of count. */
const BLOCKED_SINGLE_WORD = new Set([
  "belonging",
  "globalization",
  "choice",
  "trust",
  "freedom",
  "community",
  "innovation",
]);

/** Raw theme/emotion → campaign territory (agency-facing). */
export const TERRITORY_MAP: Record<string, string> = {
  curiosity: "Smarter choice territory",
  greed: "Value and savings territory",
  aspiration: "Progress and future goals territory",
  trust: "Security and confidence territory",
  fear: "Risk reduction territory",
  belonging: "Community and support territory",
};

const BANNED_PHRASES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /controlled creative baseline/gi, replacement: "trust-led control creative" },
  { pattern: /evidenced territory/gi, replacement: "campaign territory" },
  { pattern: /dominant trust territory/gi, replacement: "security and confidence messaging" },
  { pattern: /threat score/gi, replacement: "observed pressure" },
  { pattern: /opportunity score/gi, replacement: "signal strength" },
  { pattern: /strategic whitespace/gi, replacement: "open positioning" },
  { pattern: /data utility/gi, replacement: "market signal" },
  {
    pattern: /Test\s+"?([^".]+)"?\s+against a trust-led control creative[^.]*\./gi,
    replacement: "",
  },
];

export type ThemeAdRow = {
  keyword?: string | null;
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

/** Strip engineer labels and rewrite API boilerplate for client-facing UI. */
export function sanitizeInsightCopy(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  let out = text.trim();
  for (const { pattern, replacement } of BANNED_PHRASES) {
    out = out.replace(pattern, replacement);
  }
  out = out.replace(/\s{2,}/g, " ").replace(/\s+([,.])/g, "$1").trim();
  return out;
}

/** Map raw emotion/theme keyword to campaign territory label. */
export function translateTerritory(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Open positioning territory";
  const key = normalizeTheme(raw);
  if (TERRITORY_MAP[key]) return TERRITORY_MAP[key];
  const cleaned = sanitizeInsightCopy(raw);
  if (/territory$/i.test(cleaned)) return cleaned;
  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)} territory`;
}

/** Short phrase for narrative copy (lowercase, no "territory" suffix). */
export function territoryNounPhrase(raw: string | null | undefined): string {
  const label = translateTerritory(raw);
  return label.replace(/\s+territory$/i, "").toLowerCase();
}

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

export function selectSurfacedThemes(rows: ThemeAdRow[]): string[] {
  return Array.from(aggregateThemeAdCounts(rows).values())
    .filter(({ label, ads }) => ads >= MIN_DISTINCT_ADS && !isBlockedAbstractNoun(label))
    .sort((a, b) => b.ads - a.ads)
    .map(({ label }) => translateTerritory(label))
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
  return translateTerritory(entry.label);
}

export function isThemeAllowed(phrase: string | null | undefined): boolean {
  if (!phrase?.trim()) return false;
  return !isBlockedAbstractNoun(phrase);
}

/** "What this means" — plain-language read after the headline. */
export function buildWhatThisMeans(input: {
  clientName: string;
  category: string;
  dominantTheme?: string | null;
  openTheme?: string | null;
}): string {
  const client = input.clientName.trim() || "Your client";
  const category = input.category.trim() || "This category";
  const dominant = territoryNounPhrase(input.dominantTheme ?? "trust");
  const open = territoryNounPhrase(input.openTheme ?? "curiosity");

  return (
    `${category} activity is crowded, but most brands are competing on ${dominant} and reliability. ` +
    `That makes it harder for ${client} to stand out with generic confidence messaging. ` +
    `The clearest opportunity is to test a more distinctive territory around ${open}, flexibility, and customer control.`
  );
}

/** Open-angle card body — actionable, not abstract. */
export function buildOpenAngleCopy(input: {
  clientName: string;
  territoryRaw: string;
  brandCount?: number;
  saturated?: boolean;
}): string {
  const client = input.clientName.trim() || "Your client";
  const key = normalizeTheme(input.territoryRaw);
  const territory = translateTerritory(input.territoryRaw);
  const territoryLower = territory.replace(/\s+territory$/i, "").toLowerCase();

  const angleByTheme: Record<string, string> = {
    curiosity:
      "discovery-led messaging that helps customers feel they are finding a smarter, more flexible option",
    greed: "value, savings, and everyday banking benefits customers can act on now",
    aspiration: "progress, future goals, and the next step customers are working toward",
    trust: "security and confidence without sounding like every other bank in the category",
    fear: "risk reduction and peace of mind around money decisions",
    belonging: "community support and belonging that feels local and human",
  };

  const angle = angleByTheme[key] ?? `${territoryLower} messaging with a clear customer benefit`;

  if (input.saturated) {
    return (
      `Several competitors already use ${territoryLower} messaging. ${client} would need a sharper, ` +
      `offer-led angle to stand out rather than matching the same theme.`
    );
  }

  return (
    `Competitors are not consistently owning ${territoryLower} messaging. ${client} could test creative ` +
    `around ${angle}.`
  );
}

/** Exactly three concrete recommended moves for the pitch. */
export function buildRecommendedMoves(clientName?: string | null): string[] {
  const client = clientName?.trim() || "Your client";
  return [
    "Test a smarter-choice campaign territory against trust-led control creative.",
    "Build one offer-led execution around value, savings, or everyday banking benefits.",
    "Review Meta/Search coverage for competitors before deciding whether to defend or attack those channels.",
  ].map((line) => line.replace("Your client", client));
}

export type LouderBrandRow = {
  brand: string;
  label: string;
};

/** Single ranked list for "Who is getting louder". */
export function buildLouderRankList(
  threats: { competitor_domain?: string | null; threat_score?: number | null }[],
  momentum: { brand_domain?: string | null; momentum?: string | null; latest_interest?: number | null }[],
  strongestThreat?: string | null,
): LouderBrandRow[] {
  const seen = new Set<string>();
  const rows: LouderBrandRow[] = [];

  const add = (brand: string | null | undefined, label: string) => {
    if (!brand?.trim()) return;
    const key = brand.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ brand: brand.trim(), label });
  };

  const sortedThreats = [...threats].sort(
    (a, b) => (Number(b.threat_score) || 0) - (Number(a.threat_score) || 0),
  );
  const sortedMomentum = [...momentum].sort(
    (a, b) => (Number(b.latest_interest) || 0) - (Number(a.latest_interest) || 0),
  );

  if (sortedThreats[0]?.competitor_domain) {
    const top = sortedThreats[0].competitor_domain!;
    const isStrongest =
      !strongestThreat ||
      top.toLowerCase().includes(strongestThreat.toLowerCase()) ||
      strongestThreat.toLowerCase().includes(top.toLowerCase().replace(/\s+/g, ""));
    add(top, isStrongest ? "Highest observed pressure" : "Active and rising");
  }

  for (const t of sortedThreats.slice(1, 5)) {
    add(t.competitor_domain, "Active and rising");
  }

  for (const m of sortedMomentum) {
    if (rows.length >= 5) break;
    const rising = (m.momentum ?? "").toLowerCase().includes("ris");
    add(m.brand_domain, rising ? "Active and rising" : "Observed activity");
  }

  return rows.slice(0, 5);
}

export type ChannelMixRow = { channel: string; pct: number };

const CHANNEL_ORDER = ["Display", "YouTube", "Search", "Meta", "Other"];

/** Parse channel mix from bundle extras when present; otherwise empty. */
export function parseMarketChannelMix(
  raw: Record<string, unknown> | null | undefined,
): ChannelMixRow[] {
  if (!raw) return [];
  const byChannel = raw.byChannel ?? raw.by_channel ?? raw.channels;
  if (!byChannel || typeof byChannel !== "object") return [];

  if (Array.isArray(byChannel)) {
    return (byChannel as { channel?: string; pct?: number }[])
      .map((row) => ({
        channel: String(row.channel ?? ""),
        pct: Number(row.pct ?? 0),
      }))
      .filter((r) => r.channel && r.pct > 0)
      .sort((a, b) => b.pct - a.pct);
  }

  const record = byChannel as Record<string, { pct?: number; percentage?: number } | number>;
  const rows: ChannelMixRow[] = [];
  for (const [key, val] of Object.entries(record)) {
    const pct = typeof val === "number" ? val : Number(val?.pct ?? val?.percentage ?? 0);
    if (pct > 0) rows.push({ channel: key, pct });
  }
  return rows.sort((a, b) => {
    const ai = CHANNEL_ORDER.indexOf(a.channel);
    const bi = CHANNEL_ORDER.indexOf(b.channel);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || b.pct - a.pct;
  });
}

/** Spend range from bundle when available. */
export function parseSpendRange(
  raw: Record<string, unknown> | null | undefined,
): { low: number; high: number; label: string } | null {
  if (!raw) return null;
  const spend = raw.spend ?? raw.market_spend ?? raw.estimated_spend;
  if (!spend || typeof spend !== "object") return null;
  const s = spend as Record<string, unknown>;
  const low = Number(s.low ?? s.min ?? s.est_monthly_aud_min ?? 0);
  const high = Number(s.high ?? s.max ?? s.est_monthly_aud ?? s.est_monthly_aud_max ?? 0);
  if (!Number.isFinite(low) || !Number.isFinite(high) || (low <= 0 && high <= 0)) return null;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
  return {
    low: Math.min(low, high),
    high: Math.max(low, high),
    label: `${fmt(Math.min(low, high))}–${fmt(Math.max(low, high))} / month (directional)`,
  };
}
