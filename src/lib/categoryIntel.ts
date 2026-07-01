import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CORE_CATEGORY_SEED_BRANDS,
  CORE_FALLBACKS,
  resolveCoreCategorySlug,
  type CoreCategorySlug,
} from "@/lib/categoryCatalog";
import { normaliseChannelBadge, bucketChannel, DISPLAY_CHANNELS } from "@/lib/channels";
import type { ChannelMixResult } from "@/lib/channelMix";
import { previewSovWeights } from "@/lib/dataTrust";

export type CategoryBrandRow = {
  domain: string;
  brand: string;
  adCount: number;
  impressions: number;
  sov: number;
  spend: number;
  theme: string;
  trendUp: boolean;
  preview: boolean;
  platforms: string[];
};

export type CategoryIntelSnapshot = {
  categoryName: string;
  coreSlug: CoreCategorySlug | null;
  isPreview: boolean;
  brands: CategoryBrandRow[];
  totalAds: number;
  totalSpend: number;
  leading: string | null;
  rising: string | null;
  threat: string | null;
  topOpportunity: string | null;
  channelMix: ChannelMixResult;
};

const SUB_MAP: Record<string, string> = {
  automotive: "Automotive",
  superannuation: "Superannuation",
  travel: "Travel",
  energy: "Energy",
  property: "Property",
  fmcg: "FMCG",
  "general-banking": "Banking",
  "digital-banking": "Banking",
  "business-banking": "Banking",
  "health-insurance": "Insurance",
  "car-insurance": "Insurance",
  "home-insurance": "Insurance",
  supermarkets: "Retail",
  "department-stores": "Retail",
  "specialty-retail": "Retail",
  mobile: "Telecommunications",
  "nbn-internet": "Telecommunications",
  telco: "Telco",
  telecommunications: "Telecommunications",
};

