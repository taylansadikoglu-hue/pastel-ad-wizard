import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

export type MockScanInput = {
  domain: string;
  userId: string;
  agencyId: string;
  clientName?: string;
  category?: string;
  country?: string;
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function brandFromDomain(domain: string): string {
  const root = domain.split(".")[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

const MOCK_PLACEMENTS = [
  {
    channel: "Meta",
    channel_platform: "Facebook",
    ad_type: "Video",
    hook: "See why customers are switching this quarter.",
    headline: "The smarter choice for growth teams",
    days_running: 14,
    source_platform: "apify",
  },
  {
    channel: "Google",
    channel_platform: "Google Search",
    ad_type: "Text",
    hook: "Compare plans and save on annual billing.",
    headline: "Official site — limited offer",
    days_running: 21,
    source_platform: "dataforseo",
  },
  {
    channel: "YouTube",
    channel_platform: "YouTube",
    ad_type: "Video",
    hook: "Real results in 30 days — watch the case study.",
    headline: "Customer story spotlight",
    days_running: 9,
    source_platform: "dataforseo",
  },
  {
    channel: "Meta",
    channel_platform: "Instagram",
    ad_type: "Image",
    hook: "Built for teams that move fast.",
    headline: "Start your free trial",
    days_running: 6,
    source_platform: "apify",
  },
  {
    channel: "LinkedIn",
    channel_platform: "LinkedIn",
    ad_type: "Sponsored",
    hook: "Reach decision-makers with B2B creative that converts.",
    headline: "Lead with trust in professional channels",
    days_running: 18,
    source_platform: "adlibrary",
    emotional_driver: "Authority",
    offer_type: "Thought leadership",
    buyer_stage: "Consideration",
    primary_cta: "Learn more",
  },
] as const;

/**
 * Seeds domain_scans + ad_placements and ensures agency_watchlist membership.
 * Used by scripts/mock-scan-success.js and the Run Scan demo server function.
 */
export async function seedMockScanSuccess(
  supabase: AdminClient,
  input: MockScanInput,
): Promise<{ scan_id: number; placements: number }> {
  const domain = normalizeDomain(input.domain);
  if (!domain.includes(".")) {
    throw new Error("A valid full domain is required (e.g. commbank.com.au)");
  }

  const brand = brandFromDomain(domain);
  const now = new Date().toISOString();

  const { data: scan, error: scanErr } = await supabase
    .from("domain_scans")
    .insert({
      user_id: input.userId,
      domain,
      status: "completed",
      estimated_monthly_spend: 1_250_000,
      total_paid_keywords: 842,
      average_cpc: 4.2,
      engine_output: {
        source: "mock-scan-success",
        seeded_at: now,
        agency_id: input.agencyId,
      },
    })
    .select("id")
    .single();

  if (scanErr || !scan) {
    throw new Error(scanErr?.message ?? "Failed to create completed domain_scans row");
  }

  const placementRows = MOCK_PLACEMENTS.map((p, i) => ({
    scan_id: scan.id,
    domain,
    advertiser_name: brand,
    channel: p.channel,
    channel_platform: p.channel_platform,
    ad_type: p.ad_type,
    hook: p.hook,
    headline: p.headline,
    days_running: p.days_running,
    source_platform: p.source_platform,
    category: input.category ?? "General",
    first_seen: now,
    last_seen: now,
    times_seen: 120 + i * 37,
    emotional_driver: "emotional_driver" in p ? (p as { emotional_driver?: string }).emotional_driver ?? null : null,
    offer_type: "offer_type" in p ? (p as { offer_type?: string }).offer_type ?? null : null,
    buyer_stage: "buyer_stage" in p ? (p as { buyer_stage?: string }).buyer_stage ?? null : null,
    primary_cta: "primary_cta" in p ? (p as { primary_cta?: string }).primary_cta ?? null : null,
    ai_tags: {
      platform:
        p.source_platform === "adlibrary" && p.channel_platform === "LinkedIn"
          ? "linkedin"
          : p.source_platform === "apify"
            ? "meta"
            : "google",
      themes: ["trust", "value", "growth"].slice(0, 2 + (i % 2)),
      sentiment: i % 2 === 0 ? "positive" : "urgency",
      call_to_action: "Learn more",
    },
  }));

  const { data: placements, error: placementErr } = await supabase
    .from("ad_placements")
    .insert(placementRows)
    .select("id");

  if (placementErr) {
    throw new Error(placementErr.message);
  }

  const { data: existing } = await supabase
    .from("agency_watchlist")
    .select("id")
    .eq("agency_id", input.agencyId)
    .eq("domain", domain)
    .limit(1);

  if (!existing?.length) {
    await supabase.from("agency_watchlist").insert({
      agency_id: input.agencyId,
      domain,
      label: input.clientName ?? brand,
    });
  }

  return { scan_id: scan.id, placements: placements?.length ?? placementRows.length };
}
