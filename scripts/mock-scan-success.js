#!/usr/bin/env node
/**
 * Demo-mode scan seeder — populates domain_scans + ad_placements when Apify/DataForSEO
 * are slow or at limit. Keeps the dashboard functional for demos.
 *
 * Usage:
 *   set -a && . ./.env && set +a
 *   node scripts/mock-scan-success.js --domain commbank.com.au --agency-id <uuid> --user-id <uuid>
 */

import { createClient } from "@supabase/supabase-js";

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
];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function normalizeDomain(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function brandFromDomain(domain) {
  const root = domain.split(".")[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

async function seedMockScanSuccess(supabase, input) {
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
    ai_tags: {
      platform: p.source_platform === "apify" ? "meta" : "google",
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

async function main() {
  const args = parseArgs(process.argv);
  const domain = args.domain;
  const agencyId = String(args["agency-id"] ?? args.agencyId ?? "").trim();
  const userId = args["user-id"] ?? args.userId;

  if (!domain) {
    console.error("Missing required --domain (e.g. commbank.com.au)");
    process.exit(1);
  }
  if (!userId) {
    console.error("Missing required --user-id (Supabase auth.users UUID)");
    process.exit(1);
  }
  if (!agencyId) {
    console.error("Missing required --agency-id (agencies UUID)");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Run: set -a && . ./.env && set +a",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[mock-scan-success] Seeding ${domain} for agency_id=${agencyId}…`);

  const result = await seedMockScanSuccess(supabase, {
    domain: String(domain),
    userId: String(userId),
    agencyId,
    clientName: args["client-name"] ? String(args["client-name"]) : undefined,
    category: args.category ? String(args.category) : undefined,
    country: args.country ? String(args.country) : undefined,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        scan_id: result.scan_id,
        placements: result.placements,
        domain,
        agency_id: agencyId,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[mock-scan-success] failed:", err.message ?? err);
  process.exit(1);
});
