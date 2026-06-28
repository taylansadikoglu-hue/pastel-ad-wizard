import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeDomain, rootToken } from "./normalize-domain";
import type { PaidMediaSnapshot } from "./types";

type PlacementRow = {
  source_platform: string | null;
  channel: string | null;
  channel_platform: string | null;
  times_seen: number | null;
};

export async function loadPaidMediaFromSupabase(
  supabase: SupabaseClient,
  domain: string,
  userId?: string | null,
): Promise<{ paidMedia: PaidMediaSnapshot | null; placementCount: number }> {
  const normalized = normalizeDomain(domain);
  const root = rootToken(normalized);

  let scanQuery = supabase
    .from("domain_scans")
    .select("estimated_monthly_spend, total_paid_keywords, average_cpc, engine_output")
    .ilike("domain", `%${root}%`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (userId) scanQuery = scanQuery.eq("user_id", userId);

  const { data: scans } = await scanQuery;
  const scan = scans?.[0] ?? null;

  const { data: placements } = await supabase
    .from("ad_placements")
    .select("source_platform, channel, channel_platform, times_seen")
    .or(`domain.ilike.%${normalized}%,domain.ilike.%${root}%`)
    .limit(500);

  const rows = (placements ?? []) as PlacementRow[];
  const byPlatform: Record<string, number> = {};

  for (const row of rows) {
    const platform = (row.source_platform ?? row.channel_platform ?? row.channel ?? "unknown").toLowerCase();
    const key =
      platform.includes("meta") || platform === "apify"
        ? "apify"
        : platform.includes("google") || platform.includes("youtube") || platform === "dataforseo"
          ? "dataforseo"
          : platform;
    byPlatform[key] = (byPlatform[key] ?? 0) + (Number(row.times_seen) || 1);
  }

  if (!scan && rows.length === 0) {
    return { paidMedia: null, placementCount: 0 };
  }

  const paidMedia: PaidMediaSnapshot = {
    estimatedMonthlySpend: scan?.estimated_monthly_spend != null ? Number(scan.estimated_monthly_spend) : null,
    totalKeywords: scan?.total_paid_keywords != null ? Number(scan.total_paid_keywords) : null,
    averageCpc: scan?.average_cpc != null ? Number(scan.average_cpc) : null,
    creativeCount: rows.length,
    byPlatform,
  };

  return { paidMedia, placementCount: rows.length };
}

export async function loadTrendSignalsFromSupabase(
  supabase: SupabaseClient,
  domain: string,
): Promise<{ keyword: string; score: number; source: string; date: string | null }[]> {
  const normalized = normalizeDomain(domain);
  const { data } = await supabase
    .from("trend_signals")
    .select("keyword, interest_score, source, trend_date")
    .ilike("brand_domain", `%${normalized}%`)
    .order("interest_score", { ascending: false })
    .limit(8);

  return (data ?? []).map((row) => ({
    keyword: row.keyword,
    score: Number(row.interest_score) || 0,
    source: row.source ?? "trend_signals",
    date: row.trend_date ?? null,
  }));
}
