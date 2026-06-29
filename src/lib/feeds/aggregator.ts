import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNewsFeed } from "./newspi";
import { formatCurrency, formatPct, formatVisits, normalizeDomain } from "./normalize-domain";
import { fetchSimilarwebBundle, resolveSimilarwebConfig } from "./similarweb";
import { loadPaidMediaFromSupabase, loadTrendSignalsFromSupabase } from "./supabase-feeds";
import type {
  DomainIntelligence,
  FeedSource,
  FeedSourceMeta,
  SynthesizedInsight,
} from "./types";

function meta(status: FeedSourceMeta["status"], message?: string): FeedSourceMeta {
  return { status, message, fetchedAt: new Date().toISOString() };
}

function emptySources(): Record<FeedSource, FeedSourceMeta> {
  return {
    similarweb: meta("skipped"),
    dataforseo: meta("skipped"),
    apify: meta("skipped"),
    newspi: meta("skipped"),
  };
}

function synthesizeInsights(input: {
  domain: string;
  trafficVisits: number | null;
  visitsChangePct: number | null;
  category: string | null;
  categoryRank: number | null;
  categoryRankChange: number | null;
  topCountry: string | null;
  topCountryShare: number | null;
  organicSearchShare: number | null;
  paidSearchShare: number | null;
  topSocialNetwork: string | null;
  topSocialShare: number | null;
  primaryTrafficSource: string | null;
  primaryTrafficShare: number | null;
  topKeywords: string[];
  similarCount: number;
  topSimilar: string | null;
  topSimilarAffinity: number | null;
  paidSpend: number | null;
  creativeCount: number;
  newsCount: number;
}): SynthesizedInsight[] {
  const insights: SynthesizedInsight[] = [];

  if (input.trafficVisits != null) {
    const trend =
      input.visitsChangePct != null
        ? `${formatPct(input.visitsChangePct, { fromFraction: true })} MoM visits`
        : null;
    const rankParts = [
      input.categoryRank != null ? `#${input.categoryRank} in ${input.category ?? "category"}` : null,
      input.categoryRankChange != null && input.categoryRankChange !== 0
        ? `${input.categoryRankChange > 0 ? "↑" : "↓"}${Math.abs(input.categoryRankChange)} rank`
        : null,
      input.topCountry && input.topCountryShare != null
        ? `${input.topCountry} ${formatPct(input.topCountryShare, { fromFraction: true })} of traffic`
        : null,
    ].filter(Boolean);
    insights.push({
      id: "traffic-trend",
      label: "Visit trend",
      value: `${formatVisits(input.trafficVisits)} monthly visits`,
      detail: [trend, rankParts.join(" · ")].filter(Boolean).join(" — ") || "Observed traffic from market signals.",
      sources: ["similarweb"],
      priority: "high",
    });
  }

  if (input.organicSearchShare != null || input.paidSearchShare != null) {
    const organic = input.organicSearchShare != null ? formatPct(input.organicSearchShare, { fromFraction: true }) : "—";
    const paid = input.paidSearchShare != null ? formatPct(input.paidSearchShare, { fromFraction: true }) : "—";
    const kw = input.topKeywords[0];
    insights.push({
      id: "search-mix",
      label: "Search mix",
      value: `${organic} organic · ${paid} paid`,
      detail: kw
        ? `Top intent: “${kw}” — ${input.paidSearchShare != null && input.paidSearchShare < 0.08 ? "brand-heavy, low paid search pressure." : "paid search is active in the category."}`
        : "Organic vs paid search split for acquisition angle.",
      sources: ["similarweb"],
      priority: "high",
    });
  }

  if (input.topSocialNetwork && input.topSocialShare != null) {
    insights.push({
      id: "social-driver",
      label: "Social traffic",
      value: `${input.topSocialNetwork} ${formatPct(input.topSocialShare, { fromFraction: true })}`,
      detail: "Where social referrals land — cross-check against your creative channel mix.",
      sources: ["similarweb"],
      priority: "medium",
    });
  }

  if (input.primaryTrafficSource && input.primaryTrafficShare != null) {
    insights.push({
      id: "traffic-source",
      label: "Primary source",
      value: `${input.primaryTrafficSource.replace(/_/g, " ")} ${formatPct(input.primaryTrafficShare, { fromFraction: true })}`,
      detail:
        input.primaryTrafficSource === "direct"
          ? "Strong direct traffic — brand pull is doing the heavy lifting."
          : "Acquisition-led traffic — creative and media matter more for share shifts.",
      sources: ["similarweb"],
      priority: "medium",
    });
  }

  if (input.similarCount > 0) {
    const affinityLabel =
      input.topSimilarAffinity != null ? `${Math.round(input.topSimilarAffinity * 100)}% overlap` : null;
    insights.push({
      id: "peer-set",
      label: "Closest rivals",
      value: `${input.similarCount} audience peers`,
      detail: input.topSimilar
        ? `Nearest rival: ${input.topSimilar}${affinityLabel ? ` (${affinityLabel})` : ""} — validate your watchlist.`
        : "Audience-overlap peers from observed market signals.",
      sources: ["similarweb"],
      priority: "high",
    });
  }

  if (input.paidSpend != null || input.creativeCount > 0) {
    const spendLabel = input.paidSpend != null ? formatCurrency(input.paidSpend) : "spend pending";
    insights.push({
      id: "paid-signal",
      label: "Paid creative",
      value: `${spendLabel} · ${input.creativeCount} placements`,
      detail: "Tracked ad placements — pair with visit trend for the pitch story.",
      sources: ["apify", "dataforseo"],
      priority: "medium",
    });
  }

  if (input.newsCount > 0) {
    insights.push({
      id: "news-momentum",
      label: "News momentum",
      value: `${input.newsCount} recent headlines`,
      detail: "Recent headlines — pair with visit spikes for timing the brief.",
      sources: ["newspi"],
      priority: "low",
    });
  }

  if (!insights.length) {
    insights.push({
      id: "awaiting-feeds",
      label: "Signal coverage",
      value: "Limited signals",
      detail: "Connect your API key in Settings and run a domain scan to populate channel and creative evidence.",
      sources: ["similarweb", "apify", "dataforseo"],
      priority: "low",
    });
  }

  return insights;
}

