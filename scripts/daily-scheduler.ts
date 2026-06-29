#!/usr/bin/env tsx
/**
 * Daily destination pipeline scheduler.
 *
 * 1. Meta ads ingestion → ad_placements + destination URLs
 * 2. Landing page enrichment (fetch HTML)
 * 3. OpenAI tagging (new URLs + URLs tagged >30 days ago)
 *
 * Usage:
 *   set -a && . ./.env && set +a
 *   npm run daily-scheduler -- --dry-run --brand commbank.com.au --limit 20
 *   npm run daily-scheduler
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFY_TOKEN, OPENAI_API_KEY
 *   MAX_GPT_CALLS_PER_RUN (default 50)
 *   TAG_RETAG_DAYS (default 30)
 */

import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { runMetaDailyIngestion } from "./lib/meta-daily-ingestion.js";
import { cliFlag, cliNumber, cliString, parseCliArgs } from "./lib/parse-cli-args";
import {
  isAustraliaSydneySevenAm,
  SCHEDULER_TIMEZONE,
  sydneyLocalTimestamp,
} from "./lib/sydney-schedule";
import {
  enrichAndStoreDestination,
  getDestinationTagCacheStatus,
  tagAndStoreDestination,
  TAG_RETAG_DAYS,
} from "@/lib/advertiser-destinations";

const DEFAULT_LIMIT = Number(process.env.META_ADS_LIMIT ?? 40);
const MAX_GPT_CALLS_PER_RUN = Number(process.env.MAX_GPT_CALLS_PER_RUN ?? 50);

export type DailySchedulerSummary = {
  ok: boolean;
  dry_run: boolean;
  brand: string;
  limit: number;
  ads_inserted: number;
  ads_updated: number;
  destinations_extracted: number;
  gpt_calls: number;
  cache_hits: number;
  errors: number;
  duration_ms: number;
  started_at: string;
  finished_at: string;
  scheduler_timezone: string;
  sydney_local_time: string;
  max_gpt_calls_per_run: number;
  gpt_calls_capped: number;
  tag_retag_days: number;
  brands_processed: number;
  tag_candidates: number;
  error_messages: string[];
  skipped?: boolean;
  skip_reason?: string | null;
};

type TagCandidate = {
  advertiser: string;
  url: string;
  adCopy: string;
};

type TaggingPassResult = {
  gpt_calls: number;
  cache_hits: number;
  destinations_extracted: number;
  gpt_calls_capped: number;
  errors: string[];
};

function uniqueTagCandidates(candidates: TagCandidate[]): TagCandidate[] {
  const seen = new Set<string>();
  const out: TagCandidate[] = [];
  for (const candidate of candidates) {
    const key = candidate.url.toLowerCase();
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
): Promise<TaggingPassResult> {
  let gptCalls = 0;
  let cacheHits = 0;
  let destinationsExtracted = 0;
  let gptCallsCapped = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      if (!dryRun) {
        try {
          await enrichAndStoreDestination(supabase, {
            advertiser: candidate.advertiser,
            url: candidate.url,
          });
          destinationsExtracted += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push(`enrich ${candidate.url}: ${message}`);
        }
      } else {
        destinationsExtracted += 1;
      }

      const { status } = await getDestinationTagCacheStatus(supabase, candidate.url);
      if (status === "fresh") {
        if (!dryRun) {
          await tagAndStoreDestination(supabase, {
            advertiser: candidate.advertiser,
            url: candidate.url,
            adCopy: candidate.adCopy,
          });
        }
        cacheHits += 1;
        continue;
      }

      if (gptCalls >= MAX_GPT_CALLS_PER_RUN) {
        gptCallsCapped += 1;
        continue;
      }

      if (dryRun) {
        gptCalls += 1;
        continue;
      }

      const result = await tagAndStoreDestination(supabase, {
        advertiser: candidate.advertiser,
        url: candidate.url,
        adCopy: candidate.adCopy,
      });

      if (result.gpt_called) {
        gptCalls += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`tag ${candidate.url}: ${message}`);
    }
  }

  return {
    gpt_calls: gptCalls,
    cache_hits: cacheHits,
    destinations_extracted: destinationsExtracted,
    gpt_calls_capped: gptCallsCapped,
    errors,
  };
}

