import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { aggregateDomainIntelligence } from "@/lib/feeds/aggregator";
import { normalizeDomain } from "@/lib/feeds/normalize-domain";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RequestSchema = z.object({
  domain: z.string().min(3).max(255),
  brandLabel: z.string().max(255).optional().nullable(),
  persist: z.boolean().optional().default(false),
});

function parseRequestInput(input: unknown) {
  let raw: unknown = input;
  if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    raw = (raw as Record<string, unknown>).data;
  }
  return RequestSchema.parse(raw);
}

export const loadDomainIntelligence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => parseRequestInput(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain = normalizeDomain(data.domain);
    if (!domain.includes(".")) throw new Error("A valid domain is required");

    const { data: integrations } = await supabase
      .from("integrations")
      .select("similarweb_rapidapi_key")
      .eq("user_id", userId)
      .maybeSingle();

    return aggregateDomainIntelligence(domain, {
      supabase,
      userId,
      similarwebUserKey: integrations?.similarweb_rapidapi_key ?? null,
      brandLabel: data.brandLabel ?? null,
      persist: data.persist ?? false,
    });
  });

export const refreshSimilarwebForScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const parsed = parseRequestInput(input);
    return { domain: parsed.domain, brandLabel: parsed.brandLabel };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const domain = normalizeDomain(data.domain);

    const { data: integrations } = await supabase
      .from("integrations")
      .select("similarweb_rapidapi_key")
      .eq("user_id", userId)
      .maybeSingle();

    const intel = await aggregateDomainIntelligence(domain, {
      supabase,
      userId,
      similarwebUserKey: integrations?.similarweb_rapidapi_key ?? null,
      brandLabel: data.brandLabel ?? null,
      persist: true,
    });

    if (intel.traffic?.monthlyVisits != null) {
      const { data: latestScan } = await supabase
        .from("domain_scans")
        .select("id")
        .eq("user_id", userId)
        .ilike("domain", `%${domain}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestScan?.id) {
        await supabase
          .from("domain_scans")
          .update({
            total_paid_keywords: intel.paidMedia?.totalKeywords ?? undefined,
            estimated_monthly_spend: intel.paidMedia?.estimatedMonthlySpend ?? undefined,
            average_cpc: intel.paidMedia?.averageCpc ?? undefined,
          })
          .eq("id", latestScan.id);
      }
    }

    return intel;
  });
