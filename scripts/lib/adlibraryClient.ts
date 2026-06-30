/**
 * AdLibrary.com API client — search, enrichment, advertiser discovery, winners.
 * Auth: ADLIBRARY_API_KEY env var (Bearer token). Never hardcode keys.
 */

import { CreditTracker } from "./adlibraryCredits.ts";

const DEFAULT_BASE = "https://adlibrary.com";

export type AppType = "1" | "2" | "3";

export type AdLibraryAd = {
  ad_key: string;
  title?: string | null;
  body?: string | null;
  advertiser_name?: string | null;
  platform?: string | null;
  preview_img_url?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  like_count?: number | null;
  share_count?: number | null;
  impression?: number | null;
  geo?: string | string[] | null;
  first_seen?: string | null;
  last_seen?: string | null;
  landing_url?: string | null;
  landing_page_url?: string | null;
  source_archive_url?: string | null;
  adsType?: string | number | null;
  ad_type?: string | null;
  [key: string]: unknown;
};

export type SearchAdsInput = {
  keyword: string;
  appType: AppType;
  page?: number;
  pageSize?: number;
  geo?: string | string[];
  language?: string | string[];
  platform?: string | string[];
  adsType?: string | string[];
  daysBack?: number;
  dateFrom?: string;
  dateTo?: string;
  likeBegin?: number;
  likeEnd?: number;
  sortField?: string;
};

export type SearchAdsResponse = {
  ads: AdLibraryAd[];
  total?: number;
  page?: number;
  pageSize?: number;
  _credits?: number;
  _credits_remaining?: number;
};

export type EnrichAdInput = {
  ad: AdLibraryAd | Record<string, unknown>;
};

export type EnrichmentPayload = {
  summary?: string | null;
  transcription?: string | null;
  analysis?: string | null;
  ugc_script?: string | null;
  markdown?: string | null;
  source?: string | null;
};

export type EnrichAdResponse = EnrichmentPayload & {
  cached?: boolean;
  balance?: number;
  _credits?: number;
  _credits_remaining?: number;
  [key: string]: unknown;
};

export type AdvertiserPlatformCandidate = {
  id?: string;
  name?: string;
  logo?: string | null;
  page_alias?: string | null;
  likes?: number | null;
  verified?: boolean;
  ig_username?: string | null;
  ig_followers?: number | null;
  category?: string | null;
  legal_name?: string | null;
  ad_count?: number | null;
  advertiser_url?: string | null;
  is_person?: boolean;
  is_restricted?: boolean;
  [key: string]: unknown;
};

export type AdvertiserSearchResponse = {
  query: string;
  country?: string;
  best_match?: {
    name?: string;
    confidence?: number;
    meta?: AdvertiserPlatformCandidate;
    google?: AdvertiserPlatformCandidate;
    linkedin?: AdvertiserPlatformCandidate;
  } | null;
  candidates?: {
    meta?: AdvertiserPlatformCandidate[];
    google?: AdvertiserPlatformCandidate[];
    linkedin?: AdvertiserPlatformCandidate[];
  };
  errors?: Record<string, string>;
};

export type AdvertiserSearchResult = {
  id?: string;
  name?: string;
  meta_page_id?: string;
  google_advertiser_id?: string;
  linkedin_id?: string;
  platforms?: string[];
  confidence?: number;
  best_match?: boolean;
  [key: string]: unknown;
};

export type CurateAdvertiserResponse = {
  ads?: AdLibraryAd[];
  meta?: { sources?: unknown[]; ads?: AdLibraryAd[] };
  google?: { sources?: unknown[]; ads?: AdLibraryAd[] };
  linkedin?: { sources?: unknown[]; ads?: AdLibraryAd[] };
  total?: number;
  credits?: { used?: number; remaining?: number };
  _credits?: number;
  _credits_remaining?: number;
  [key: string]: unknown;
};

