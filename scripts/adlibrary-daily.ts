#!/usr/bin/env npx tsx
/**
 * Daily AdLibrary pipeline — ingest + enrich (capped). Discovery is weekly.
 *
 * npm run adlibrary:daily -- --dry-run
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CreditTracker } from "./lib/adlibraryCredits.ts";
import { getSupabaseAdmin } from "./lib/supabaseAdmin.ts";
import { argBool, argNumber, parseArgs } from "./lib/parseArgs.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = argBool(args, "dryRun") || !process.env.ADLIBRARY_API_KEY;
  const daysBack = argNumber(args, "daysBack", 7);
  const limitAdvertisers = argNumber(args, "limitAdvertisers", 500);
  const limitAds = argNumber(args, "limitAds", 50);
  const enrichLimit = Math.min(
    argNumber(args, "enrichLimit", 200),
    Number(process.env.MAX_ADLIBRARY_ENRICHMENTS_PER_RUN ?? 200),
  );

  const startedAt = new Date();
  const runId = crypto.randomUUID();
  const tracker = new CreditTracker();
  const errors: string[] = [];

  let ingestResult: Record<string, unknown> = {};
  let enrichResult: Record<string, unknown> = {};

  try {
    ingestResult = await runJsonScript(join(__dirname, "adlibrary-ingest-top-advertisers.ts"), [
      ...(dryRun ? ["--dry-run"] : []),
      "--all",
      "--limit-advertisers",
      String(limitAdvertisers),
      "--limit-ads",
      String(limitAds),
      "--daysBack",
      String(daysBack),
      "--no-enrich",
    ]);

    enrichResult = await runJsonScript(join(__dirname, "adlibrary-enrich-new-ads.ts"), [
      ...(dryRun ? ["--dry-run"] : []),
      "--limit",
      String(enrichLimit),
    ]);
  } catch (e) {
    errors.push(String(e));
  }

  const finishedAt = new Date();
  const ingestCredits = (ingestResult.credits ?? {}) as { creditsUsed?: number; creditsRemaining?: number };
  const enrichCredits = (enrichResult.credits ?? {}) as { creditsUsed?: number; creditsRemaining?: number };
  const creditsUsed =
    Number(ingestCredits.creditsUsed ?? 0) + Number(enrichCredits.creditsUsed ?? 0);
  const creditsRemaining =
    enrichCredits.creditsRemaining ?? ingestCredits.creditsRemaining ?? tracker.remaining;

  const health = {
    run_id: runId,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    categories_scanned: 10,
    advertisers_scanned: Number(ingestResult.advertisersScanned ?? 0),
    ads_found: Number(ingestResult.adsFound ?? 0),
    ads_inserted: Number(ingestResult.inserted ?? 0),
    ads_updated: Number(ingestResult.updated ?? 0),
    enrichments_requested: Number(enrichResult.enrichmentCalls ?? 0),
    cache_hits: Number(enrichResult.cacheHits ?? 0),
    winners_scanned: 0,
    credits_used: creditsUsed,
    credits_remaining: creditsRemaining,
    errors: [
      ...errors,
      ...((ingestResult.errors as string[]) ?? []),
      ...((enrichResult.errors as string[]) ?? []),
    ],
    status: errors.length ? "partial" : "completed",
  };

  if (!dryRun) {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from("adlibrary_pipeline_runs").insert(health);
    } catch (e) {
      errors.push(`health log: ${String(e)}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        pipeline: "adlibrary:daily",
        dryRun,
        health,
        ingest: ingestResult,
        enrich: enrichResult,
        credits: tracker.summary(),
        nextRecommendedRun: "Run adlibrary:weekly-discovery on Mondays; winners pilot weekly.",
      },
      null,
      2,
    ),
  );
}

async function runJsonScript(script: string, scriptArgs: string[]): Promise<Record<string, unknown>> {
  const { spawn } = await import("node:child_process");
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", script, ...scriptArgs], {
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `exit ${code}`));
        return;
      }
      try {
        const json = extractLastJsonObject(stdout);
        resolve(json);
      } catch {
        resolve({ raw: stdout, stderr });
      }
    });
  });
}

function extractLastJsonObject(stdout: string): Record<string, unknown> {
  const marker = stdout.lastIndexOf('{\n  "status"');
  const start = marker >= 0 ? marker : stdout.lastIndexOf("{");
  if (start < 0) throw new Error("no json");
  return JSON.parse(stdout.slice(start)) as Record<string, unknown>;
}

main().catch((err) => {
  console.error(JSON.stringify({ status: "error", message: String(err) }, null, 2));
  process.exit(1);
});
