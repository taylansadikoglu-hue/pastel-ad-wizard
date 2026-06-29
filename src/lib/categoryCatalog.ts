import { displayBrand } from "@/utils/brandDisplay";
import { isLaunchCategory } from "@/lib/pricing-plans";

export type CoreCategorySlug = "banking" | "insurance" | "telco" | "retail";

export type LockedCategorySlug =
  | "automotive"
  | "superannuation"
  | "travel"
  | "energy"
  | "property"
  | "fmcg";

export type CategoryIntel = {
  slug: string;
  name: string;
  brandCount: number;
  leading: string;
  rising: string;
  threat: string;
  healthScore: number;
  topOpportunity: string;
};

export type LockedCategoryPreview = {
  slug: LockedCategorySlug;
  name: string;
  /** Placeholder brand initials for blurred logo row */
  logoSeeds: string[];
};

export const CORE_CATEGORY_ORDER: CoreCategorySlug[] = [
  "banking",
  "insurance",
  "telco",
  "retail",
];

export const LOCKED_CATEGORY_ORDER: LockedCategoryPreview[] = [
  { slug: "automotive", name: "Automotive", logoSeeds: ["Toyota", "Ford", "Mazda", "Hyundai"] },
  { slug: "superannuation", name: "Superannuation", logoSeeds: ["AustralianSuper", "REST", "Hostplus", "Aware"] },
  { slug: "travel", name: "Travel", logoSeeds: ["Qantas", "Jetstar", "Booking", "Expedia"] },
  { slug: "energy", name: "Energy", logoSeeds: ["Origin", "AGL", "EnergyAustralia", "Red"] },
  { slug: "property", name: "Property", logoSeeds: ["REA", "Domain", "Ray White", "LJ Hooker"] },
  { slug: "fmcg", name: "FMCG", logoSeeds: ["Unilever", "P&G", "Nestle", "Coca-Cola"] },
];

const CORE_FALLBACKS: Record<CoreCategorySlug, Omit<CategoryIntel, "slug">> = {
  banking: {
    name: "General Banking",
    brandCount: 29,
    leading: "Bendigo Bank",
    rising: "ING",
    threat: "Westpac",
    healthScore: 74,
    topOpportunity: "Savings messaging",
  },
  insurance: {
    name: "Insurance",
    brandCount: 24,
    leading: "Medibank",
    rising: "Bupa",
    threat: "NIB",
    healthScore: 71,
    topOpportunity: "Value cover positioning",
  },
  telco: {
    name: "Telco",
    brandCount: 18,
    leading: "Telstra",
    rising: "Optus",
    threat: "TPG",
    healthScore: 68,
    topOpportunity: "5G household bundles",
  },
  retail: {
    name: "Retail",
    brandCount: 31,
    leading: "Woolworths",
    rising: "Aldi",
    threat: "Coles",
    healthScore: 76,
    topOpportunity: "Everyday value loyalty",
  },
};

export function categorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function matchCoreSlug(raw: string): CoreCategorySlug | null {
  const slug = normalizeSlug(raw);
  if (slug.includes("bank")) return "banking";
  if (slug.includes("insur")) return "insurance";
  if (slug.includes("telco") || slug.includes("telecom")) return "telco";
  if (slug.includes("retail") || slug.includes("supermarket")) return "retail";
  if (CORE_CATEGORY_ORDER.includes(slug as CoreCategorySlug)) return slug as CoreCategorySlug;
  return null;
}

function clampHealth(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function healthFromBrandCount(count: number): number {
  if (count <= 0) return 0;
  return clampHealth(52 + Math.min(count, 40) * 0.9);
}

type ApiCategoryRow = {
  slug?: string;
  name?: string;
  category?: string;
  brand_count?: number;
  brands?: number;
  count?: number;
  leader?: unknown;
  top_brand?: unknown;
  rising_brand?: unknown;
  fastest_mover?: unknown;
  threat?: unknown;
  strongest_threat?: unknown;
  health_score?: number;
  top_opportunity?: string;
  opportunity?: string;
  leaderboard?: unknown[];
};

function pickBrand(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return displayBrand(value);
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const raw = (o.brand ?? o.name ?? o.advertiser ?? o.domain) as string | undefined;
    if (raw) return displayBrand(raw);
  }
  return null;
}

