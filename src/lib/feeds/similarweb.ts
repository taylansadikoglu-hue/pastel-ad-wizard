import { normalizeDomain } from "./normalize-domain";
import type { SimilarCompetitor, TrafficProfile } from "./types";

export type SimilarwebConfig = {
  apiKey: string;
  host: string;
  similarSitesPath: string;
  overviewPath: string;
};

export type SimilarwebBundle = {
  traffic: TrafficProfile | null;
  similarCompetitors: SimilarCompetitor[];
  raw: Record<string, unknown>;
};

type RapidSite = {
  site?: string;
  domain?: string;
  url?: string;
  title?: string;
  description?: string;
  totalVisits?: number;
  visits?: number;
  category?: string;
  categoryRank?: number;
  rank?: number;
  topCountry?: string;
  topCountryRank?: number;
  affinity?: number;
  score?: number;
  tags?: string[];
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function siteDomain(row: RapidSite): string | null {
  const raw = row.site ?? row.domain ?? row.url;
  if (!raw || typeof raw !== "string") return null;
  return normalizeDomain(raw);
}

function toTrafficProfile(site: RapidSite, fallbackDomain: string): TrafficProfile {
  const domain = siteDomain(site) ?? fallbackDomain;
  return {
    domain,
    title: typeof site.title === "string" ? site.title : null,
    description: typeof site.description === "string" ? site.description : null,
    monthlyVisits: num(site.totalVisits ?? site.visits),
    category: typeof site.category === "string" ? site.category : null,
    categoryRank: num(site.categoryRank ?? site.rank),
    topCountry: typeof site.topCountry === "string" ? site.topCountry : null,
    topCountryRank: num(site.topCountryRank),
    tags: Array.isArray(site.tags) ? site.tags.filter((t): t is string => typeof t === "string") : [],
  };
}

function toSimilarCompetitor(row: RapidSite): SimilarCompetitor | null {
  const domain = siteDomain(row);
  if (!domain) return null;
  return {
    domain,
    monthlyVisits: num(row.totalVisits ?? row.visits),
    category: typeof row.category === "string" ? row.category : null,
    categoryRank: num(row.categoryRank ?? row.rank),
    affinity: num(row.affinity ?? row.score),
  };
}

/** Parse RapidAPI Similarweb API Pro style payloads (flexible shapes). */
export function parseSimilarwebPayload(raw: unknown, domain: string): SimilarwebBundle {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sourceSite = (body.sourceSite ?? body.source_site ?? body.overview ?? body.data) as RapidSite | undefined;

  let traffic: TrafficProfile | null = null;
  if (sourceSite && typeof sourceSite === "object") {
    traffic = toTrafficProfile(sourceSite, domain);
  }

  const similarRaw =
    body.similarSites ??
    body.similar_sites ??
    body.sites ??
    (Array.isArray(body.data) ? body.data : null);

  const similarCompetitors: SimilarCompetitor[] = [];
  if (Array.isArray(similarRaw)) {
    for (const row of similarRaw) {
      if (!row || typeof row !== "object") continue;
      const mapped = toSimilarCompetitor(row as RapidSite);
      if (mapped && mapped.domain !== domain) similarCompetitors.push(mapped);
    }
  }

  similarCompetitors.sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0) || (b.monthlyVisits ?? 0) - (a.monthlyVisits ?? 0));

  return {
    traffic,
    similarCompetitors: similarCompetitors.slice(0, 12),
    raw: body,
  };
}

async function rapidGet(config: SimilarwebConfig, path: string, domain: string): Promise<unknown> {
  const url = new URL(path, `https://${config.host}`);
  url.searchParams.set("domain", domain);

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": config.apiKey,
      "x-rapidapi-host": config.host,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Similarweb ${path} failed (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`);
  }

  return res.json();
}

export function resolveSimilarwebConfig(opts?: {
  userKey?: string | null;
  systemKey?: string | null;
}): SimilarwebConfig | null {
  const apiKey = opts?.userKey?.trim() || opts?.systemKey?.trim() || process.env.SIMILARWEB_RAPIDAPI_KEY?.trim() || process.env.RAPIDAPI_KEY?.trim();
  if (!apiKey) return null;

  const host =
    process.env.SIMILARWEB_RAPIDAPI_HOST?.trim() ||
    "similarweb-api-pro.p.rapidapi.com";

  return {
    apiKey,
    host,
    similarSitesPath: process.env.SIMILARWEB_SIMILAR_SITES_PATH?.trim() || "/similar-sites",
    overviewPath: process.env.SIMILARWEB_OVERVIEW_PATH?.trim() || "/website-overview",
  };
}

/** Fetch Similarweb traffic + peer set via RapidAPI Similarweb API Pro. */
export async function fetchSimilarwebBundle(domain: string, config: SimilarwebConfig): Promise<SimilarwebBundle> {
  const normalized = normalizeDomain(domain);
  const merged: Record<string, unknown> = {};
  let traffic: TrafficProfile | null = null;
  let similarCompetitors: SimilarCompetitor[] = [];

  const attempts = [
    { path: config.similarSitesPath, label: "similar-sites" },
    { path: config.overviewPath, label: "overview" },
  ];

  for (const attempt of attempts) {
    try {
      const payload = await rapidGet(config, attempt.path, normalized);
      const parsed = parseSimilarwebPayload(payload, normalized);
      merged[attempt.label] = parsed.raw;
      if (!traffic && parsed.traffic) traffic = parsed.traffic;
      if (!similarCompetitors.length && parsed.similarCompetitors.length) {
        similarCompetitors = parsed.similarCompetitors;
      }
      if (traffic && similarCompetitors.length) break;
    } catch (err) {
      merged[`${attempt.label}_error`] = err instanceof Error ? err.message : String(err);
    }
  }

  if (!traffic && !similarCompetitors.length) {
    throw new Error(
      typeof merged.similar_sites_error === "string"
        ? merged.similar_sites_error
        : "Similarweb returned no traffic or peer data",
    );
  }

  return { traffic, similarCompetitors, raw: merged };
}
