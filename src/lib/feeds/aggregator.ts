import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNewsFeed } from "./newspi";
import { formatCurrency, formatVisits, normalizeDomain } from "./normalize-domain";
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
  globalRank: number | null;
  category: string | null;
  categoryRank: number | null;
  topCountry: string | null;
  similarCount: number;
  topSimilar: string | null;
  topSimilarTitle: string | null;
  paidSpend: number | null;
  creativeCount: number;
  apifyCount: number;
  dataforseoCount: number;
  newsCount: number;
}): SynthesizedInsight[] {
  const insights: SynthesizedInsight[] = [];

  if (input.trafficVisits != null) {
    const rankParts = [
      input.globalRank != null ? `#${input.globalRank} global` : null,
      input.categoryRank != null ? `#${input.categoryRank} in category` : null,
      input.topCountry ? `top geo ${input.topCountry}` : null,
    ].filter(Boolean);
    insights.push({
      id: "traffic-weight",
      label: "Digital weight",
      value: `${formatVisits(input.trafficVisits)} monthly visits`,
      detail: [input.category, rankParts.join(" · ")].filter(Boolean).join(" — ") || "Similarweb traffic profile",
      sources: ["similarweb"],
      priority: "high",
    });
  }

  if (input.similarCount > 0) {
    const peerLabel = input.topSimilarTitle
      ? `${input.topSimilarTitle} (${input.topSimilar})`
      : input.topSimilar;
    insights.push({
      id: "peer-set",
      label: "Competitive peer set",
      value: `${input.similarCount} similar domains`,
      detail: peerLabel
        ? `Top peer by Similarweb overlap: ${peerLabel}. Add to client workspace competitors.`
        : "Audience-overlap peers from Similarweb Similar Sites.",
      sources: ["similarweb"],
      priority: "high",
    });
  }

  if (input.paidSpend != null || input.creativeCount > 0) {
    const spendLabel = input.paidSpend != null ? formatCurrency(input.paidSpend) : "spend pending";
    insights.push({
      id: "paid-signal",
      label: "Paid media signal",
      value: `${spendLabel} · ${input.creativeCount} tracked placements`,
      detail: `Apify ${input.apifyCount} · DataForSEO ${input.dataforseoCount} — cross-check channel mix against traffic scale.`,
      sources: ["apify", "dataforseo"],
      priority: "medium",
    });
  }

  if (input.trafficVisits != null && input.paidSpend != null && input.trafficVisits > 0) {
    const ratio = input.paidSpend / input.trafficVisits;
    insights.push({
      id: "spend-per-visit",
      label: "Spend intensity proxy",
      value: `$${ratio.toFixed(4)} est. spend per visit`,
      detail: "Heuristic: DataForSEO monthly spend ÷ Similarweb visits. High ratio may indicate heavy paid acquisition.",
      sources: ["similarweb", "dataforseo"],
      priority: "medium",
    });
  }

  if (input.newsCount > 0) {
    insights.push({
      id: "news-momentum",
      label: "News momentum",
      value: `${input.newsCount} recent headlines`,
      detail: "Newspi / Google News layer — pair with paid bursts for pitch narrative.",
      sources: ["newspi"],
      priority: "low",
    });
  }

  if (!insights.length) {
    insights.push({
      id: "awaiting-feeds",
      label: "Feed coverage",
      value: "Limited signals",
      detail: "Connect Similarweb RapidAPI key in Settings and run a domain scan for Apify/DataForSEO placements.",
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
      sources.similarweb = meta("error", err instanceof Error ? err.message : "Similarweb fetch failed");
    }
  } else {
    sources.similarweb = meta("skipped", "No RapidAPI key configured");
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
      sources.apify = meta("empty", "No Apify placements yet — run a scan");
      sources.dataforseo = meta("empty", "No DataForSEO placements yet — run a scan");
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
    globalRank: traffic?.globalRank ?? null,
    category: traffic?.category ?? null,
    categoryRank: traffic?.categoryRank ?? null,
    topCountry: traffic?.topCountry ?? null,
    similarCount: similarCompetitors.length,
    topSimilar: similarCompetitors[0]?.domain ?? null,
    topSimilarTitle: similarCompetitors[0]?.title ?? null,
    paidSpend: paidMedia?.estimatedMonthlySpend ?? null,
    creativeCount: paidMedia?.creativeCount ?? 0,
    apifyCount: paidMedia?.byPlatform.apify ?? 0,
    dataforseoCount: paidMedia?.byPlatform.dataforseo ?? 0,
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
