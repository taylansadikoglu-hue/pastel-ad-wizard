import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { seedMockScanSuccess } from "@/lib/mock-scan";

const MockScanSchema = z.object({
  domain: z.string().min(3).max(255),
  category: z.string().max(120).optional(),
  country: z.string().max(80).optional(),
});

/**
 * Demo ingestion path when Apify/DataForSEO are slow or at limit.
 * Mirrors scripts/mock-scan-success.js for in-app "Run Scan" actions.
 */
export const runMockScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => MockScanSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("agency_id, agency_name")
      .eq("id", userId)
      .maybeSingle();

    let agencyId = profile?.agency_id ?? null;

    if (!agencyId) {
      const { data: agency, error: agencyErr } = await supabaseAdmin
        .from("agencies")
        .insert({ name: profile?.agency_name ?? "My Agency", owner_id: userId })
        .select("id")
        .single();
      if (agencyErr || !agency) {
        throw new Error(agencyErr?.message ?? "Failed to provision agency");
      }
      agencyId = agency.id;
      await supabaseAdmin.from("profiles").update({ agency_id: agencyId }).eq("id", userId);
    }

    const result = await seedMockScanSuccess(supabaseAdmin, {
      domain: data.domain,
      userId,
      agencyId,
      category: data.category,
      country: data.country,
    });

    return {
      ok: true as const,
      scan_id: result.scan_id,
      placements: result.placements,
      domain: data.domain,
      agency_id: agencyId,
    };
  });
