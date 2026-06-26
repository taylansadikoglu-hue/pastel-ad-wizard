import { supabase } from "@/integrations/supabase/client";
import { engineUrl } from "@/lib/engine";
import {
  filterByAgencyWatchlist,
  getAgencyContext,
  type AgencyContext,
} from "@/lib/agency-watchlist";

/** Standard envelope for every intelligence response. */
export type GatewayResponse<T = unknown> = {
  data: T;
  status: string;
  metadata: {
    timestamp: string;
    source: string;
  };
};

export type IntelligenceResource =
  | "barbs_brief"
  | "barbs_confidence"
  | "pulse"
  | "sov"
  | "client_threats"
  | "brand_opportunities"
  | "top_opportunities"
  | "market_pressure"
  | "executive_summary"
  | "pitch_brief";

export type GatewayRequest = {
  resource: IntelligenceResource;
  agencyId: number;
  params?: Record<string, string | number | boolean | undefined>;
};

const INSIGHT_RESOURCES = new Set<IntelligenceResource>([
  "barbs_brief",
  "barbs_confidence",
  "pulse",
  "sov",
]);

const SUPABASE_VIEWS: Partial<Record<IntelligenceResource, string>> = {
  barbs_brief: "ra_barbs_client_brief",
  barbs_confidence: "ra_barbs_confidence",
  client_threats: "ra_client_threats",
  brand_opportunities: "ra_brand_opportunities",
  top_opportunities: "ra_top_opportunities",
  market_pressure: "ra_market_pressure",
  executive_summary: "ra_executive_summary",
  pitch_brief: "ra_pitch_brief",
};

const WATCHLIST_DOMAIN_KEYS: Partial<Record<IntelligenceResource, string>> = {
  client_threats: "competitor_domain",
  brand_opportunities: "brand_domain",
  market_pressure: "brand_domain",
};

const CATEGORY_SLUGS: Record<string, string> = {
  banking: "banking",
  "general banking": "banking",
  auto: "automotive",
  automotive: "automotive",
  telco: "telco",
  health: "health_insurance",
  "health insurance": "health_insurance",
  retail: "retail",
};

function nowIso(): string {
  return new Date().toISOString();
}

function ok<T>(data: T, source: string, status = "ok"): GatewayResponse<T> {
  return { data, status, metadata: { timestamp: nowIso(), source } };
}

function empty<T>(source: string, status = "empty"): GatewayResponse<T> {
  return { data: null as T, status, metadata: { timestamp: nowIso(), source } };
}

function error<T>(source: string, status = "error"): GatewayResponse<T> {
  return { data: null as T, status, metadata: { timestamp: nowIso(), source } };
}

export function categoryToSlug(category: string | null | undefined): string {
  if (!category) return "banking";
  const key = category.trim().toLowerCase();
  return CATEGORY_SLUGS[key] ?? key.replace(/\s+/g, "_");
}

function resolveCategorySlug(
  params?: GatewayRequest["params"],
  ctx?: AgencyContext,
): string {
  const fromParams = params?.categorySlug ?? params?.category;
  if (typeof fromParams === "string" && fromParams.trim()) {
    return categoryToSlug(fromParams);
  }
  const firstCategory = ctx?.entries.find((e) => e.category)?.category ?? null;
  return categoryToSlug(firstCategory);
}

function withAgencyQuery(path: string, agencyId: number, params?: GatewayRequest["params"]): string {
  const url = new URL(engineUrl(path));
  url.searchParams.set("agency_id", String(agencyId));
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || key === "category" || key === "categorySlug") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function fetchEngineJson<T>(
  path: string,
  agencyId: number,
  params?: GatewayRequest["params"],
): Promise<GatewayResponse<T>> {
  const source = `engine:${path}`;
  try {
    const url = withAgencyQuery(path, agencyId, params);
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Agency-Id": String(agencyId),
      },
    });
    if (!res.ok) return error<T>(source, `http_${res.status}`);
    const data = (await res.json()) as T;
    return ok(data, source);
  } catch {
    return error<T>(source, "network_error");
  }
}

