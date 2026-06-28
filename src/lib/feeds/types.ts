/** External data feed identifiers used across R-AD ingestion. */
export type FeedSource = "similarweb" | "dataforseo" | "apify" | "newspi";

export type FeedStatus = "ok" | "error" | "skipped" | "empty";

export type FeedSourceMeta = {
  status: FeedStatus;
  message?: string;
  fetchedAt?: string;
};

export type SimilarCompetitor = {
  domain: string;
  title: string | null;
  description: string | null;
  monthlyVisits: number | null;
  globalRank: number | null;
  categoryRank: number | null;
  topCountry: string | null;
  topCountryRank: number | null;
  /** Similarity score when API provides it; Similar Sites endpoint uses list order instead. */
  affinity: number | null;
  favicon: string | null;
  /** Preserves Similarweb Similar Sites response order (most relevant first). */
  peerOrder: number;
};

export type TrafficProfile = {
  domain: string;
  title: string | null;
  description: string | null;
  monthlyVisits: number | null;
  globalRank: number | null;
  category: string | null;
  categoryRank: number | null;
  topCountry: string | null;
  topCountryRank: number | null;
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
