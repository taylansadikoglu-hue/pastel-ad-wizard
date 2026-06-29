/** External data feed identifiers used across R-AD ingestion. */
export type FeedSource = "similarweb" | "dataforseo" | "apify" | "newspi";

export type FeedStatus = "ok" | "error" | "skipped" | "empty";

export type FeedSourceMeta = {
  status: FeedStatus;
  message?: string;
  fetchedAt?: string;
};

/** Audience-overlap peer — affinity and category position only (no global rank). */
export type SimilarCompetitor = {
  domain: string;
  category: string | null;
  categoryRank: number | null;
  /** 0–1 similarity when API provides it. */
  affinity: number | null;
  favicon: string | null;
  peerOrder: number;
};

export type VisitTrendPoint = {
  date: string;
  changePct: number;
};

/** Domain traffic profile — angles, trends, and category context (no global rank). */
export type TrafficProfile = {
  domain: string;
  title: string | null;
  description: string | null;
  monthlyVisits: number | null;
  /** Month-over-month visit change (e.g. -0.055 = -5.5%). */
  visitsChangePct: number | null;
  category: string | null;
  categoryRank: number | null;
  categoryRankChange: number | null;
  topCountry: string | null;
  topCountryRank: number | null;
  countryRankChange: number | null;
  topCountryShare: number | null;
  bounceRate: number | null;
  pagesPerVisit: number | null;
  avgVisitDuration: string | null;
  organicSearchShare: number | null;
  paidSearchShare: number | null;
  keywordsTotalCount: number | null;
  topKeywords: string[];
  topSocialNetwork: string | null;
  topSocialShare: number | null;
  primaryTrafficSource: string | null;
  primaryTrafficShare: number | null;
  topAdPublishers: string[];
  visitTrend: VisitTrendPoint[];
  tags: string[];
  favicon: string | null;
};

export type PaidMediaSnapshot = {
  estimatedMonthlySpend: number | null;
  totalKeywords: number | null;
  averageCpc: number | null;
  creativeCount: number;
  byPlatform: Record<string, number>;
};

export type NewsArticle = {
  title: string;
  url: string | null;
  source: string | null;
  publishedAt: string | null;
};

export type SynthesizedInsight = {
  id: string;
  label: string;
  value: string;
  detail: string;
  sources: FeedSource[];
  priority: "high" | "medium" | "low";
};

/** Unified domain intelligence envelope — one object for UI + strategist enrichment. */
export type DomainIntelligence = {
  domain: string;
  brandLabel: string | null;
  fetchedAt: string;
  traffic: TrafficProfile | null;
  similarCompetitors: SimilarCompetitor[];
  paidMedia: PaidMediaSnapshot | null;
  news: NewsArticle[];
  trendSignals: { keyword: string; score: number; source: string; date: string | null }[];
  insights: SynthesizedInsight[];
  sources: Record<FeedSource, FeedSourceMeta>;
};

export type DomainIntelligenceRequest = {
  domain: string;
  brandLabel?: string | null;
  /** When true, persist Similarweb raw payload on latest domain_scans.engine_output */
  persist?: boolean;
};