async function fetchSupabaseView<T>(
  view: string,
  agencyId: number,
  options?: { single?: boolean; limit?: number },
): Promise<GatewayResponse<T>> {
  const source = `supabase:${view}`;
  // Dynamic view routing — agency_id passed via RLS on underlying tables.
  type ViewName = keyof import("@/integrations/supabase/types").Database["public"]["Views"];
  let query = supabase.from(view as ViewName).select("*");
  if (options?.limit) query = query.limit(options.limit);
  const result = options?.single ? await query.maybeSingle() : await query;
  if (result.error) return error<T>(source, result.error.code ?? "query_error");
  void agencyId;
  return ok(result.data as T, source);
}

function scopeRows<T extends Record<string, unknown>>(
  rows: T[],
  resource: IntelligenceResource,
  domains: Set<string>,
): T[] {
  const key = WATCHLIST_DOMAIN_KEYS[resource];
  if (!key || domains.size === 0) return rows;
  return filterByAgencyWatchlist(rows, domains, key as keyof T);
}

/** Route a single intelligence request through Supabase (data) or engine (insight). */
export async function fetchIntelligence<T = unknown>(
  request: GatewayRequest,
  ctx?: AgencyContext,
): Promise<GatewayResponse<T>> {
  const { resource, agencyId, params } = request;
  const agencyContext = ctx ?? (await getAgencyContext());
  const domains = agencyContext.domains;
  const categorySlug = resolveCategorySlug(params, agencyContext);

  if (INSIGHT_RESOURCES.has(resource)) {
    const insight = await fetchInsight<T>(resource, agencyId, categorySlug, params);
    if (insight.status === "ok" && insight.data != null) return insight;

    const view = SUPABASE_VIEWS[resource];
    if (view) {
      const fallback = await fetchSupabaseView<T>(view, agencyId, {
        single: resource === "barbs_brief" || resource === "barbs_confidence",
        limit: resource === "barbs_confidence" ? 1 : undefined,
      });
      if (fallback.status === "ok") {
        return {
          ...fallback,
          metadata: {
            ...fallback.metadata,
            source: `${fallback.metadata.source} (insight_fallback)`,
          },
        };
      }
    }
    return insight;
  }

  const view = SUPABASE_VIEWS[resource];
  if (!view) return error<T>(`gateway:${resource}`, "unknown_resource");

  const raw = await fetchSupabaseView<T[] | T>(view, agencyId, {
    single: resource === "executive_summary",
  });
  if (raw.status !== "ok" || raw.data == null) return raw as GatewayResponse<T>;

  if (Array.isArray(raw.data)) {
    const scoped = scopeRows(raw.data as Record<string, unknown>[], resource, domains);
    return ok(scoped as T, raw.metadata.source);
  }
  return raw as GatewayResponse<T>;
}

async function fetchInsight<T>(
  resource: IntelligenceResource,
  agencyId: number,
  categorySlug: string,
  params?: GatewayRequest["params"],
): Promise<GatewayResponse<T>> {
  switch (resource) {
    case "barbs_brief":
      return fetchEngineJson<T>(`/api/brief/${categorySlug}`, agencyId, params);
    case "barbs_confidence":
      return fetchEngineJson<T>(
        `/api/intelligence/confidence/${categorySlug}`,
        agencyId,
        params,
      );
    case "pulse":
      return fetchEngineJson<T>(`/api/pulse`, agencyId, { ...params, category: categorySlug });
    case "sov":
      return fetchEngineJson<T>(
        `/api/intelligence/sov-pro/${categorySlug}`,
        agencyId,
        params,
      );
    default:
      return error<T>(`engine:${resource}`, "not_insight");
  }
}

/** Strategist dashboard bundle — single entry point for BARBS cockpit data. */
export type StrategistIntelBundle = {
  agencyId: number | null;
  brief: GatewayResponse<Record<string, unknown> | null>;
  confidence: GatewayResponse<Record<string, unknown> | null>;
  threats: GatewayResponse<Record<string, unknown>[]>;
  challengers: GatewayResponse<Record<string, unknown>[]>;
  whitespace: GatewayResponse<Record<string, unknown>[]>;
  momentum: GatewayResponse<Record<string, unknown>[]>;
  executive: GatewayResponse<Record<string, unknown> | null>;
  pitch: GatewayResponse<Record<string, unknown>[]>;
  pulse: GatewayResponse<Record<string, unknown> | null>;
  sov: GatewayResponse<Record<string, unknown> | null>;
};

