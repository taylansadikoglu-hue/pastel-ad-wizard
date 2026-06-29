import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateDomainIntelligence } from "@/lib/feeds/aggregator";
import { normalizeDomain } from "@/lib/feeds/normalize-domain";
import type { DomainIntelligence } from "@/lib/feeds/types";

async function loadUserSimilarwebKey(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("integrations")
    .select("similarweb_rapidapi_key")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.similarweb_rapidapi_key ?? null;
}

/** Fetch Similar Web angles and optionally persist on the latest domain_scans row. */
export async function enrichDomainScanWithMarketSignals(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    domain: string;
    brandLabel?: string | null;
    similarwebUserKey?: string | null;
    persist?: boolean;
  },
): Promise<DomainIntelligence> {
  const domain = normalizeDomain(opts.domain);
  const userKey =
    opts.similarwebUserKey !== undefined
      ? opts.similarwebUserKey
      : await loadUserSimilarwebKey(supabase, opts.userId);

  return aggregateDomainIntelligence(domain, {
    supabase,
    userId: opts.userId,
    similarwebUserKey: userKey,
    brandLabel: opts.brandLabel ?? null,
    persist: opts.persist ?? true,
  });
}
