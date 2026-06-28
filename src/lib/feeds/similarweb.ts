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

/** Shape returned by RapidAPI Similarweb API Pro — GET Similar Sites */
export type SimilarwebSimilarSitesResponse = {
  success?: boolean;
  sourceSite?: SimilarwebSiteRecord;
  similarSites?: SimilarwebSiteRecord[];
};

export type SimilarwebSiteRecord = {
  site?: string;
  domain?: string;
  url?: string;
  title?: string | null;
  description?: string | null;
  totalVisits?: number;
  visits?: number;
  globalRank?: number;
  category?: string;
  categoryRank?: number;
  rank?: number;
  topCountry?: string;
  topCountryRank?: number;
  affinity?: number;
  score?: number;
  tags?: string[];
  images?: {
    favicon?: string;
    smartphone?: string;
    desktop?: string;
  };
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function siteDomain(row: SimilarwebSiteRecord): string | null {
  const raw = row.site ?? row.domain ?? row.url;
  if (!raw || typeof raw !== "string") return null;
  return normalizeDomain(raw);
}

function faviconFrom(row: SimilarwebSiteRecord): string | null {
  const fav = row.images?.favicon;
  return typeof fav === "string" && fav.length > 0 ? fav : null;
}

function toTrafficProfile(site: SimilarwebSiteRecord, fallbackDomain: string): TrafficProfile {
  const domain = siteDomain(site) ?? fallbackDomain;
  return {
    domain,
    title: typeof site.title === "string" ? site.title : null,
    description: typeof site.description === "string" ? site.description : null,
    monthlyVisits: num(site.totalVisits ?? site.visits),
    globalRank: num(site.globalRank),
    category: typeof site.category === "string" ? site.category : null,
    categoryRank: num(site.categoryRank ?? site.rank),
    topCountry: typeof site.topCountry === "string" ? site.topCountry : null,
    topCountryRank: num(site.topCountryRank),
    tags: Array.isArray(site.tags) ? site.tags.filter((t): t is string => typeof t === "string") : [],
    favicon: faviconFrom(site),
  };
}

function toSimilarCompetitor(row: SimilarwebSiteRecord, peerOrder: number): SimilarCompetitor | null {
  const domain = siteDomain(row);
  if (!domain) return null;
  return {
    domain,
    title: typeof row.title === "string" ? row.title : null,
    description: typeof row.description === "string" ? row.description : null,
    monthlyVisits: num(row.totalVisits ?? row.visits),
    globalRank: num(row.globalRank),
    categoryRank: num(row.categoryRank ?? row.rank),
    topCountry: typeof row.topCountry === "string" ? row.topCountry : null,
    topCountryRank: num(row.topCountryRank),
    affinity: num(row.affinity ?? row.score),
    favicon: faviconFrom(row),
    peerOrder,
  };
}

/**
 * Parse RapidAPI Similarweb API Pro — GET Similar Sites response.
 * @see SimilarwebSimilarSitesResponse — `{ success, sourceSite, similarSites }`
 */
export function parseSimilarwebPayload(raw: unknown, domain: string): SimilarwebBundle {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const normalized = normalizeDomain(domain);

  if (body.success === false) {
    throw new Error("Similarweb API returned success: false");
  }

  const sourceSite = (body.sourceSite ?? body.source_site) as SimilarwebSiteRecord | undefined;

  let traffic: TrafficProfile | null = null;
  if (sourceSite && typeof sourceSite === "object") {
    traffic = toTrafficProfile(sourceSite, normalized);
  }

  const similarRaw =
    body.similarSites ??
    body.similar_sites ??
    body.sites ??
    (Array.isArray(body.data) ? body.data : null);

  const similarCompetitors: SimilarCompetitor[] = [];
  if (Array.isArray(similarRaw)) {
    similarRaw.forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      const mapped = toSimilarCompetitor(row as SimilarwebSiteRecord, index);
      if (mapped && mapped.domain !== normalized) similarCompetitors.push(mapped);
    });
  }

  // Similar Sites endpoint has no affinity — preserve API list order (most relevant first).
  similarCompetitors.sort((a, b) => {
    if (a.affinity != null && b.affinity != null && a.affinity !== b.affinity) {
      return b.affinity - a.affinity;
    }
    return a.peerOrder - b.peerOrder;
  });

  return {
    traffic,
    similarCompetitors: similarCompetitors.slice(0, 20),
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
  const apiKey =
    opts?.userKey?.trim() ||
    opts?.systemKey?.trim() ||
    process.env.SIMILARWEB_RAPIDAPI_KEY?.trim() ||
    process.env.RAPIDAPI_KEY?.trim();
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
      // Similar Sites returns sourceSite + similarSites in one call — stop when complete.
      if (traffic && similarCompetitors.length) break;
    } catch (err) {
      merged[`${attempt.label}_error`] = err instanceof Error ? err.message : String(err);
    }
  }

  if (!traffic && !similarCompetitors.length) {
    const errKey = Object.keys(merged).find((k) => k.endsWith("_error"));
    throw new Error(
      errKey && typeof merged[errKey] === "string"
        ? (merged[errKey] as string)
        : "Similarweb returned no traffic or peer data",
    );
  }

  return { traffic, similarCompetitors, raw: merged };
}