export type AggregateDomainIntelligenceOpts = {
  supabase: SupabaseClient;
  userId?: string | null;
  similarwebUserKey?: string | null;
  brandLabel?: string | null;
  persist?: boolean;
};

/** Merge Similarweb + Supabase (Apify/DataForSEO) + Newspi/news into one intelligence object. */
export async function aggregateDomainIntelligence(
  domainInput: string,
  opts: AggregateDomainIntelligenceOpts,
): Promise<DomainIntelligence> {
  const domain = normalizeDomain(domainInput);
  const sources = emptySources();
  const fetchedAt = new Date().toISOString();

  let traffic = null as DomainIntelligence["traffic"];
  let similarCompetitors: DomainIntelligence["similarCompetitors"] = [];
  let paidMedia: DomainIntelligence["paidMedia"] = null;
  let news: DomainIntelligence["news"] = [];
  let trendSignals: DomainIntelligence["trendSignals"] = [];

  const swConfig = resolveSimilarwebConfig({
    userKey: opts.similarwebUserKey,
    systemKey: process.env.SIMILARWEB_RAPIDAPI_KEY ?? process.env.RAPIDAPI_KEY,
  });

  if (swConfig) {
    try {
      const bundle = await fetchSimilarwebBundle(domain, swConfig);
      traffic = bundle.traffic;
      similarCompetitors = bundle.similarCompetitors;
      sources.similarweb = meta("ok");

      if (opts.persist && opts.userId) {
        const { data: latestScan } = await opts.supabase
          .from("domain_scans")
          .select("id, engine_output")
          .eq("user_id", opts.userId)
          .ilike("domain", `%${domain}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestScan?.id) {
          const prior =
            latestScan.engine_output && typeof latestScan.engine_output === "object"
              ? (latestScan.engine_output as Record<string, unknown>)
              : {};
          await opts.supabase
            .from("domain_scans")
            .update({
              engine_output: {
                ...prior,
                similarweb: bundle.raw,
                similarweb_fetched_at: fetchedAt,
              },
            })
            .eq("id", latestScan.id);
        }
      }
    } catch (err) {
      sources.similarweb = meta("error", err instanceof Error ? err.message.replace(/Similarweb/gi, "Market signals") : "Market signals unavailable");
    }
  } else {
    sources.similarweb = meta("skipped", "Market signals not connected — add API key in Settings");
  }

  try {
    const { paidMedia: pm, placementCount } = await loadPaidMediaFromSupabase(opts.supabase, domain, opts.userId);
    paidMedia = pm;
    const apifyCount = pm?.byPlatform.apify ?? 0;
    const dataforseoCount = pm?.byPlatform.dataforseo ?? 0;
    sources.apify = meta(placementCount > 0 && apifyCount > 0 ? "ok" : placementCount > 0 ? "empty" : "empty");
    sources.dataforseo = meta(
      placementCount > 0 && dataforseoCount > 0 ? "ok" : placementCount > 0 ? "empty" : "empty",
    );
    if (!placementCount && !pm?.estimatedMonthlySpend) {
      sources.apify = meta("empty", "No creative placements yet — run a scan");
      sources.dataforseo = meta("empty", "No channel placements yet — run a scan");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Supabase feed read failed";
    sources.apify = meta("error", msg);
    sources.dataforseo = meta("error", msg);
  }

  try {
    trendSignals = await loadTrendSignalsFromSupabase(opts.supabase, domain);
  } catch {
    /* non-fatal */
  }

  try {
    news = await fetchNewsFeed(domain, opts.brandLabel);
    sources.newspi = meta(news.length ? "ok" : "empty", news.length ? undefined : "No headlines returned");
  } catch (err) {
    sources.newspi = meta("error", err instanceof Error ? err.message : "News feed failed");
  }

  const insights = synthesizeInsights({
    domain,
    trafficVisits: traffic?.monthlyVisits ?? null,
    visitsChangePct: traffic?.visitsChangePct ?? null,
    category: traffic?.category ?? null,
    categoryRank: traffic?.categoryRank ?? null,
    categoryRankChange: traffic?.categoryRankChange ?? null,
    topCountry: traffic?.topCountry ?? null,
    topCountryShare: traffic?.topCountryShare ?? null,
    organicSearchShare: traffic?.organicSearchShare ?? null,
    paidSearchShare: traffic?.paidSearchShare ?? null,
    topSocialNetwork: traffic?.topSocialNetwork ?? null,
    topSocialShare: traffic?.topSocialShare ?? null,
    primaryTrafficSource: traffic?.primaryTrafficSource ?? null,
    primaryTrafficShare: traffic?.primaryTrafficShare ?? null,
    topKeywords: traffic?.topKeywords ?? [],
    similarCount: similarCompetitors.length,
    topSimilar: similarCompetitors[0]?.domain ?? null,
    topSimilarAffinity: similarCompetitors[0]?.affinity ?? null,
    paidSpend: paidMedia?.estimatedMonthlySpend ?? null,
    creativeCount: paidMedia?.creativeCount ?? 0,
    newsCount: news.length,
  });

  return {
    domain,
    brandLabel: opts.brandLabel ?? null,
    fetchedAt,
    traffic,
    similarCompetitors,
    paidMedia,
    news,
    trendSignals,
    insights,
    sources,
  };
}
