import {
  getAgencyContext,
  type AgencyContext,
} from "@/lib/agency-watchlist";
import { ENGINE_URL } from "@/lib/engine";

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
  | "rad_brief"
  | "rad_confidence"
  | "pulse"
  | "sov"
  | "client_threats"
  | "brand_opportunities"
  | "top_opportunities"
  | "market_pressure"
  | "executive_summary"
  | "pitch_brief";

export type GatewayRequest = {
  /** Logical resource key — resolved via {@link resolveUrl}. */
  resource?: IntelligenceResource | string;
  /** Direct API URL — bypasses resource map when set. */
  url?: string;
  agencyId?: string;
  params?: Record<string, string | number | boolean | undefined>;
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

function resolveAgencyId(agencyId?: string | number | null): string {
  if (agencyId == null || agencyId === "") return "system";
  return String(agencyId);
}

/** Map logical resources to live R-AD API paths. */
export function resolveUrl(
  resource: string,
  _agencyId: string,
  _params?: Record<string, string>,
): string {
  const base = ENGINE_URL.replace(/\/+$/, "");

  const map: Record<string, string> = {
    rad_brief: "/api/brief/banking",
    rad_confidence: "/api/pulse",
    pulse: "/api/pulse",
    client_threats: "/api/intelligence/share-of-voice",
    ra_client_threats: "/api/intelligence/share-of-voice",
    sov: "/api/intelligence/share-of-voice",
    ra_category_ownership: "/api/intelligence/share-of-voice",
    brand_opportunities: "/api/leaderboard/banking",
    ra_brand_opportunities: "/api/leaderboard/banking",
    top_opportunities: "/api/intelligence/creative-themes",
    ra_top_opportunities: "/api/intelligence/creative-themes",
    market_pressure: "/api/velocity/CommBank",
    ra_market_pressure: "/api/velocity/CommBank",
    executive_summary: "/api/pulse",
    ra_executive_summary: "/api/pulse",
    pitch_brief: "/api/pulse",
  };

  const path = map[resource] ?? "/api/pulse";
  return `${base}${path}`;
}

function appendQueryParams(
  url: string,
  params?: GatewayRequest["params"],
): string {
  if (!params) return url;
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || key === "category" || key === "categorySlug") continue;
    parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
}

async function fetchFromUrl<T>(url: string, agencyId: string): Promise<GatewayResponse<T>> {
  const source = url;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Agency-Id": agencyId,
      },
    });
    if (!res.ok) return error<T>(source, `http_${res.status}`);
    const data = (await res.json()) as T;
    return ok(data, source);
  } catch {
    return error<T>(source, "network_error");
  }
}

/** Fetch intelligence from a direct URL or resolved R-AD API endpoint. */
export async function fetchIntelligence<T = unknown>(
  request: GatewayRequest,
): Promise<GatewayResponse<T>> {
  const agencyId = resolveAgencyId(request.agencyId);
  const stringParams = Object.fromEntries(
    Object.entries(request.params ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)]),
  );

  const url = request.url
    ? appendQueryParams(request.url, request.params)
    : appendQueryParams(
        resolveUrl(request.resource ?? "pulse", agencyId, stringParams),
        request.params,
      );

  return fetchFromUrl<T>(url, agencyId);
}

/** Strategist dashboard bundle — single entry point for R-AD cockpit data. */
export type StrategistIntelBundle = {
  agencyId: string;
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
  const agencyId = resolveAgencyId(agencyContext.agencyId);
  const categorySlug = resolveCategorySlug(undefined, agencyContext);
  const params = { categorySlug };

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
    fetchIntelligence<Record<string, unknown> | null>({
      resource: "rad_brief",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown> | null>({
      resource: "rad_confidence",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown>[]>({
      resource: "client_threats",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown>[]>({
      resource: "brand_opportunities",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown>[]>({
      resource: "top_opportunities",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown>[]>({
      resource: "market_pressure",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown> | null>({
      resource: "executive_summary",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown>[]>({
      resource: "pitch_brief",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown> | null>({
      resource: "pulse",
      agencyId,
      params,
    }),
    fetchIntelligence<Record<string, unknown> | null>({
      resource: "sov",
      agencyId,
      params,
    }),
  ]);

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

/** Map engine brief payload into strategist R-AD card shape when needed. */
export function normalizeRadBrief(
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
export function normalizeRadConfidence(
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
