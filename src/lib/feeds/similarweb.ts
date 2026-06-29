import { normalizeDomain } from "./normalize-domain";
import type { SimilarCompetitor, TrafficProfile, VisitTrendPoint } from "./types";

export type SimilarwebConfig = {
  apiKey: string;
  host: string;
  analysisPath: string;
};

export type SimilarwebBundle = {
  traffic: TrafficProfile | null;
  similarCompetitors: SimilarCompetitor[];
  raw: Record<string, unknown>;
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function pct(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  // API returns 0–1 fractions for shares; leave as-is for formatPct
  return n;
}

function formatCategoryId(id: string | null): string | null {
  if (!id) return null;
  return id
    .split("/")
    .pop()
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? id;
}

function parseVisitTrend(history: unknown): VisitTrendPoint[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const date = str(r.date) ?? "";
      const changePct = num(r.percentageChange);
      if (!date || changePct == null) return null;
      return { date, changePct };
    })
    .filter((p): p is VisitTrendPoint => p != null);
}

function parseTrafficSources(sources: unknown): { source: string; share: number } | null {
  if (!Array.isArray(sources)) return null;
  let best: { source: string; share: number } | null = null;
  for (const row of sources) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const source = str(r.source);
    const share = pct(r.percentage);
    if (!source || share == null) continue;
    if (!best || share > best.share) best = { source, share };
  }
  return best;
}

function parseTopSocial(body: Record<string, unknown>): { name: string; share: number } | null {
  const src = body.socialNetworksSource as Record<string, unknown> | undefined;
  const networks = src?.topSocialNetworks;
  if (!Array.isArray(networks) || !networks.length) return null;
  const top = networks[0] as Record<string, unknown>;
  const name = str(top.name);
  const share = pct(top.visitsShare);
  if (!name || share == null) return null;
  return { name, share };
}

function parseTopAdPublishers(body: Record<string, unknown>): string[] {
  const src = body.adsSource as Record<string, unknown> | undefined;
  const sites = src?.topAdsSites;
  if (!Array.isArray(sites)) return [];
  return sites
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const domain = str((row as Record<string, unknown>).domain);
      const locked = (row as Record<string, unknown>).isLocked === true;
      return domain && !locked ? domain : null;
    })
    .filter((d): d is string => Boolean(d))
    .slice(0, 5);
}

function parseTopKeywords(body: Record<string, unknown>): string[] {
  const src = body.searchesSource as Record<string, unknown> | undefined;
  const kws = src?.topKeywords;
  if (!Array.isArray(kws)) return [];
  return kws
    .map((row) => (row && typeof row === "object" ? str((row as Record<string, unknown>).name) : null))
    .filter((k): k is string => Boolean(k))
    .slice(0, 5);
}

