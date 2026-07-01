#!/usr/bin/env npx tsx
/**
 * Data perfection pipeline — run all ingest, dedup, enrich, and audit steps for beta demo.
 *
 * npm run data:perfection
 * npm run data:perfection -- --domain commbank.com.au
 * npm run data:perfection -- --audit-only
 *
 * Requires on Seed server:
 *   ADLIBRARY_API_KEY, SUPABASE_SERVICE_ROLE_KEY (real service_role, not publishable)
 */
import { spawnSync } from "node:child_process";
import {
  DEMO_SECOND_WORKSPACE_DOMAIN,
  DEMO_WORKSPACE_DOMAIN,
} from "../src/lib/demo-account.ts";
import { argBool, argString, parseArgs } from "./lib/parseArgs.ts";
import {
  getSupabaseRead,
  hasAdlibraryKey,
  hasWritableSupabase,
} from "./lib/supabaseAdmin.ts";

type PhaseResult = { phase: string; ok: boolean; detail: string; skipped?: boolean };

function run(cmd: string, args: string[]): { ok: boolean; detail: string } {
  const res = spawnSync(cmd, args, { stdio: "pipe", env: process.env, encoding: "utf8" });
  const detail = (res.stderr || res.stdout || "").trim().split("\n").slice(-3).join(" · ");
  return { ok: res.status === 0, detail: detail || `exit ${res.status ?? 1}` };
}

function npmRun(script: string, extra: string[] = []): { ok: boolean; detail: string } {
  return run("npm", ["run", script, "--", ...extra]);
}

async function countNormalized(domain: string): Promise<number> {
  const sb = getSupabaseRead();
  const root = domain.split(".")[0] ?? domain;
  const { count } = await sb
    .from("normalized_ad_placements")
    .select("id", { count: "exact", head: true })
    .or(`domain.ilike.%${root}%,domain.ilike.%${domain}%`);
  return count ?? 0;
}

async function main() {
  const args = parseArgs(process.argv);
  const domain = argString(args, "domain");
  const auditOnly = argBool(args, "auditOnly");
  const skipIngest = argBool(args, "skipIngest");
  const jsonOut = argBool(args, "json");

  const showcaseDomains = domain
    ? [domain]
    : [DEMO_WORKSPACE_DOMAIN, DEMO_SECOND_WORKSPACE_DOMAIN];

  const phases: PhaseResult[] = [];

  phases.push({
    phase: "Preflight",
    ok: true,
    detail: [
      `writable_supabase=${hasWritableSupabase()}`,
      `adlibrary=${hasAdlibraryKey()}`,
      `domains=${showcaseDomains.join(", ")}`,
    ].join(" · "),
  });

  if (!auditOnly && !skipIngest) {
    if (!hasAdlibraryKey() || !hasWritableSupabase()) {
      phases.push({
        phase: "Ingest showcase",
        ok: false,
        skipped: true,
        detail:
          "Skipped — need ADLIBRARY_API_KEY + real SUPABASE_SERVICE_ROLE_KEY on Seed server. " +
          "Run: ssh seed@37.27.0.36 → cd /opt/revenuad && npm run data:perfection",
      });
    } else {
      for (const d of showcaseDomains) {
        const ingest = npmRun("demo:ingest-showcase", ["--domain", d, "--backfill"]);
        phases.push({
          phase: `Ingest ${d}`,
          ok: ingest.ok,
          detail: ingest.detail,
        });
      }
    }
  }

  for (const d of showcaseDomains) {
    const before = await countNormalized(d);

    if (!auditOnly && hasWritableSupabase()) {
      const collision = npmRun("data-quality:resolve-collisions", ["--domain", d]);
      phases.push({ phase: `Collisions ${d}`, ok: collision.ok, detail: collision.detail });

      const merge = npmRun("data-quality:merge-dupes", ["--domain", d]);
      phases.push({ phase: `Merge dupes ${d}`, ok: merge.ok, detail: merge.detail });
    }

    const audit = npmRun("data-quality:audit", ["--domain", d]);
    const after = await countNormalized(d);
    phases.push({
      phase: `Audit ${d}`,
      ok: audit.ok,
      detail: `${audit.detail} · normalized=${after} (was ${before})`,
    });
  }

  const smoke = npmRun("beta:smoke-test");
  phases.push({ phase: "Beta smoke test", ok: smoke.ok, detail: smoke.detail });

  const failed = phases.filter((p) => !p.ok && !p.skipped);

  if (jsonOut) {
    console.log(JSON.stringify({ ok: failed.length === 0, phases }, null, 2));
  } else {
    console.log("\n═══ Data perfection pipeline ═══\n");
    for (const p of phases) {
      const icon = p.skipped ? "⏭" : p.ok ? "✅" : "❌";
      console.log(`${icon} ${p.phase}`);
      console.log(`   ${p.detail}\n`);
    }
    if (failed.length) {
      console.log(`❌ ${failed.length} phase(s) need attention.\n`);
    } else {
      console.log("✅ Pipeline complete — review audit warnings, then Publish in Lovable.\n");
    }
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