const CORE_DB_CATEGORY_NAMES: Record<CoreCategorySlug, string[]> = {
  banking: ["Banking", "General Banking"],
  insurance: ["Insurance"],
  telco: ["Telco", "Telecommunications"],
  retail: ["Retail", "Supermarkets"],
};

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function normalizeDomain(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

function slugDomain(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${cleaned}.com.au`;
}

type CandidateRow = {
  advertiser_name: string;
  domain: string | null;
  ad_count: number;
  estimated_impressions: number;
  platforms: unknown;
};

function parsePlatforms(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((p) => String(p));
  if (typeof raw === "object") return Object.keys(raw as Record<string, unknown>);
  return [];
}

function buildCategoryChannelMix(brands: CategoryBrandRow[]): ChannelMixResult {
  const counts = new Map<string, number>();
  for (const brand of brands) {
    for (const platform of brand.platforms) {
      const bucket = bucketChannel(normaliseChannelBadge(platform) ?? "Other");
      counts.set(bucket, (counts.get(bucket) ?? 0) + Math.max(1, brand.adCount));
    }
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) {
    return {
      rows: DISPLAY_CHANNELS.map((channel) => ({ channel, pct: 0, ads: 0, confidence: "Low" as const })),
      overallConfidence: "Low",
      available: false,
      source: "baseline",
      sourceLabel: "Awaiting channel attribution",
      estimationTooltip: "Category channel mix appears once AdLibrary candidates include platform tags.",
    };
  }
  const rows = DISPLAY_CHANNELS.map((channel) => {
    const ads = counts.get(channel) ?? 0;
    const pct = Math.round((ads / total) * 1000) / 10;
    return { channel, pct, ads, confidence: "Medium" as const };
  });
  return {
    rows,
    overallConfidence: "Medium",
    available: true,
    source: "adlibrary",
    sourceLabel: "AdLibrary category candidates",
    estimationTooltip: "Share estimated from indexed AdLibrary ads per platform across category leaders.",
  };
}

export function resolveCategoryContext(slug: string, registryCategories: string[]) {
  const parentCategory = SUB_MAP[slug] ?? null;
  const matchByCat = registryCategories.find((c) => slugify(c) === slug);
  const core = resolveCoreCategorySlug(slug) ?? resolveCoreCategorySlug(parentCategory ?? "");
  const categoryName =
    matchByCat ?? parentCategory ?? (core ? CORE_FALLBACKS[core].name : slug.replace(/-/g, " "));
  const dbNames = core
    ? CORE_DB_CATEGORY_NAMES[core]
    : [categoryName, parentCategory].filter(Boolean) as string[];
  return { categoryName, core, dbNames, parentCategory };
}

export async function fetchCategoryIntel(
  supabase: SupabaseClient<Database>,
  slug: string,
  registryCategories: string[] = [],
): Promise<CategoryIntelSnapshot> {
  const { categoryName, core, dbNames } = resolveCategoryContext(slug, registryCategories);
  const fallback = core ? CORE_FALLBACKS[core] : null;

  const { data: candidates } = await supabase
    .from("adlibrary_advertiser_candidates")
    .select("advertiser_name, domain, ad_count, estimated_impressions, platforms")
    .in("category", dbNames.length ? dbNames : [categoryName])
    .order("ad_count", { ascending: false })
    .limit(25);

  const candidateRows = (candidates ?? []) as CandidateRow[];
  let isPreview = false;

  const merged = new Map<string, CategoryBrandRow>();

  for (const row of candidateRows) {
    const domain = normalizeDomain(row.domain) || slugDomain(row.advertiser_name);
    const adCount = Number(row.ad_count ?? 0);
    merged.set(domain, {
      domain,
      brand: row.advertiser_name,
      adCount,
      impressions: Number(row.estimated_impressions ?? 0),
      sov: 0,
      spend: Math.round(adCount * 850 + row.estimated_impressions / 500),
      theme: adCount > 20 ? "Trust" : "Value",
      trendUp: adCount % 2 === 0,
      preview: false,
      platforms: parsePlatforms(row.platforms),
    });
  }

  if (core && merged.size === 0) {
    isPreview = true;
    const weights = previewSovWeights(CORE_CATEGORY_SEED_BRANDS[core].length);
    for (const [index, seed] of CORE_CATEGORY_SEED_BRANDS[core].entries()) {
      const domain = normalizeDomain(seed.domain);
      merged.set(domain, {
        domain,
        brand: seed.name,
        adCount: 0,
        impressions: 0,
        sov: weights[index] ?? 0,
        spend: 0,
        theme: index === 0 ? "Trust" : index === 1 ? "Value" : "Innovation",
        trendUp: false,
        preview: true,
        platforms: [],
      });
    }
  }

  const brands = [...merged.values()];
  const totalAds = brands.reduce((sum, b) => sum + b.adCount, 0);
  const totalImpressions = brands.reduce((sum, b) => sum + b.impressions, 0);

  if (totalAds > 0) {
    const withAds = brands.filter((b) => b.adCount > 0);
    const rounded = withAds.map((b) => ({
      brand: b,
      sov: Math.round((b.adCount / totalAds) * 1000) / 10,
    }));
    const drift = Math.round((100 - rounded.reduce((a, r) => a + r.sov, 0)) * 10) / 10;
    if (rounded.length && Math.abs(drift) >= 0.1) rounded[0].sov = Math.round((rounded[0].sov + drift) * 10) / 10;
    for (const { brand, sov } of rounded) brand.sov = sov;
  }

  brands.sort((a, b) => b.sov - a.sov || b.adCount - a.adCount);

  const leading = brands[0]?.brand ?? fallback?.leading ?? null;
  const rising = brands[1]?.brand ?? fallback?.rising ?? null;
  const threat = brands[2]?.brand ?? fallback?.threat ?? null;

  return {
    categoryName,
    coreSlug: core,
    isPreview,
    brands,
    totalAds,
    totalSpend: brands.reduce((sum, b) => sum + b.spend, 0),
    leading,
    rising,
    threat,
    topOpportunity: fallback?.topOpportunity ?? null,
    channelMix: buildCategoryChannelMix(brands),
  };
}