/** Parse Similar Web Data API — GET /?domain= */
export function parseSimilarWebDataPayload(raw: unknown, domain: string): SimilarwebBundle {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const normalized = normalizeDomain(domain);

  if (body.status === "error" || body.success === false) {
    throw new Error(str(body.message) ?? "Market signals API returned an error");
  }

  const overview = (body.overview ?? {}) as Record<string, unknown>;
  const trafficBlock = (body.traffic ?? {}) as Record<string, unknown>;
  const ranking = (body.ranking ?? {}) as Record<string, unknown>;
  const searches = (body.searchesSource ?? {}) as Record<string, unknown>;
  const geo = (body.geography ?? {}) as Record<string, unknown>;
  const topCountries = geo.topCountriesTraffics;
  const topGeo =
    Array.isArray(topCountries) && topCountries[0] && typeof topCountries[0] === "object"
      ? (topCountries[0] as Record<string, unknown>)
      : null;

  const primarySource = parseTrafficSources(body.trafficSources);
  const topSocial = parseTopSocial(body);
  const categoryId = str(overview.companyCategoryId ?? body.categoryId);

  const traffic: TrafficProfile = {
    domain: str(body.domain) ?? normalized,
    title: str(overview.companyName) ?? null,
    description: str(overview.description) ?? null,
    monthlyVisits: num(overview.visitsTotalCount ?? trafficBlock.visitsTotalCount),
    visitsChangePct: num(trafficBlock.visitsTotalCountChange),
    category: formatCategoryId(categoryId),
    categoryRank: num(overview.categoryRank ?? ranking.categoryRank),
    categoryRankChange: num(overview.categoryRankChange ?? ranking.categoryRankChange),
    topCountry: str(overview.countryAlpha2Code ?? topGeo?.countryAlpha2Code) ?? null,
    topCountryRank: num(overview.countryRank ?? ranking.countryRank),
    countryRankChange: num(overview.countryRankChange ?? ranking.countryRankChange),
    topCountryShare: topGeo ? pct(topGeo.visitsShare) : null,
    bounceRate: pct(overview.bounceRate ?? trafficBlock.bounceRate),
    pagesPerVisit: num(overview.pagesPerVisit ?? trafficBlock.pagesPerVisit),
    avgVisitDuration: str(overview.visitsAvgDurationFormatted ?? trafficBlock.visitsAvgDurationFormatted),
    organicSearchShare: pct(searches.organicSearchShare),
    paidSearchShare: pct(searches.paidSearchShare),
    keywordsTotalCount: num(searches.keywordsTotalCount),
    topKeywords: parseTopKeywords(body),
    topSocialNetwork: topSocial?.name ?? null,
    topSocialShare: topSocial?.share ?? null,
    primaryTrafficSource: primarySource?.source ?? null,
    primaryTrafficShare: primarySource?.share ?? null,
    topAdPublishers: parseTopAdPublishers(body),
    visitTrend: parseVisitTrend(trafficBlock.history),
    tags: [],
    favicon: str(body.icon) ?? null,
  };

  const competitorsRaw = (body.competitors as Record<string, unknown> | undefined)?.topSimilarityCompetitors;
  const similarCompetitors: SimilarCompetitor[] = [];
  if (Array.isArray(competitorsRaw)) {
    competitorsRaw.forEach((row, index) => {
      if (!row || typeof row !== "object") return;
      const r = row as Record<string, unknown>;
      const peerDomain = str(r.domain);
      if (!peerDomain) return;
      const peerNorm = normalizeDomain(peerDomain);
      if (peerNorm === normalized) return;
      similarCompetitors.push({
        domain: peerNorm,
        category: formatCategoryId(str(r.categoryId)),
        categoryRank: num(r.categoryRank),
        affinity: num(r.affinity),
        favicon: str(r.icon),
        peerOrder: index,
      });
    });
  }

  return { traffic, similarCompetitors: similarCompetitors.slice(0, 12), raw: body };
}

async function rapidGet(config: SimilarwebConfig, domain: string): Promise<unknown> {
  const path = config.analysisPath.startsWith("/") ? config.analysisPath : `/${config.analysisPath}`;
  const url = new URL(path, `https://${config.host}`);
  url.searchParams.set("domain", domain);

  const res = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": config.apiKey,
      "x-rapidapi-host": config.host,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Market signals failed (${res.status})${text ? `: ${text.slice(0, 120)}` : ""}`);
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
    process.env.SIMILARWEB_RAPIDAPI_HOST?.trim() || "similar-web-data.p.rapidapi.com";

  return {
    apiKey,
    host,
    analysisPath: process.env.SIMILARWEB_ANALYSIS_PATH?.trim() || "/",
  };
}

/** Fetch domain analysis via RapidAPI Similar Web Data. */
export async function fetchSimilarwebBundle(domain: string, config: SimilarwebConfig): Promise<SimilarwebBundle> {
  const normalized = normalizeDomain(domain);
  const payload = await rapidGet(config, normalized);
  return parseSimilarWebDataPayload(payload, normalized);
}

/** @deprecated Legacy parser alias — use parseSimilarWebDataPayload */
export const parseSimilarwebPayload = parseSimilarWebDataPayload;
