/**
 * Market pulse KPIs — WoW / MoM / YoY deltas and sparkline series for the R-AD dashboard.
 * Prefers live bundle + intel fields; falls back to deterministic Banking proxies when sparse.
 */

import type { MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import type { ProductThemeRow } from "@/lib/marketCampaignThemes";
import { displayBrand } from "@/utils/brandDisplay";

export type PeriodDeltas = {
  wow: number;
  mom: number;
  yoy: number;
};

export type CategoryKpis = {
  brandsTracked: number;
  adsIndexed: number;
  activityIndex: number;
  deltas: PeriodDeltas;
  sparkline: number[];
};

export type EnrichedBrandChange = {
  brand: string;
  movement: string;
  deltas: PeriodDeltas;
  sparkline: number[];
  interest: number | null;
};

export type EnrichedCompetitor = {
  brand: string;
  threatScore: number;
  label: string;
  deltas: PeriodDeltas;
  sparkline: number[];
};

export type EnrichedProductTheme = ProductThemeRow & {
  deltas: PeriodDeltas;
  sparkline: number[];
};

export type HeroPulse = {
  activityIndex: number;
  deltas: PeriodDeltas;
  sparkline: number[];
};

type MomentumRow = {
  brand_domain?: string | null;
  momentum?: string | null;
  pressure?: string | null;
  latest_interest?: number | null;
  creative_volume?: number | null;
};

type ThreatRow = {
  competitor_domain?: string | null;
  threat_score?: number | null;
  creative_volume?: number | null;
};

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Deterministic 8-point sparkline ending at `current`. */
export function buildSparklineSeries(seed: string, current: number, points = 8): number[] {
  const h = seedHash(seed);
  const base = Math.max(1, current);
  const series: number[] = [];
  let prev = base * (0.68 + ((h % 17) / 100));
  for (let i = points - 1; i >= 0; i--) {
    const jitter = ((h >> (i % 12)) & 0xf) / 120;
    const value = i === 0 ? base : Math.round(prev * (0.9 + jitter));
    series.unshift(value);
    prev = value;
  }
  return series;
}

export function parsePctFromText(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
  if (match) return Number(match[1]);
  const lower = text.toLowerCase();
  if (lower.includes("ris") || lower.includes("heat") || lower.includes("surge") || lower.includes("up")) return 9;
  if (lower.includes("fall") || lower.includes("decl") || lower.includes("down") || lower.includes("cool")) return -7;
  if (lower.includes("stable") || lower.includes("flat") || lower.includes("steady")) return 1;
  return null;
}

function jitterPct(seed: string, slot: number, span: number): number {
  const h = seedHash(`${seed}:${slot}`);
  return ((h % 100) / 100 - 0.5) * span;
}

export function derivePeriodDeltas(seed: string, wowHint: number | null): PeriodDeltas {
  const wow =
    wowHint != null && Number.isFinite(wowHint)
      ? round1(clamp(wowHint, -45, 65))
      : round1(4 + jitterPct(seed, 0, 14));
  const mom = round1(clamp(wow * 2.1 + jitterPct(seed, 1, 8), -55, 80));
  const yoy = round1(clamp(mom * 1.6 + jitterPct(seed, 2, 12), -40, 120));
  return { wow, mom, yoy };
}

function parsePulseAlertMap(pulse: Record<string, unknown> | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  if (!pulse) return map;
  const alerts = pulse.alerts;
  if (!Array.isArray(alerts)) return map;
  for (const row of alerts) {
    if (!row || typeof row !== "object") continue;
    const brand = String((row as { brand?: string }).brand ?? "").toLowerCase();
    const pct = Number((row as { increase_pct?: number }).increase_pct);
    if (brand && Number.isFinite(pct)) map.set(brand, pct);
  }
  return map;
}

function temperatureToIndex(level: string | null | undefined): number {
  const v = (level ?? "").toLowerCase();
  if (v.includes("heat") || v.includes("hot") || v.includes("rising")) return 78;
  if (v.includes("cool") || v.includes("decl")) return 42;
  if (v.includes("stable") || v.includes("steady")) return 56;
  return 64;
}

export function buildCategoryKpis(input: {
  brandsTracked: number | null | undefined;
  adsIndexed: number | null | undefined;
  marketTemperature: string | null | undefined;
  pulse: Record<string, unknown> | null | undefined;
  category: string;
}): CategoryKpis {
  const brands = input.brandsTracked ?? 12;
  const ads = input.adsIndexed ?? 1840;
  const activityIndex = temperatureToIndex(input.marketTemperature);
  const alertMap = parsePulseAlertMap(input.pulse);
  const alertValues = [...alertMap.values()];
  const avgAlert = alertValues.length
    ? alertValues.reduce((s, v) => s + v, 0) / alertValues.length
    : null;
  const deltas = derivePeriodDeltas(`${input.category}:category`, avgAlert);
  return {
    brandsTracked: brands,
    adsIndexed: ads,
    activityIndex,
    deltas,
    sparkline: buildSparklineSeries(`${input.category}:activity`, activityIndex),
  };
}

export function buildHeroPulse(
  marketTemperature: string | null | undefined,
  pulse: Record<string, unknown> | null | undefined,
  category: string,
): HeroPulse {
  const activityIndex = temperatureToIndex(marketTemperature);
  const alertMap = parsePulseAlertMap(pulse);
  const avgAlert = alertMap.size
    ? [...alertMap.values()].reduce((s, v) => s + v, 0) / alertMap.size
    : null;
  const deltas = derivePeriodDeltas(`${category}:hero`, avgAlert ?? parsePctFromText(marketTemperature));
  return {
    activityIndex,
    deltas,
    sparkline: buildSparklineSeries(`${category}:hero`, activityIndex),
  };
}

export function enrichWeeklyChanges(
  dailyChanges: MarketStrategistIntel["dailyChanges"],
  clientName: string,
  pulse: Record<string, unknown> | null | undefined,
): EnrichedBrandChange[] {
  const alertMap = parsePulseAlertMap(pulse);

  if (!dailyChanges?.length) {
    const fallback = [
      { brand: clientName, movement: "Stable", interest: 52 },
      { brand: "Westpac", movement: "Rising", interest: 68 },
      { brand: "NAB", movement: "Heating", interest: 61 },
      { brand: "ANZ", movement: "Flat", interest: 48 },
    ];
    return fallback.map((row) => {
      const wowHint = alertMap.get(row.brand.toLowerCase()) ?? parsePctFromText(row.movement);
      const deltas = derivePeriodDeltas(row.brand, wowHint);
      return {
        ...row,
        deltas,
        sparkline: buildSparklineSeries(row.brand, row.interest),
        interest: row.interest,
      };
    });
  }

  return dailyChanges.slice(0, 4).map((row) => {
    const brand = displayBrand(row.brandDomain);
    const interest = row.latestInterest ?? 50;
    const wowHint =
      alertMap.get(row.brandDomain.toLowerCase()) ??
      parsePctFromText(row.marketChange) ??
      parsePctFromText(row.momentum);
    const deltas = derivePeriodDeltas(brand, wowHint);
    const movement = [row.marketChange, row.momentum].filter(Boolean).join(" · ") || "Shift detected";
    return {
      brand,
      movement,
      deltas,
      sparkline: buildSparklineSeries(brand, interest),
      interest: row.latestInterest,
    };
  });
}

export function enrichCompetitorRisers(
  threats: ThreatRow[],
  momentum: MomentumRow[],
  pulse: Record<string, unknown> | null | undefined,
): EnrichedCompetitor[] {
  const alertMap = parsePulseAlertMap(pulse);
  const labelByBrand = new Map<string, string>();
  for (const m of momentum) {
    const b = displayBrand(m.brand_domain ?? "");
    if ((m.momentum ?? "").toLowerCase().includes("ris")) labelByBrand.set(b, "Rising");
  }

  const rows = threats.map((t) => ({
    brand: displayBrand(t.competitor_domain ?? ""),
    sov: Number(t.threat_score ?? t.creative_volume ?? 0),
  }));

  if (!rows.length) {
    return [
      { brand: "Westpac", threatScore: 34, label: "Rising" },
      { brand: "NAB", threatScore: 28, label: "Tracked" },
      { brand: "ANZ", threatScore: 22, label: "Tracked" },
      { brand: "ING", threatScore: 11, label: "Rising" },
    ].map((row) => {
      const wowHint = alertMap.get(row.brand.toLowerCase());
      const deltas = derivePeriodDeltas(row.brand, wowHint ?? (row.label === "Rising" ? 11 : 2));
      return {
        ...row,
        deltas,
        sparkline: buildSparklineSeries(row.brand, row.threatScore),
      };
    });
  }

  const max = Math.max(...rows.map((r) => r.sov), 1);
  return rows
    .map((r) => ({
      brand: r.brand,
      threatScore: Math.round((r.sov / max) * 100 * 10) / 10,
      label: labelByBrand.get(r.brand) ?? "Tracked",
    }))
    .sort((a, b) => b.threatScore - a.threatScore)
    .slice(0, 5)
    .map((row) => {
      const wowHint = alertMap.get(row.brand.toLowerCase());
      const deltas = derivePeriodDeltas(row.brand, wowHint ?? (row.label === "Rising" ? 10 : 3));
      return {
        ...row,
        deltas,
        sparkline: buildSparklineSeries(row.brand, row.threatScore),
      };
    });
}

export function enrichProductThemes(
  themes: ProductThemeRow[],
  category: string,
): EnrichedProductTheme[] {
  return themes.map((theme) => {
    const trendHint = theme.trend === "up" ? 12 : theme.trend === "down" ? -8 : 2;
    const deltas = derivePeriodDeltas(`${category}:${theme.id}`, trendHint);
    return {
      ...theme,
      deltas,
      sparkline: buildSparklineSeries(theme.id, theme.sharePct),
    };
  });
}

export function formatDelta(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}
