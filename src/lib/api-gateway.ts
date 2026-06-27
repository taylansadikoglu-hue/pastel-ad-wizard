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
  | "pitch_brief"
  | "strategist_bundle";

export type GatewayRequest = {
  resource?: IntelligenceResource | string;
  url?: string;
  agencyId?: string;
  params?: Record<string, string | number | boolean | undefined>;
};

/** Live strategist bundle from GET /api/strategist/bundle */
export type RadStrategistBundleApi = {
  api_version?: string;
  generated_at?: string;
  agency_id?: string;
  query?: { category?: string; brand?: string; days?: number };
  brief?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  modules?: {
    competitors?: Record<string, unknown>[];
    challengers?: Record<string, unknown>[];
    whitespace?: Record<string, unknown>[];
    momentum?: Record<string, unknown>[];
    executive?: Record<string, unknown>;
    pitch?: Record<string, unknown>[];
  };
  pulse?: Record<string, unknown>;
  sov?: Record<string, unknown>;
  methodology?: Record<string, unknown>;
};

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

function resolveBrand(ctx?: AgencyContext): string {
  const entry = ctx?.entries.find((e) => e.client_name || e.client_domain);
  if (entry?.client_name?.trim()) return entry.client_name.trim();
  if (entry?.client_domain) {
    const root = entry.client_domain.split(".")[0] ?? "";
    if (root) return root.charAt(0).toUpperCase() + root.slice(1);
  }
  return "CommBank";
}

function resolveAgencyId(agencyId?: string | number | null): string {
  if (agencyId == null || agencyId === "") return "system";
  return String(agencyId);
}

export function strategistBundleUrl(
  category: string,
  brand: string,
  days = 30,
): string {
  const base = ENGINE_URL.replace(/\/+$/, "");
  const url = new URL(`${base}/api/strategist/bundle`);
  url.searchParams.set("category", category);
  url.searchParams.set("brand", brand);
  url.searchParams.set("days", String(days));
  return url.toString();
}

/** Map logical resources to live R-AD API paths (legacy per-resource fetch). */
export function resolveUrl(
  resource: string,
  _agencyId: string,
  _params?: Record<string, string>,
): string {
  if (resource === "strategist_bundle") {
    return strategistBundleUrl("banking", "CommBank");
  }

  const base = ENGINE_URL.replace(/\/+$/, "");
  const map: Record<string, string> = {
    rad_brief: "/api/brief/banking",
    rad_confidence: "/api/pulse",
    pulse: "/api/pulse",
    client_threats: "/api/intelligence/share-of-voice",
    brand_opportunities: "/api/leaderboard/banking",
    top_opportunities: "/api/intelligence/creative-themes",
    market_pressure: "/api/velocity/CommBank",
    executive_summary: "/api/pulse",
    pitch_brief: "/api/pulse",
    sov: "/api/intelligence/share-of-voice",
  };

  return `${base}${map[resource] ?? "/api/pulse"}`;
}

function appendQueryParams(
  url: string,
  params?: GatewayRequest["params"],
): string {
  if (!params) return url;
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
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

function asExecutive(
  exec: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!exec) return null;
  const hasValue = Object.values(exec).some((v) => v != null && v !== "");
  return hasValue ? exec : null;
}

/** Map Codex bundle JSON → dashboard StrategistIntelBundle envelopes. */
export function adaptStrategistBundle(
  api: RadStrategistBundleApi,
  source: string,
): StrategistIntelBundle {
  const modules = api.modules ?? {};
  const agencyId = resolveAgencyId(api.agency_id);

  return {
    agencyId,
    brief: ok(api.brief ?? null, source),
    confidence: ok(api.confidence ?? null, source),
    threats: ok(modules.competitors ?? [], source),
    challengers: ok(modules.challengers ?? [], source),
    whitespace: ok(modules.whitespace ?? [], source),
    momentum: ok(modules.momentum ?? [], source),
    executive: ok(asExecutive(modules.executive), source),
    pitch: ok(modules.pitch ?? [], source),
    pulse: ok(api.pulse ?? null, source),
    sov: ok(api.sov ?? null, source),
  };
}

function emptyStrategistBundle(agencyId: string, source: string): StrategistIntelBundle {
  const emptyBrief = empty<Record<string, unknown> | null>(source);
  return {
    agencyId,
    brief: emptyBrief,
    confidence: emptyBrief,
    threats: ok([], source, "empty"),
    challengers: ok([], source, "empty"),
    whitespace: ok([], source, "empty"),
    momentum: ok([], source, "empty"),
    executive: emptyBrief,
    pitch: ok([], source, "empty"),
    pulse: emptyBrief,
    sov: emptyBrief,
  };
}

