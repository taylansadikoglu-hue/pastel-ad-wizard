import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchCreativeProofForDomains } from "@/lib/evidence/fetch-creative-proof";
import { buildMarketSignalView } from "@/lib/evidence/market-signal";
import {
  buildCrossBrandComparison,
  type CrossBrandRow,
} from "@/lib/evidence/cross-brand";
import { filterCreativeProof, type CreativeProofCard } from "@/lib/evidence/creative-proof";
import { enrichDomainScanWithMarketSignals } from "@/lib/feeds/enrich-domain-scan";
import { normalizeDomain } from "@/lib/feeds/normalize-domain";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ThreatMetricSchema = z.object({
  domain: z.string(),
  creativeVolume: z.number().nullable().optional(),
  threatScore: z.number().nullable().optional(),
  demand: z.number().nullable().optional(),
});

const InputSchema = z.object({
  focusDomain: z.string().max(255).optional().nullable(),
  workspaceDomains: z.array(z.string()).max(12).optional().default([]),
  clientDomain: z.string().max(255).optional().nullable(),
  clientName: z.string().max(255).optional().nullable(),
  competitorDomains: z.array(z.string()).max(10).optional().default([]),
  threatMetrics: z.array(ThreatMetricSchema).max(12).optional().default([]),
});

export type EvidenceSupportBundle = {
  creatives: CreativeProofCard[];
  marketSignal: ReturnType<typeof buildMarketSignalView>;
  crossBrand: CrossBrandRow[];
};

async function fetchMatrixForDomains(supabase: SupabaseClient, domains: string[]) {
  const normalized = [...new Set(domains.map((d) => normalizeDomain(d)).filter((d) => d.includes(".")))];
  if (!normalized.length) return [];

  const { data } = await supabase
    .from("advertiser_matrix")
    .select("domain, est_monthly_spend, primary_channel")
    .in("domain", normalized);

  return (data ?? []).map((row) => ({
    domain: row.domain,
    estMonthlySpend: row.est_monthly_spend,
    primaryChannel: row.primary_channel,
  }));
}

export const loadEvidenceSupport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw =
      input && typeof input === "object" && "data" in (input as Record<string, unknown>)
        ? (input as Record<string, unknown>).data
        : input;
    return InputSchema.parse(raw);
  })
  .handler(async ({ data, context }): Promise<EvidenceSupportBundle> => {
    const { supabase, userId } = context;
    const workspaceDomains = [
      ...(data.clientDomain ? [normalizeDomain(data.clientDomain)] : []),
      ...data.competitorDomains.map((d) => normalizeDomain(d)),
      ...data.workspaceDomains.map((d) => normalizeDomain(d)),
    ].filter((d) => d.includes("."));

    const uniqueDomains = [...new Set(workspaceDomains)];
    const comparisonDomains = uniqueDomains.slice(0, 6);

    const allCreatives = await fetchCreativeProofForDomains(supabase, uniqueDomains);
    const focus = data.focusDomain ? normalizeDomain(data.focusDomain) : null;
    const creatives = filterCreativeProof(allCreatives, focus ?? uniqueDomains[0] ?? null, 6);

    const { data: integrations } = await supabase
      .from("integrations")
      .select("similarweb_rapidapi_key")
      .eq("user_id", userId)
      .maybeSingle();

    const swKey = integrations?.similarweb_rapidapi_key ?? null;

    const signalDomains = focus
      ? [focus, ...comparisonDomains.filter((d) => d !== focus)]
      : comparisonDomains;
    const uniqueSignalDomains = [...new Set(signalDomains)].slice(0, 5);

    const marketSignals: Record<string, ReturnType<typeof buildMarketSignalView>> = {};
    await Promise.all(
      uniqueSignalDomains.map(async (domain) => {
        try {
          const intel = await enrichDomainScanWithMarketSignals(supabase, {
            userId,
            domain,
            similarwebUserKey: swKey,
            persist: false,
          });
          marketSignals[normalizeDomain(domain)] = buildMarketSignalView(intel.traffic);
        } catch {
          marketSignals[normalizeDomain(domain)] = null;
        }
      }),
    );

    const focusKey = focus ? normalizeDomain(focus) : normalizeDomain(uniqueDomains[0] ?? "");
    const marketSignal = focusKey ? (marketSignals[focusKey] ?? null) : null;

    const matrixMetrics = await fetchMatrixForDomains(supabase, comparisonDomains);

    const crossBrand = buildCrossBrandComparison({
      clientDomain: data.clientDomain ? normalizeDomain(data.clientDomain) : null,
      clientName: data.clientName ?? null,
      competitorDomains: data.competitorDomains.map((d) => normalizeDomain(d)),
      focusDomain: focus,
      threatMetrics: data.threatMetrics,
      matrixMetrics,
      marketSignals,
      creatives: allCreatives,
    });

    return { creatives, marketSignal, crossBrand };
  });
