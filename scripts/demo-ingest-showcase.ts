#!/usr/bin/env npx tsx
/**
 * Ingest + enrich showcase demo advertisers (CommBank + Woolworths).
 *
 * npm run demo:ingest-showcase -- --domain woolworths.com.au --backfill
 * npm run demo:ingest-showcase -- --all
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  DEMO_SECOND_WORKSPACE_DOMAIN,
  DEMO_WORKSPACE_DOMAIN,
} from "../src/lib/demo-account.ts";
import { argBool, argString, parseArgs } from "./lib/parseArgs.ts";
import { hasAdlibraryKey, hasWritableSupabase } from "./lib/supabaseAdmin.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, "config/top-categories.json");

type SeedBrand = { name: string; domain: string; category: string };

function loadShowcaseBrands(): SeedBrand[] {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    categories: { name: string; seedBrands?: { name: string; domain: string }[] }[];
  };
  const byDomain = new Map<string, SeedBrand>();

  for (const cat of config.categories) {
    for (const brand of cat.seedBrands ?? []) {
      byDomain.set(brand.domain.toLowerCase(), {
        name: brand.name,
        domain: brand.domain,
        category: cat.name,
      });
    }
  }

  byDomain.set(DEMO_WORKSPACE_DOMAIN, {
    name: "CommBank",
    domain: DEMO_WORKSPACE_DOMAIN,
    category: byDomain.get(DEMO_WORKSPACE_DOMAIN)?.category ?? "Banking",
  });
  byDomain.set(DEMO_SECOND_WORKSPACE_DOMAIN, {
    name: "Woolworths",
    domain: DEMO_SECOND_WORKSPACE_DOMAIN,
    category: byDomain.get(DEMO_SECOND_WORKSPACE_DOMAIN)?.category ?? "Retail",
  });

  return [...byDomain.values()];
}

function runNpm(script: string, extraArgs: string[] = []): void {
  const res = spawnSync("npm", ["run", script, "--", ...extraArgs], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`npm run ${script} failed (exit ${res.status ?? 1})`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const domainFilter = argString(args, "domain");
  const all = argBool(args, "all");
  const backfill = argBool(args, "backfill") || true;
  const skipEnrich = argBool(args, "noEnrich");
  const dryRun = argBool(args, "dryRun");

  if (!hasAdlibraryKey() && !dryRun) {
    console.error(
      "\n❌ ADLIBRARY_API_KEY is required for showcase ingest.\n" +
        "   Set it in Seed server env or .env, then re-run.\n",
    );
    process.exit(1);
  }

  if (!hasWritableSupabase() && !dryRun) {
    console.error(
      "\n❌ Real SUPABASE_SERVICE_ROLE_KEY required (not sb_publishable_…).\n" +
        "   Ingest writes to ad_placements — run on Seed server with proper secrets.\n",
    );
    process.exit(1);
  }

  let brands = loadShowcaseBrands();
  if (!all && domainFilter) {
    brands = brands.filter(
      (b) =>
        b.domain.toLowerCase() === domainFilter.toLowerCase() ||
        b.domain.toLowerCase().includes(domainFilter.toLowerCase()),
    );
    if (!brands.length) {
      throw new Error(`Unknown showcase domain: ${domainFilter}`);
    }
  } else if (!all) {
    brands = brands.filter(
      (b) =>
        b.domain === DEMO_WORKSPACE_DOMAIN || b.domain === DEMO_SECOND_WORKSPACE_DOMAIN,
    );
  }

  console.log(`\nShowcase ingest — ${brands.length} brand(s)\n`);

  for (const brand of brands) {
    console.log(`\n── ${brand.name} (${brand.domain}) · ${brand.category} ──\n`);

    const ingestArgs = [
      "--advertiser",
      brand.name,
      "--category",
      brand.category,
      "--limit-ads",
      "80",
      "--limit-advertisers",
      "1",
    ];
    if (backfill) ingestArgs.push("--backfill");
    if (dryRun) ingestArgs.push("--dry-run");

    runNpm("adlibrary:ingest", ingestArgs);

    if (!skipEnrich && !dryRun) {
      runNpm("adlibrary:enrich", [
        "--advertiser",
        brand.name,
        "--category",
        brand.category,
        "--limit",
        "40",
      ]);
    }

    if (!dryRun && hasWritableSupabase()) {
      runNpm("data-quality:resolve-collisions", ["--domain", brand.domain]);
      runNpm("data-quality:merge-dupes", ["--domain", brand.domain]);
      runNpm("data-quality:sanitize-tags", ["--domain", brand.domain]);
    }
  }

  console.log("\n✅ Showcase ingest complete. Run: npm run data-quality:audit -- --domain <domain>\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