function parseApiRow(row: ApiCategoryRow): { core: CoreCategorySlug; patch: Partial<CategoryIntel> } | null {
  const slugRaw = String(row.slug ?? row.category ?? row.name ?? "");
  const core = matchCoreSlug(slugRaw);
  if (!core) return null;

  const brandCount = Number(row.brand_count ?? row.brands ?? row.count ?? 0);
  const leader =
    pickBrand(row.leader) ??
    pickBrand(row.top_brand) ??
    pickBrand(Array.isArray(row.leaderboard) ? row.leaderboard[0] : null);

  const rising = pickBrand(row.rising_brand ?? row.fastest_mover);
  const threat = pickBrand(row.threat ?? row.strongest_threat);
  const healthScore = Number(row.health_score);
  const topOpportunity = String(row.top_opportunity ?? row.opportunity ?? "").trim() || null;

  return {
    core,
    patch: {
      slug: core,
      name: String(row.name ?? row.category ?? CORE_FALLBACKS[core].name),
      brandCount: Number.isFinite(brandCount) ? brandCount : undefined,
      leading: leader ?? undefined,
      rising: rising ?? undefined,
      threat: threat ?? undefined,
      healthScore: Number.isFinite(healthScore) ? clampHealth(healthScore) : undefined,
      topOpportunity: topOpportunity ?? undefined,
    },
  };
}

export function buildCoreCategories(apiRows: ApiCategoryRow[]): CategoryIntel[] {
  const merged = new Map<CoreCategorySlug, CategoryIntel>();

  for (const core of CORE_CATEGORY_ORDER) {
    const base = CORE_FALLBACKS[core];
    merged.set(core, { slug: core, ...base });
  }

  for (const row of apiRows) {
    const parsed = parseApiRow(row);
    if (!parsed) continue;
    const existing = merged.get(parsed.core)!;
    merged.set(parsed.core, {
      ...existing,
      ...Object.fromEntries(
        Object.entries(parsed.patch).filter(([, v]) => v !== undefined && v !== null && v !== ""),
      ),
      slug: parsed.core,
      name: parsed.patch.name && !isLaunchCategory(parsed.patch.name) ? parsed.patch.name : existing.name,
      brandCount:
        parsed.patch.brandCount && parsed.patch.brandCount > 0
          ? parsed.patch.brandCount
          : existing.brandCount,
      healthScore:
        parsed.patch.healthScore && parsed.patch.healthScore > 0
          ? parsed.patch.healthScore
          : healthFromBrandCount(parsed.patch.brandCount ?? existing.brandCount),
    });
  }

  return CORE_CATEGORY_ORDER.map((core) => {
    const row = merged.get(core)!;
    return {
      ...row,
      healthScore: row.healthScore > 0 ? row.healthScore : healthFromBrandCount(row.brandCount),
    };
  });
}

export function parseCategoriesApiPayload(raw: unknown): ApiCategoryRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ApiCategoryRow[];
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.categories)) return o.categories as ApiCategoryRow[];
    if (Array.isArray(o.data)) return o.data as ApiCategoryRow[];
    return Object.entries(o).map(([k, v]) => ({
      slug: k,
      ...(typeof v === "object" && v ? (v as Record<string, unknown>) : {}),
    }));
  }
  return [];
}

export function healthTone(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: "Strong", color: "#1B7F4A", bg: "#E8F5EE" };
  if (score >= 60) return { label: "Stable", color: "#8A6A1F", bg: "#FDF6E8" };
  return { label: "Heating up", color: "#B45309", bg: "#FFF4E8" };
}

export const CATEGORY_PACK_PRICING = {
  fourPack: { label: "+4 categories", price: 299 },
  allCategories: { label: "All categories", price: 599, badge: "Most Popular" as const },
} as const;
