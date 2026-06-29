#!/usr/bin/env tsx
/**
 * Daily destination pipeline scheduler.
 *
 * 1. Meta ads ingestion → ad_placements + destination URLs
 * 2. Landing page enrichment (fetch HTML)
 * 3. OpenAI tagging (cached by url_hash)
 *
 * Usage:
 *   set -a && . ./.env && set +a
 *   npm run daily-scheduler -- --dry-run --brand commbank.com.au --limit 20
 *   npm run daily-scheduler
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFY_TOKEN, OPENAI_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { runMetaDailyIngestion } from "./lib/meta-daily-ingestion.js";
import { cliFlag, cliNumber, cliString, parseCliArgs } from "./lib/parse-cli-args";
import {
  enrichAndStoreDestination,
  isDestinationUrlTagged,
  tagAndStoreDestination,
} from "@/lib/advertiser-destinations";

const DEFAULT_LIMIT = Number(process.env.META_ADS_LIMIT ?? 40);

type TagCandidate = {
  advertiser: string;
  url: string;
  adCopy: string;
};

function uniqueTagCandidates(candidates: TagCandidate[]): TagCandidate[] {
  const seen = new Set<string>();
  const out: TagCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.advertiser}::${candidate.url.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}

async function runTaggingPass(
  supabase: ReturnType<typeof createClient>,
  candidates: TagCandidate[],
  dryRun: boolean,
): Promise<{ gpt_calls: number; tagged: number; cached: number; errors: string[] }> {
  let gptCalls = 0;
  let tagged = 0;
  let cached = 0;
  const errors: string[] = [];
  const seenUrl = new Set<string>();

  for (const candidate of candidates) {
    const urlKey = candidate.url.toLowerCase();
    if (seenUrl.has(urlKey)) continue;
    seenUrl.add(urlKey);

    try {
      if (dryRun) {
        const alreadyTagged = await isDestinationUrlTagged(supabase, candidate.url);
        if (alreadyTagged) {
          cached += 1;
        } else {
          gptCalls += 1;
        }
        continue;
      }

      try {
        await enrichAndStoreDestination(supabase, {
          advertiser: candidate.advertiser,
          url: candidate.url,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`enrich ${candidate.url}: ${message}`);
      }

      const result = await tagAndStoreDestination(supabase, {
        advertiser: candidate.advertiser,
        url: candidate.url,
        adCopy: candidate.adCopy,
      });

      if (result.cached) {
        cached += 1;
      } else {
        gptCalls += 1;
        tagged += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`tag ${candidate.url}: ${message}`);
    }
  }

  return { gpt_calls: gptCalls, tagged, cached, errors };
}

export async function runDailyScheduler(options: {
  dryRun?: boolean;
  brand?: string | null;
  limit?: number;
} = {}) {
  const started = Date.now();
  const dryRun = options.dryRun ?? false;
  const brand = options.brand ?? null;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const useFixture = dryRun && !process.env.APIFY_TOKEN;

  if (!useFixture && (!supabaseUrl || !serviceKey)) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  const ingest = await runMetaDailyIngestion({
    dryRun,
    brand,
    limit,
    supabase,
  });

  const tagCandidates = uniqueTagCandidates(
    ingest.brands.flatMap((b) => b.tag_candidates ?? []),
  );

  const uniqueUrls = new Set(tagCandidates.map((c) => c.url.toLowerCase()));

  const tagging =
    tagCandidates.length && supabase
      ? await runTaggingPass(supabase, tagCandidates, dryRun)
      : dryRun && tagCandidates.length
        ? {
            gpt_calls: uniqueUrls.size,
            tagged: 0,
            cached: 0,
            errors: [] as string[],
          }
        : { gpt_calls: 0, tagged: 0, cached: 0, errors: [] as string[] };

  const adsInserted = dryRun
    ? ingest.totals.placements_inserted +
      ingest.brands.reduce((s, b) => s + (b.placements.would_insert ?? 0), 0)
    : ingest.totals.placements_inserted;

  const adsUpdated = dryRun
    ? ingest.totals.placements_updated +
      ingest.brands.reduce((s, b) => s + (b.placements.would_update ?? 0), 0)
    : ingest.totals.placements_updated;

  const durationMs = Date.now() - started;
  const errors = [...ingest.errors, ...tagging.errors];

  return {
    ok: errors.length === 0,
    dry_run: dryRun,
    brand: brand ?? "all",
    limit,
    ads_inserted: adsInserted,
    ads_updated: adsUpdated,
    gpt_calls: tagging.gpt_calls,
    destinations_tagged: tagging.tagged,
    destinations_cached: tagging.cached,
    duration_ms: durationMs,
    brands_processed: ingest.brands_processed,
    tag_candidates: tagCandidates.length,
    errors,
  };
}

async function main() {
  const args = parseCliArgs(process.argv);
  const dryRun = cliFlag(args, "dry-run", "dryRun");
  const brand = cliString(args, "brand", "domain");
  const limit = cliNumber(args, DEFAULT_LIMIT, "limit");

  console.log(
    `[daily-scheduler] starting dry_run=${dryRun} brand=${brand ?? "all"} limit=${limit}`,
  );

  try {
    const summary = await runDailyScheduler({ dryRun, brand, limit });
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.ok ? 0 : 1);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[daily-scheduler] failed:", message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