export async function loadStrategistIntelligence(
  ctx?: AgencyContext,
): Promise<StrategistIntelBundle> {
  const agencyContext = ctx ?? (await getAgencyContext());
  const agencyId = agencyContext.agencyId;

  if (!agencyId) {
    const emptyBundle = empty<null>("gateway:none", "no_agency");
    return {
      agencyId: null,
      brief: emptyBundle,
      confidence: emptyBundle,
      threats: ok([], "gateway:none"),
      challengers: ok([], "gateway:none"),
      whitespace: ok([], "gateway:none"),
      momentum: ok([], "gateway:none"),
      executive: emptyBundle,
      pitch: ok([], "gateway:none"),
      pulse: emptyBundle,
      sov: emptyBundle,
    };
  }

  const base = { agencyId };
  const categorySlug = resolveCategorySlug(undefined, agencyContext);

  const [
    brief,
    confidence,
    threats,
    challengers,
    whitespace,
    momentum,
    executive,
    pitch,
    pulse,
    sov,
  ] = await Promise.all([
    fetchIntelligence<Record<string, unknown> | null>(
      { resource: "barbs_brief", agencyId, params: { categorySlug } },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown> | null>(
      { resource: "barbs_confidence", agencyId, params: { categorySlug } },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown>[]>(
      { resource: "client_threats", agencyId },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown>[]>(
      { resource: "brand_opportunities", agencyId },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown>[]>(
      { resource: "top_opportunities", agencyId },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown>[]>(
      { resource: "market_pressure", agencyId },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown> | null>(
      { resource: "executive_summary", agencyId },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown>[]>(
      { resource: "pitch_brief", agencyId },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown> | null>(
      { resource: "pulse", agencyId, params: { categorySlug } },
      agencyContext,
    ),
    fetchIntelligence<Record<string, unknown> | null>(
      { resource: "sov", agencyId, params: { categorySlug } },
      agencyContext,
    ),
  ]);

  void base;
  return {
    agencyId,
    brief,
    confidence,
    threats,
    challengers,
    whitespace,
    momentum,
    executive,
    pitch,
    pulse,
    sov,
  };
}

/** Map engine brief payload into strategist BARBS card shape when needed. */
export function normalizeBarbsBrief(
  engineBrief: Record<string, unknown> | null,
  fallback: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (fallback && (fallback.headline || fallback.strongest_threat)) return fallback;
  if (!engineBrief) return fallback;

  const pulse = engineBrief.market_pulse as Record<string, unknown> | undefined;
  const winConditions = Array.isArray(engineBrief.win_conditions)
    ? (engineBrief.win_conditions as { gap?: string; why?: string }[])
    : [];

  return {
    client_name: engineBrief.industry ?? null,
    category: engineBrief.industry ?? null,
    headline: winConditions[0]?.gap ?? pulse?.most_aggressive_brand ?? null,
    summary: winConditions[0]?.why ?? null,
    strategic_opening: winConditions[1]?.gap ?? null,
    recommended_action: winConditions[0]?.why ?? null,
    strongest_threat: pulse?.most_aggressive_brand ?? null,
    emerging_challenger: winConditions[1]?.gap ?? null,
    whitespace_emotion: null,
    whitespace_category: engineBrief.industry ?? null,
  };
}

/** Map engine pulse into confidence metrics when Supabase view is empty. */
export function normalizeBarbsConfidence(
  enginePulse: Record<string, unknown> | null,
  fallback: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (fallback && (fallback.ads_analysed != null || fallback.brands_tracked != null)) {
    return fallback;
  }
  if (!enginePulse) return fallback;
  return {
    ads_analysed: enginePulse.total_ads_today ?? enginePulse.new_ads_today ?? null,
    brands_tracked: null,
    trend_points: Array.isArray(enginePulse.alerts) ? enginePulse.alerts.length : null,
    classification_coverage: null,
  };
}
