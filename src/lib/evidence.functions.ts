import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchCreativeProofForDomains } from "@/lib/evidence/fetch-creative-proof";
import { buildMarketSignalView } from "@/lib/evidence/market-signal";
import { filterCreativeProof, type CreativeProofCard } from "@/lib/evidence/creative-proof";
import { enrichDomainScanWithMarketSignals } from "@/lib/feeds/enrich-domain-scan";
import { normalizeDomain } from "@/lib/feeds/normalize-domain";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  focusDomain: z.string().max(255).optional().nullable(),
  workspaceDomains: z.array(z.string()).max(12).optional().default([]),
});

export type EvidenceSupportBundle = {
  creatives: CreativeProofCard[];
  marketSignal: ReturnType<typeof buildMarketSignalView>;
};

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
    const domains = [
      ...(data.focusDomain ? [normalizeDomain(data.focusDomain)] : []),
      ...data.workspaceDomains.map((d) => normalizeDomain(d)),
    ].filter((d) => d.includes("."));

    const uniqueDomains = [...new Set(domains)];
    const allCreatives = await fetchCreativeProofForDomains(supabase, uniqueDomains);
    const focus = data.focusDomain ? normalizeDomain(data.focusDomain) : null;
    const creatives = filterCreativeProof(allCreatives, focus ?? uniqueDomains[0] ?? null, 6);

    let marketSignal = null;
    const signalDomain = focus ?? uniqueDomains[0];
    if (signalDomain) {
      try {
        const { data: integrations } = await supabase
          .from("integrations")
          .select("similarweb_rapidapi_key")
          .eq("user_id", userId)
          .maybeSingle();

        const intel = await enrichDomainScanWithMarketSignals(supabase, {
          userId,
          domain: signalDomain,
          similarwebUserKey: integrations?.similarweb_rapidapi_key ?? null,
          persist: false,
        });
        marketSignal = buildMarketSignalView(intel.traffic);
      } catch {
        marketSignal = null;
      }
    }

    return { creatives, marketSignal };
  });