export async function loadStrategistIntelligence(
  ctx?: AgencyContext,
): Promise<StrategistIntelBundle> {
  const agencyContext = ctx ?? (await getAgencyContext().catch(() => ({
    agencyId: null,
    entries: [],
    domains: new Set<string>(),
  })));
  const agencyId = resolveAgencyId(agencyContext.agencyId);
  const category = resolveCategorySlug(undefined, agencyContext);
  const brand = resolveBrand(agencyContext);
  const url = strategistBundleUrl(category, brand);

  const response = await fetchFromUrl<RadStrategistBundleApi>(url, agencyId);
  if (response.status !== "ok" || !response.data?.modules) {
    return emptyStrategistBundle(agencyId, response.metadata.source);
  }

  return adaptStrategistBundle(response.data, response.metadata.source);
}

/**
 * Normalize brief into dashboard card shape.
 * Passes through v1 strategist bundle brief; maps legacy engine /api/brief payloads.
 */
export function normalizeRadBrief(
  raw: Record<string, unknown> | null,
  fallback: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const src = raw ?? fallback;
  if (!src) return null;

  if (src.headline || src.strongest_threat) {
    return {
      client_name: src.client_name ?? null,
      category: src.category ?? null,
      headline: src.headline ?? null,
      summary: src.summary ?? null,
      strategic_opening: src.strategic_opening ?? null,
      recommended_action: src.recommended_action ?? null,
      strongest_threat: src.strongest_threat ?? null,
      fastest_mover: src.fastest_mover ?? null,
      emerging_challenger: src.emerging_challenger ?? null,
      whitespace_category: src.whitespace_category ?? null,
      whitespace_emotion: src.whitespace_emotion ?? null,
      whitespace_score: src.whitespace_score ?? null,
    };
  }

  const pulse = src.market_pulse as Record<string, unknown> | undefined;
  const winConditions = Array.isArray(src.win_conditions)
    ? (src.win_conditions as { gap?: string; why?: string }[])
    : [];
  const whitespace = Array.isArray(src.whitespace)
    ? (src.whitespace as { theme?: string; emotion?: string; opportunity_score?: number }[])
    : [];
  const topWhitespace = whitespace[0];

  return {
    client_name: src.industry ?? src.client_name ?? null,
    category: src.category ?? src.industry ?? null,
    headline:
      winConditions[0]?.gap ??
      (typeof src.pitch_narrative === "string" ? src.pitch_narrative : null) ??
      pulse?.most_aggressive_brand ??
      null,
    summary: src.summary ?? winConditions[0]?.why ?? null,
    strategic_opening: src.strategic_opening ?? winConditions[1]?.gap ?? null,
    recommended_action:
      src.recommended_action ??
      winConditions[0]?.why ??
      (typeof src.pitch_narrative === "string" ? src.pitch_narrative : null),
    strongest_threat:
      (src.top_threat as { brand?: string } | undefined)?.brand ??
      pulse?.most_aggressive_brand ??
      null,
    fastest_mover: src.fastest_mover ?? null,
    emerging_challenger: src.emerging_challenger ?? winConditions[1]?.gap ?? null,
    whitespace_category: src.whitespace_category ?? src.industry ?? null,
    whitespace_emotion:
      src.whitespace_emotion ?? topWhitespace?.emotion ?? topWhitespace?.theme ?? null,
    whitespace_score: src.whitespace_score ?? topWhitespace?.opportunity_score ?? null,
  };
}

/** Normalize confidence — prefers bundle.confidence; falls back to pulse metrics. */
export function normalizeRadConfidence(
  pulse: Record<string, unknown> | null,
  confidence: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (confidence && (confidence.ads_analysed != null || confidence.brands_tracked != null)) {
    return {
      ads_analysed: confidence.ads_analysed ?? null,
      brands_tracked: confidence.brands_tracked ?? null,
      trend_points: confidence.trend_points ?? null,
      classification_coverage: confidence.classification_coverage ?? null,
    };
  }

  if (!pulse) return null;

  const marketPulse = pulse.market_pulse as Record<string, unknown> | undefined;
  return {
    ads_analysed: pulse.total_ads_today ?? pulse.new_ads_today ?? null,
    brands_tracked: marketPulse?.total_active_brands ?? null,
    trend_points: Array.isArray(pulse.alerts) ? pulse.alerts.length : null,
    classification_coverage: null,
  };
}