export type WinningConcept = {
  ad_key?: string;
  tier?: string;
  composite_score?: number;
  reasons?: unknown;
  variant_count?: number;
  variants?: unknown;
  dna_diff?: unknown;
  tags?: unknown;
  [key: string]: unknown;
};

export type AdLibraryClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  dryRun?: boolean;
  creditTracker?: CreditTracker;
  maxRetries?: number;
};

/** Two years — default backfill window for new paying-customer brands. */
export const ADLIBRARY_BACKFILL_DAYS = 730;

export class AdLibraryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "AdLibraryError";
  }
}

export class AdLibraryClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly dryRun: boolean;
  private readonly creditTracker?: CreditTracker;
  private readonly maxRetries: number;

  constructor(options: AdLibraryClientOptions = {}) {
    const key = options.apiKey ?? process.env.ADLIBRARY_API_KEY;
    if (!options.dryRun && !key) {
      throw new Error("ADLIBRARY_API_KEY is required (set env var or pass apiKey)");
    }
    this.apiKey = key ?? "dry-run";
    this.baseUrl = (options.baseUrl ?? process.env.ADLIBRARY_API_BASE ?? DEFAULT_BASE).replace(
      /\/$/,
      "",
    );
    this.dryRun = options.dryRun ?? false;
    this.creditTracker = options.creditTracker;
    this.maxRetries = options.maxRetries ?? 4;
  }

  async searchAds(input: SearchAdsInput): Promise<SearchAdsResponse> {
    if (this.dryRun) {
      const mock = mockSearchAds(input);
      this.logCredits(mock._credits ?? 1, mock._credits_remaining);
      return mock;
    }

    const body: Record<string, unknown> = {
      keyword: input.keyword,
      appType: input.appType,
    };
    if (input.page != null) body.page = input.page;
    if (input.pageSize != null) body.pageSize = Math.min(input.pageSize, 50);
    if (input.geo) body.geo = input.geo;
    if (input.language) body.language = input.language;
    if (input.platform) body.platform = input.platform;
    if (input.adsType) body.adsType = input.adsType;
    if (input.daysBack != null) body.daysBack = input.daysBack;
    if (input.dateFrom) body.dateFrom = input.dateFrom;
    if (input.dateTo) body.dateTo = input.dateTo;
    if (input.likeBegin != null) body.likeBegin = input.likeBegin;
    if (input.likeEnd != null) body.likeEnd = input.likeEnd;
    if (input.sortField) body.sortField = input.sortField;

    const data = await this.request<Record<string, unknown>>("POST", "/api/search", body, 1);
    const ads = extractAdsArray(data);
    const credits = extractCredits(data);
    const result: SearchAdsResponse = {
      ads,
      total: typeof data.total === "number" ? data.total : undefined,
      page: typeof data.page === "number" ? data.page : undefined,
      pageSize: typeof data.pageSize === "number" ? data.pageSize : undefined,
      _credits: credits.used,
      _credits_remaining: credits.remaining,
    };
    this.logCredits(credits.used ?? 1, credits.remaining);
    return result;
  }

  async enrichAd(input: EnrichAdInput): Promise<EnrichAdResponse> {
    if (this.dryRun) {
      const mock = mockEnrichAd(input.ad);
      this.logCredits(mock._credits ?? 1, mock._credits_remaining);
      return mock;
    }

    const payload = buildEnrichmentRequest(input.ad);
    const data = await this.request<Record<string, unknown>>("POST", "/api/enrichment", payload, 1);
    const enrichment = unwrapEnrichment(data);
    const credits = extractCredits(data);
    const result: EnrichAdResponse = {
      ...enrichment,
      cached: Boolean(data.cached),
      balance: typeof data.balance === "number" ? data.balance : undefined,
      _credits: credits.used,
      _credits_remaining: credits.remaining,
    };
    this.logCredits(credits.used ?? 1, credits.remaining);
    return result;
  }

  async searchAdvertisers(
    query: string,
    options?: { country?: string; limit?: number },
  ): Promise<AdvertiserSearchResult[]> {
    if (this.dryRun) {
      return mockAdvertiserSearch(query);
    }

    const params = new URLSearchParams({ q: query });
    if (options?.country) params.set("country", options.country);
    if (options?.limit) params.set("limit", String(Math.min(20, Math.max(1, options.limit))));

    const data = await this.request<AdvertiserSearchResponse | AdvertiserSearchResult[]>(
      "GET",
      `/api/advertisers/search?${params.toString()}`,
      undefined,
      0,
    );

    if (Array.isArray(data)) return data;
    return flattenAdvertiserSearch(data);
  }

  async searchAdvertisersRaw(
    query: string,
    options?: { country?: string; limit?: number },
  ): Promise<AdvertiserSearchResponse> {
    if (this.dryRun) {
      const results = mockAdvertiserSearch(query);
      return {
        query,
        best_match: results[0]
          ? {
              name: results[0].name,
              confidence: results[0].confidence,
              meta: { id: results[0].meta_page_id, name: results[0].name },
            }
          : null,
        candidates: {
          meta: results.map((r) => ({ id: r.meta_page_id, name: r.name })),
        },
      };
    }

    const params = new URLSearchParams({ q: query });
    if (options?.country) params.set("country", options.country);
    if (options?.limit) params.set("limit", String(Math.min(20, Math.max(1, options.limit))));

    return this.request<AdvertiserSearchResponse>(
      "GET",
      `/api/advertisers/search?${params.toString()}`,
      undefined,
      0,
    );
  }

  async curateAdvertiser(advertiserId: string): Promise<CurateAdvertiserResponse> {
    if (this.dryRun) {
      const mock = mockCurate(advertiserId);
      this.logCredits(mock._credits ?? 1, mock._credits_remaining);
      return mock;
    }

    const data = await this.request<CurateAdvertiserResponse>(
      "POST",
      `/api/advertisers/${encodeURIComponent(advertiserId)}/curate`,
      {},
      1,
    );
    const ads = extractCuratedAds(data);
    const credits = extractCredits(data);
    const result: CurateAdvertiserResponse = {
      ...data,
      ads,
      _credits: credits.used ?? data.credits?.used ?? 1,
      _credits_remaining: credits.remaining ?? data.credits?.remaining,
    };
    this.logCredits(result._credits ?? 1, result._credits_remaining);
    return result;
  }

  async scanWinningAds(
    pageId: string,
    options?: { country?: string; topEnrich?: number; maxPages?: number },
  ): Promise<WinningConcept[]> {
    if (this.dryRun) {
      const mock = mockWinners(pageId);
      this.logCredits(10, 990);
      return mock;
    }

    if (this.creditTracker && !this.creditTracker.canSpend(10)) {
      throw new AdLibraryError("Winners scan blocked by credit safety cap", 402);
    }

    const body: Record<string, unknown> = {};
    if (options?.country) body.country = options.country;
    if (options?.topEnrich != null) body.top_enrich = options.topEnrich;
    if (options?.maxPages != null) body.max_pages = options.maxPages;

    const url = `${this.baseUrl}/api/winners/advertiser/${encodeURIComponent(pageId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      await this.handleErrorResponse(res);
    }

    const text = await res.text();
    const concepts = parseWinnersNdjson(text);
    this.logCredits(10, parseCreditsRemaining(text));
    return concepts;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    estimatedCredits = 1,
  ): Promise<T> {
    if (this.creditTracker && estimatedCredits > 0 && !this.creditTracker.canSpend(estimatedCredits)) {
      throw new AdLibraryError("Request blocked by credit safety cap", 402);
    }

    const url = `${this.baseUrl}${path}`;
    let attempt = 0;

    while (true) {
      attempt += 1;
      const res = await fetch(url, {
        method,
        headers: this.headers(body != null),
        body: body != null ? JSON.stringify(body) : undefined,
      });

      if (res.status === 429 && attempt <= this.maxRetries) {
        const retryAfter = res.headers.get("Retry-After");
        const delayMs = retryAfter
          ? Math.max(1000, Number(retryAfter) * 1000 || 5000)
          : Math.min(30000, 1000 * 2 ** attempt);
        console.warn(`[adlibrary] 429 rate limited — retry in ${delayMs}ms (attempt ${attempt})`);
        await sleep(delayMs);
        continue;
      }

      if (!res.ok) {
        await this.handleErrorResponse(res);
      }

      const data = (await res.json()) as T;
      return data;
    }
  }

  private headers(json = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  private async handleErrorResponse(res: Response): Promise<never> {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }

    const msg =
      typeof body === "object" && body && "message" in body
        ? String((body as { message: unknown }).message)
        : `AdLibrary API error ${res.status}`;

    if (res.status === 401) {
      throw new AdLibraryError("Unauthorized — check ADLIBRARY_API_KEY", 401, body);
    }
    if (res.status === 402) {
      throw new AdLibraryError("Payment required — insufficient AdLibrary credits", 402, body);
    }
    if (res.status === 403) {
      throw new AdLibraryError("Forbidden — API key lacks permission for this endpoint", 403, body);
    }

    throw new AdLibraryError(msg, res.status, body);
  }

  private logCredits(used: number, remaining?: number | null): void {
    this.creditTracker?.record(used, remaining ?? null);
    if (remaining != null) {
      console.error(`[adlibrary] credits used: ${used}, remaining: ${remaining}`);
    }
  }
}

/** Build enrichment body per AdLibrary API spec. */
export function buildEnrichmentRequest(
  ad: AdLibraryAd | Record<string, unknown>,
): { ad: Record<string, unknown> } {
  const root = ad as Record<string, unknown>;
  const nested =
    root.payload && typeof root.payload === "object"
      ? (root.payload as Record<string, unknown>)
      : root;

  const adKey = String(nested.ad_key ?? root.ad_key ?? "");
  const platform = String(nested.platform ?? root.platform ?? "facebook");

  const videoUrl = firstString(
    nested.video_url,
    root.video_url,
    nested.videoUrl,
    root.videoUrl,
  );
  const imageUrl = firstString(
    nested.image_url,
    root.image_url,
    nested.preview_img_url,
    root.preview_img_url,
  );
  const landingUrl = firstString(
    nested.landing_page_url,
    root.landing_page_url,
    nested.landing_url,
    root.landing_url,
  );

  return {
    ad: {
      ad_key: adKey,
      platform,
      advertiser_name: nested.advertiser_name ?? root.advertiser_name ?? null,
      title: nested.title ?? root.title ?? null,
      body: nested.body ?? root.body ?? null,
      video_url: videoUrl,
      image_url: imageUrl,
      preview_img_url: nested.preview_img_url ?? root.preview_img_url ?? imageUrl,
      landing_page_url: landingUrl,
    },
  };
}

function unwrapEnrichment(data: Record<string, unknown>): EnrichmentPayload {
  const nested =
    data.enrichment && typeof data.enrichment === "object"
      ? (data.enrichment as Record<string, unknown>)
      : data;

  return {
    summary: stringOrNull(nested.summary),
    transcription: stringOrNull(nested.transcription),
    analysis: stringOrNull(nested.analysis),
    ugc_script: stringOrNull(nested.ugc_script),
    markdown: stringOrNull(nested.markdown),
    source: stringOrNull(nested.source),
  };
}

function extractAdsArray(data: Record<string, unknown>): AdLibraryAd[] {
  for (const key of ["list", "ads", "results", "data", "items"]) {
    const val = data[key];
    if (Array.isArray(val)) return val as AdLibraryAd[];
  }
  return [];
}

function extractCuratedAds(data: CurateAdvertiserResponse): AdLibraryAd[] {
  if (Array.isArray(data.ads) && data.ads.length) return data.ads;

  const merged: AdLibraryAd[] = [];
  for (const bucket of [data.meta, data.google, data.linkedin]) {
    if (bucket?.ads?.length) merged.push(...bucket.ads);
  }
  return merged;
}

function flattenAdvertiserSearch(data: AdvertiserSearchResponse): AdvertiserSearchResult[] {
  const out: AdvertiserSearchResult[] = [];

  if (data.best_match) {
    const bm = data.best_match;
    out.push({
      id: bm.meta?.id ?? bm.google?.id ?? bm.linkedin?.id,
      name: bm.name,
      meta_page_id: bm.meta?.id,
      google_advertiser_id: bm.google?.id,
      linkedin_id: bm.linkedin?.id,
      confidence: bm.confidence,
      best_match: true,
      platforms: [
        bm.meta?.id ? "meta" : null,
        bm.google?.id ? "google" : null,
        bm.linkedin?.id ? "linkedin" : null,
      ].filter(Boolean) as string[],
    });
  }

  const pushCandidates = (
    platform: string,
    items: AdvertiserPlatformCandidate[] | undefined,
    idKey: keyof AdvertiserSearchResult,
  ) => {
    for (const item of items ?? []) {
      if (!item.id && !item.name) continue;
      out.push({
        id: item.id,
        name: item.name,
        [idKey]: item.id,
        platforms: [platform],
        confidence: 0.5,
      } as AdvertiserSearchResult);
    }
  };

  pushCandidates("meta", data.candidates?.meta, "meta_page_id");
  pushCandidates("google", data.candidates?.google, "google_advertiser_id");
  pushCandidates("linkedin", data.candidates?.linkedin, "linkedin_id");

  const seen = new Set<string>();
  return out.filter((r) => {
    const key = `${r.name ?? ""}:${r.meta_page_id ?? r.google_advertiser_id ?? r.linkedin_id ?? r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCredits(data: Record<string, unknown>): { used?: number; remaining?: number } {
  if (data._credits && typeof data._credits === "object") {
    const c = data._credits as { used?: number; remaining?: number };
    return { used: c.used, remaining: c.remaining };
  }
  return {
    used: typeof data._credits === "number" ? data._credits : undefined,
    remaining:
      typeof data._credits_remaining === "number"
        ? data._credits_remaining
        : typeof data.balance === "number"
          ? data.balance
          : undefined,
  };
}

function parseWinnersNdjson(text: string): WinningConcept[] {
  const out: WinningConcept[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj._stage === "score" && obj.ad) {
        out.push({
          ...(obj.ad as WinningConcept),
          tier: (obj.score as { tier?: string })?.tier,
          composite_score: (obj.score as { composite?: number })?.composite,
          reasons: (obj.score as { reasons?: unknown })?.reasons,
          variant_count: (obj.score as { variant_count?: number })?.variant_count,
          variants: (obj.score as { variants?: unknown })?.variants,
          dna_diff: (obj.score as { dna_diff?: unknown })?.dna_diff,
          tags: (obj.score as { tags?: unknown })?.tags,
        });
      } else if (!obj._stage) {
        out.push(obj as WinningConcept);
      }
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

function parseNdjson<T>(text: string): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // skip malformed lines
    }
  }
  return out;
}