async function estimateDryRunTagging(
  supabase: ReturnType<typeof createClient> | null,
  candidates: TagCandidate[],
): Promise<TaggingPassResult> {
  let gptCalls = 0;
  let cacheHits = 0;
  let gptCallsCapped = 0;
  const destinationsExtracted = candidates.length;

  for (const candidate of candidates) {
    let status: "new" | "fresh" | "stale" = "new";
    if (supabase) {
      ({ status } = await getDestinationTagCacheStatus(supabase, candidate.url));
    }

    if (status === "fresh") {
      cacheHits += 1;
      continue;
    }

    if (gptCalls >= MAX_GPT_CALLS_PER_RUN) {
      gptCallsCapped += 1;
      continue;
    }

    gptCalls += 1;
  }

  return {
    gpt_calls: gptCalls,
    cache_hits: cacheHits,
    destinations_extracted: destinationsExtracted,
    gpt_calls_capped: gptCallsCapped,
    errors: [],
  };
}

export async function runDailyScheduler(options: {
  dryRun?: boolean;
  brand?: string | null;
  limit?: number;
  /** When true, exit early unless Australia/Sydney local hour is 07. */
  scheduled?: boolean;
} = {}): Promise<DailySchedulerSummary> {
  const startedAt = new Date();
  const startedMs = startedAt.getTime();

  if (options.scheduled && !isAustraliaSydneySevenAm(startedAt)) {
    const finishedAt = new Date();
    return {
      ok: true,
      dry_run: options.dryRun ?? false,
      brand: options.brand ?? "all",
      limit: options.limit ?? DEFAULT_LIMIT,
      ads_inserted: 0,
      ads_updated: 0,
      destinations_extracted: 0,
      gpt_calls: 0,
      cache_hits: 0,
      errors: 0,
      duration_ms: Date.now() - startedMs,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      scheduler_timezone: SCHEDULER_TIMEZONE,
      sydney_local_time: sydneyLocalTimestamp(startedAt),
      max_gpt_calls_per_run: MAX_GPT_CALLS_PER_RUN,
      gpt_calls_capped: 0,
      tag_retag_days: TAG_RETAG_DAYS,
      brands_processed: 0,
      tag_candidates: 0,
      error_messages: [],
      skipped: true,
      skip_reason: `not 7am in ${SCHEDULER_TIMEZONE} (local ${sydneyLocalTimestamp(startedAt)})`,
    };
  }

  const dryRun = options.dryRun ?? false;
  const brand = options.brand ?? null;
  const limit = options.limit ?? DEFAULT_LIMIT;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!dryRun && (!supabaseUrl || !serviceKey)) {
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

  const tagging =
    tagCandidates.length && supabase
      ? await runTaggingPass(supabase, tagCandidates, dryRun)
      : tagCandidates.length
        ? await estimateDryRunTagging(supabase, tagCandidates)
        : {
            gpt_calls: 0,
            cache_hits: 0,
            destinations_extracted: 0,
            gpt_calls_capped: 0,
            errors: [] as string[],
          };

  const adsInserted = dryRun
    ? ingest.totals.placements_inserted +
      ingest.brands.reduce((s, b) => s + (b.placements.would_insert ?? 0), 0)
    : ingest.totals.placements_inserted;

  const adsUpdated = dryRun
    ? ingest.totals.placements_updated +
      ingest.brands.reduce((s, b) => s + (b.placements.would_update ?? 0), 0)
    : ingest.totals.placements_updated;

  const finishedAt = new Date();
  const errorMessages = [...ingest.errors, ...tagging.errors];

  return {
    ok: errorMessages.length === 0,
    dry_run: dryRun,
    brand: brand ?? "all",
    limit,
    ads_inserted: adsInserted,
    ads_updated: adsUpdated,
    destinations_extracted: tagging.destinations_extracted,
    gpt_calls: tagging.gpt_calls,
    cache_hits: tagging.cache_hits,
    errors: errorMessages.length,
    duration_ms: finishedAt.getTime() - startedMs,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    scheduler_timezone: SCHEDULER_TIMEZONE,
    sydney_local_time: sydneyLocalTimestamp(finishedAt),
    max_gpt_calls_per_run: MAX_GPT_CALLS_PER_RUN,
    gpt_calls_capped: tagging.gpt_calls_capped,
    tag_retag_days: TAG_RETAG_DAYS,
    brands_processed: ingest.brands_processed,
    tag_candidates: tagCandidates.length,
    error_messages: errorMessages,
  };
}

async function main() {
  const args = parseCliArgs(process.argv);
  const dryRun = cliFlag(args, "dry-run", "dryRun");
  const brand = cliString(args, "brand", "domain");
  const limit = cliNumber(args, DEFAULT_LIMIT, "limit");
  const scheduled = cliFlag(args, "scheduled");

  console.log(
    `[daily-scheduler] starting dry_run=${dryRun} brand=${brand ?? "all"} limit=${limit} scheduled=${scheduled}`,
  );

  try {
    const summary = await runDailyScheduler({ dryRun, brand, limit, scheduled });
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
