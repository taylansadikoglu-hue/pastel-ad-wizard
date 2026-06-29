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
  like_count?: number | null;
  share_count?: number | null;
  impression?: number | null;
  geo?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  landing_url?: string | null;
  source_archive_url?: string | null;
  [key: string]: unknown;
};

export type SearchAdsInput = {
  keyword: string;
  appType: AppType;
  page?: number;
  pageSize?: number;
  geo?: string;
  language?: string;
  platform?: string | string[];
  adsType?: string;
  daysBack?: number;
  sortField?: string;
};

export type SearchAdsResponse = {
  ads: AdLibraryAd[];
  total?: number;
  _credits?: number;
  _credits_remaining?: number;
};

export type EnrichAdInput = {
  ad: AdLibraryAd | Record<string, unknown>;
};

export type EnrichAdResponse = {
  summary?: string | null;
  transcription?: string | null;
  analysis?: string | null;
  ugc_script?: string | null;
  markdown?: string | null;
  source?: string | null;
  cached?: boolean;
  _credits?: number;
  _credits_remaining?: number;
  [key: string]: unknown;
};

export type AdvertiserSearchResult = {
  id?: string;
  name?: string;
  meta_page_id?: string;
  google_advertiser_id?: string;
  linkedin_id?: string;
  platforms?: string[];
  confidence?: number;
  [key: string]: unknown;
};

export type CurateAdvertiserResponse = {
  ads?: AdLibraryAd[];
  total?: number;
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

    const body = {
      keyword: input.keyword,
      appType: input.appType,
      ...(input.page != null ? { page: input.page } : {}),
      ...(input.pageSize != null ? { pageSize: Math.min(input.pageSize, 50) } : {}),
      ...(input.geo ? { geo: input.geo } : {}),
      ...(input.language ? { language: input.language } : {}),
      ...(input.platform ? { platform: input.platform } : {}),
      ...(input.adsType ? { adsType: input.adsType } : {}),
      ...(input.daysBack != null ? { daysBack: input.daysBack } : {}),
      ...(input.sortField ? { sortField: input.sortField } : {}),
    };

    const data = await this.request<SearchAdsResponse>("POST", "/api/search", body, 1);
    const ads = Array.isArray(data.ads) ? data.ads : extractAdsArray(data);
    const result: SearchAdsResponse = { ...data, ads };
    this.logCredits(data._credits ?? 1, data._credits_remaining);
    return result;
  }

  async enrichAd(input: EnrichAdInput): Promise<EnrichAdResponse> {
    if (this.dryRun) {
      const mock = mockEnrichAd(input.ad);
      this.logCredits(mock._credits ?? 1, mock._credits_remaining);
      return mock;
    }

    const data = await this.request<EnrichAdResponse>("POST", "/api/enrichment", input.ad, 1);
    this.logCredits(data._credits ?? 1, data._credits_remaining);
    return data;
  }

  async searchAdvertisers(query: string): Promise<AdvertiserSearchResult[]> {
    if (this.dryRun) {
      return mockAdvertiserSearch(query);
    }

    const qs = new URLSearchParams({ q: query, query }).toString();
    const data = await this.request<AdvertiserSearchResult[] | { results?: AdvertiserSearchResult[] }>(
      "GET",
      `/api/advertisers/search?${qs}`,
      undefined,
      0,
    );

    if (Array.isArray(data)) return data;
    return data.results ?? [];
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
    this.logCredits(data._credits ?? 1, data._credits_remaining);
    return data;
  }

  async scanWinningAds(pageId: string): Promise<WinningConcept[]> {
    if (this.dryRun) {
      const mock = mockWinners(pageId);
      this.logCredits(10, 990);
      return mock;
    }

    if (this.creditTracker && !this.creditTracker.canSpend(10)) {
      throw new AdLibraryError("Winners scan blocked by credit safety cap", 402);
    }

    const url = `${this.baseUrl}/api/winners/advertiser/${encodeURIComponent(pageId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.headers(),
    });

    if (!res.ok) {
      await this.handleErrorResponse(res);
    }

    const text = await res.text();
    const concepts = parseNdjson<WinningConcept>(text);
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

      const data = (await res.json()) as T & { _credits?: number; _credits_remaining?: number };
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

function extractAdsArray(data: Record<string, unknown>): AdLibraryAd[] {
  for (const key of ["ads", "results", "data", "items"]) {
    const val = data[key];
    if (Array.isArray(val)) return val as AdLibraryAd[];
  }
  return [];
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
      const obj = JSON.parse(line) as { _credits_remaining?: number };
      if (obj._credits_remaining != null) return obj._credits_remaining;
    } catch {
      // continue
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mockSearchAds(input: SearchAdsInput): SearchAdsResponse {
  const kw = input.keyword;
  return {
    ads: [
      {
        ad_key: `dry-${kw}-1`,
        title: `${kw} — smarter banking`,
        body: `Discover ${kw} offers tailored for Australians.`,
        advertiser_name: kw,
        platform: "facebook",
        preview_img_url: "https://example.com/preview.jpg",
        like_count: 120,
        share_count: 8,
        impression: 45000,
        geo: "AUS",
        first_seen: new Date(Date.now() - 7 * 864e5).toISOString(),
        last_seen: new Date().toISOString(),
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
    summary: `${name} ad focuses on trust and value proposition.`,
    analysis: "Hook: direct benefit. CTA: Learn more. Buyer stage: consideration.",
    markdown: `## Hook\nTrust-led opener\n\n## CTA\nLearn more\n\n## Buyer stage\nconsideration`,
    cached: false,
    _credits: 1,
    _credits_remaining: 998,
  };
}

function mockAdvertiserSearch(query: string): AdvertiserSearchResult[] {
  const q = query.toLowerCase();
  const banks: AdvertiserSearchResult[] = [
    { id: "meta-commbank", name: "CommBank", meta_page_id: "123456789", confidence: 0.95 },
    { id: "meta-nab", name: "NAB", meta_page_id: "987654321", confidence: 0.92 },
    { id: "meta-westpac", name: "Westpac", meta_page_id: "456789123", confidence: 0.9 },
  ];
  return banks.filter((b) => b.name?.toLowerCase().includes(q) || q.includes(b.name?.toLowerCase() ?? ""));
}

function mockCurate(id: string): CurateAdvertiserResponse {
  return {
    ads: mockSearchAds({ keyword: id, appType: "3" }).ads,
    total: 1,
    _credits: 1,
    _credits_remaining: 997,
  };
}

function mockWinners(pageId: string): WinningConcept[] {
  return [
    {
      ad_key: `winner-${pageId}-1`,
      tier: "A",
      composite_score: 87.5,
      variant_count: 4,
      reasons: ["high engagement", "long run time"],
      tags: ["trust", "savings"],
    },
  ];
}