function parseCreditsRemaining(text: string): number | null {
  for (const line of text.split("\n").reverse()) {
    try {
      const obj = JSON.parse(line) as { _credits_remaining?: number; balance?: number };
      if (obj._credits_remaining != null) return obj._credits_remaining;
      if (obj.balance != null) return obj.balance;
    } catch {
      // continue
    }
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function stringOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mockSearchAds(input: SearchAdsInput): SearchAdsResponse {
  const kw = input.keyword;
  const platforms = Array.isArray(input.platform)
    ? input.platform
    : input.platform
      ? [input.platform]
      : ["facebook"];
  const isYoutubeOnly =
    platforms.length === 1 && platforms.some((p) => String(p).toLowerCase().includes("youtube"));

  return {
    ads: [
      {
        ad_key: `dry-${kw}-${isYoutubeOnly ? "yt" : "fb"}-1`,
        title: `${kw} — ${isYoutubeOnly ? "video spot" : "smarter banking"}`,
        body: `Discover ${kw} offers tailored for Australians.`,
        advertiser_name: kw,
        platform: isYoutubeOnly ? "youtube" : "facebook",
        preview_img_url: "https://example.com/preview.jpg",
        video_url: isYoutubeOnly ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : null,
        like_count: 120,
        share_count: 8,
        impression: 45000,
        geo: "AUS",
        first_seen: new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10),
        last_seen: new Date().toISOString().slice(0, 10),
        landing_page_url: `https://${kw.toLowerCase().replace(/\s+/g, "")}.com.au/home-loans`,
        adsType: isYoutubeOnly ? "2" : "1",
      },
    ],
    total: 1,
    _credits: 1,
    _credits_remaining: 999,
  };
}

function mockEnrichAd(ad: Record<string, unknown>): EnrichAdResponse {
  const name = String(ad.advertiser_name ?? ad.title ?? "advertiser");
  return {
    summary: `**Brand:** ${name}\n**Product:** Home lending\n**Key Message:** Compare rates and save on your mortgage`,
    analysis: [
      "## PHASE 1: HOOK FORENSICS",
      "Hook: Rate comparison opener with trust cue",
      "",
      "## TARGET AUDIENCE",
      "Australian homeowners 30–55, refinancing or first-home buyers, household income $120k+",
      "",
      "## CTA",
      "Compare home loan rates",
      "",
      "## LANDING PAGE",
      "Rate table above fold, lender logos, calculator widget — primary KPI is rate enquiry submissions",
      "",
      "## MEDIA ECONOMICS",
      "Estimated CPC: $3.20–$4.80 (finance vertical, AU)",
      "Buyer stage: consideration",
      "Emotional driver: security",
      "Offer type: rate comparison",
    ].join("\n"),
    markdown: `## Hook\nTrust-led rate comparison\n\n## CTA\nCompare home loan rates\n\n## Target audience\nHomeowners 30–55 refinancing\n\n## Landing page\nRate calculator + enquiry form\n\n## Est. CPC\n$3.20–$4.80 AUD`,
    cached: false,
    _credits: 1,
    _credits_remaining: 998,
  };
}

function mockAdvertiserSearch(query: string): AdvertiserSearchResult[] {
  const q = query.toLowerCase();
  const banks: AdvertiserSearchResult[] = [
    { id: "meta-commbank", name: "CommBank", meta_page_id: "123456789", confidence: 0.95, best_match: true, platforms: ["meta"] },
    { id: "meta-nab", name: "NAB", meta_page_id: "987654321", confidence: 0.92, platforms: ["meta"] },
    { id: "meta-westpac", name: "Westpac", meta_page_id: "456789123", confidence: 0.9, platforms: ["meta"] },
  ];
  return banks.filter((b) => b.name?.toLowerCase().includes(q) || q.includes(b.name?.toLowerCase() ?? ""));
}

function mockCurate(id: string): CurateAdvertiserResponse {
  const ads = mockSearchAds({ keyword: id, appType: "3" }).ads;
  return {
    meta: { ads },
    ads,
    total: ads.length,
    _credits: 1,
    _credits_remaining: 997,
  };
}

function mockWinners(pageId: string): WinningConcept[] {
  return [
    {
      ad_key: `winner-${pageId}-1`,
      tier: "high_confidence_winner",
      composite_score: 0.87,
      variant_count: 4,
      reasons: ["high engagement", "long run time"],
      tags: ["trust", "savings"],
    },
  ];
}
