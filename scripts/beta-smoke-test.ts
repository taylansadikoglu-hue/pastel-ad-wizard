#!/usr/bin/env npx tsx
/**
 * Beta demo smoke test — run before sending media beta invites.
 *
 * npm run beta:smoke-test
 * npm run beta:smoke-test -- --json
 */
import { createClient } from "@supabase/supabase-js";
import { fetchAdvertiserPlacements } from "../src/lib/advertiserPlacements.ts";
import {
  DEMO_SECOND_WORKSPACE_DOMAIN,
  DEMO_WORKSPACE_DOMAIN,
} from "../src/lib/demo-account.ts";
import { argBool, parseArgs } from "./lib/parseArgs.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";

const APP_URL = process.env.APP_URL ?? "https://revenuad.com";
const API_BASE = process.env.VITE_ENGINE_URL ?? "https://api.revenuad.com";

type Check = {
  name: string;
  ok: boolean;
  detail: string;
};

async function check(name: string, fn: () => Promise<string | void>): Promise<Check> {
  try {
    const detail = (await fn()) ?? "ok";
    return { name, ok: true, detail };
  } catch (err) {
    return { name, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function pad(label: string, width = 28): string {
  return label.padEnd(width);
}

async function main() {
  const args = parseArgs(process.argv);
  const jsonOut = argBool(args, "json");

  const supabase = getSupabaseAdmin();
  const anon = createClient(
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.SUPABASE_ANON_KEY!,
  );

  const showcase = [
    { brand: "CommBank", domain: DEMO_WORKSPACE_DOMAIN },
    { brand: "Woolworths", domain: DEMO_SECOND_WORKSPACE_DOMAIN },
  ];

  const checks: Check[] = [];

  checks.push(
    await check("revenuad.com loads", async () => {
      const res = await fetch(`${APP_URL}/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const sha = html.match(/data-commit-sha="([a-f0-9]+)"/)?.[1];
      return sha ? `HTTP ${res.status}, commit ${sha.slice(0, 7)}` : `HTTP ${res.status}`;
    }),
  );

  checks.push(
    await check("Auth page loads", async () => {
      const res = await fetch(`${APP_URL}/auth`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (!html.includes("beta@revenuad.com") && !html.includes("Explore live demo")) {
        throw new Error("Beta demo CTA not found on auth page");
      }
      return `HTTP ${res.status}`;
    }),
  );

  for (const { brand, domain } of showcase) {
    checks.push(
      await check(`${brand} warroom API`, async () => {
        const res = await fetch(`${API_BASE}/api/advertisers/${encodeURIComponent(brand)}/warroom`, {
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { total_ads?: number };
        return `total_ads=${data.total_ads ?? "?"}`;
      }),
    );

    checks.push(
      await check(`${brand} placements (deduped)`, async () => {
        const fetch = await fetchAdvertiserPlacements(supabase, domain);
        if (fetch.error) throw new Error(fetch.error);
        if (fetch.rows.length === 0) throw new Error("0 placement rows — demo will look empty");
        return `${fetch.rows.length} rows via ${fetch.source}`;
      }),
    );

    checks.push(
      await check(`${brand} fingerprint coverage`, async () => {
        const { data, error } = await supabase
          .from("ad_placements")
          .select("id, canonical_fingerprint")
          .ilike("domain", `%${domain.split(".")[0]}%`);
        if (error) throw new Error(error.message);
        const rows = data ?? [];
        if (rows.length === 0) throw new Error("0 ad_placements rows — run ingest for this domain");
        const missing = rows.filter((r) => !r.canonical_fingerprint).length;
        if (missing > 0) throw new Error(`${missing}/${rows.length} rows missing canonical_fingerprint`);
        return `${rows.length} rows, 100% fingerprinted`;
      }),
    );
  }

  checks.push(
    await check("Beta auth user exists", async () => {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return "skipped (no SUPABASE_SERVICE_ROLE_KEY)";
      }
      const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
      if (error) throw new Error(error.message);
      const beta = data.users.find((u) => u.email?.toLowerCase() === "beta@revenuad.com");
      if (!beta) throw new Error("beta@revenuad.com not found — run npm run beta:provision-demo");
      return `user ${beta.id.slice(0, 8)}…`;
    }),
  );

  checks.push(
    await check("Anon can read placements", async () => {
      const { data, error } = await anon
        .from("normalized_ad_placements")
        .select("id")
        .ilike("domain", `%commbank%`)
        .limit(1);
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("RLS blocked or no normalized rows");
      return "normalized_ad_placements readable";
    }),
  );

  const failed = checks.filter((c) => !c.ok);

  if (jsonOut) {
    console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
  } else {
    console.log(`\nBeta smoke test — ${APP_URL}\n`);
    console.log("┌────────────────────────────┬────────┬──────────────────────────────────────┐");
    console.log("│ Check                      │ Status │ Detail                               │");
    console.log("├────────────────────────────┼────────┼──────────────────────────────────────┤");
    for (const c of checks) {
      const status = c.ok ? "✅" : "❌";
      const line = `│ ${pad(c.name, 26)} │ ${status}     │ ${c.detail}`.slice(0, 88);
      console.log(`${line.padEnd(88)}│`);
    }
    console.log("└────────────────────────────┴────────┴──────────────────────────────────────┘\n");

    if (failed.length) {
      console.log(`❌ ${failed.length} check(s) failed — fix before sending beta invites.\n`);
    } else {
      console.log("✅ All checks passed — safe to run 15-min AM walkthrough (docs/beta-media-intro.md).\n");
    }
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
