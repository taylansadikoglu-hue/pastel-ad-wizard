#!/usr/bin/env node
/**
 * Daily Meta (Facebook / Instagram) ads ingestion.
 *
 * Pulls ads via Apify Meta Ads Library, upserts ad_placements, and persists
 * landing URLs into advertiser_destinations (destination intelligence catalog).
 *
 * No OpenAI. No new tables.
 *
 * Usage:
 *   set -a && . ./.env && set +a
 *   node sources/meta-daily-ingestion.js --dry-run --brand commbank.com.au
 *   node sources/meta-daily-ingestion.js --brand commbank.com.au
 *   node sources/meta-daily-ingestion.js
 *
 * Env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — required (except fixture dry-run)
 *   APIFY_TOKEN — required for live pulls (optional with --dry-run + fixture)
 *   APIFY_META_ACTOR — default curious_coder~facebook-ads-scraper
 *   META_ADS_COUNTRY — default AU
 *   META_ADS_LIMIT — default 40 per brand
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const DEFAULT_ACTOR = "curious_coder~facebook-ads-scraper";
const DEFAULT_COUNTRY = process.env.META_ADS_COUNTRY ?? "AU";
const DEFAULT_LIMIT = Number(process.env.META_ADS_LIMIT ?? 40);

/** Minimal fixture for --dry-run when APIFY_TOKEN is unset. */
const FIXTURE_ADS = [
  {
    id: "meta-fixture-001",
    pageName: "CommBank",
    advertiserName: "CommBank",
    adCreativeBody: "Home loans from 5.99% p.a. comparison rate. Apply online today.",
    linkUrl: "https://www.commbank.com.au/home-loans",
    ctaText: "Learn more",
    publisherPlatform: "facebook",
    adType: "image",
    startDate: "2026-06-01",
    daysRunning: 18,
    pageProfilePictureUrl: null,
    images: ["https://example.com/creative-1.jpg"],
  },
  {
    id: "meta-fixture-002",
    pageName: "CommBank",
    advertiserName: "CommBank",
    adCreativeBody: "Award-winning business banking for growing teams.",
    linkUrl: "https://www.commbank.com.au/business",
    ctaText: "Sign up",
    publisherPlatform: "instagram",
    adType: "video",
    startDate: "2026-06-10",
    daysRunning: 9,
    pageProfilePictureUrl: null,
    images: [],
  },
];

function parseArgs(argv) {
  const out = { dryRun: false };
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

function normalizeDomain(raw) {
  return String(raw ?? "")
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

function firstString(...values) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizeDestinationUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("{{")) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProtocol);
    if (!u.hostname || u.hostname === "localhost") return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function destinationHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? url;
  }
}

function destinationUrlHash(url) {
  return normalizeDestinationUrl(url)?.toLowerCase() ?? url.toLowerCase();
}

function creativeHash(ad) {
  const key = firstString(
    ad.id,
    ad.adArchiveID,
    ad.ad_archive_id,
    ad.adId,
    ad.creativeId,
  );
  if (key) return `meta:${key}`;
  const blob = JSON.stringify({
    body: firstString(ad.adCreativeBody, ad.body, ad.snapshot?.body?.text, ad.headline),
    url: firstString(ad.linkUrl, ad.landingPageUrl, ad.destinationUrl, ad.link_url),
    image: ad.images?.[0] ?? ad.videos?.[0] ?? null,
  });
  return `meta:${createHash("sha256").update(blob).digest("hex").slice(0, 24)}`;
}

function mapApifyAd(raw, domain) {
  const advertiser = firstString(raw.pageName, raw.advertiserName, raw.page_name, brandFromDomain(domain));
  const body = firstString(
    raw.adCreativeBody,
    raw.body,
    raw.snapshot?.body?.text,
    raw.ad_creative_bodies?.[0],
    raw.description,
  );
  const headline = firstString(raw.headline, raw.title, raw.adCreativeLinkTitle, raw.snapshot?.title);
  const landingUrl = normalizeDestinationUrl(
    firstString(raw.linkUrl, raw.landingPageUrl, raw.destinationUrl, raw.link_url, raw.snapshot?.link_url),
  );
  const platform = firstString(raw.publisherPlatform, raw.platform, raw.publisher_platform, "facebook");
  const channelPlatform =
    platform.toLowerCase().includes("insta") ? "Instagram" : platform.toLowerCase().includes("facebook") ? "Facebook" : "Meta";

  const now = new Date().toISOString();
  const hash = creativeHash(raw);

  return {
    domain,
    advertiser_name: advertiser,
    channel: "Meta",
    channel_platform: channelPlatform,
    ad_type: firstString(raw.adType, raw.display_format, raw.media_type, "Unknown"),
    hook: body,
    headline,
    description: body,
    landing_url: landingUrl,
    primary_cta: firstString(raw.ctaText, raw.cta_text, raw.callToAction),
    creative_url: firstString(raw.images?.[0], raw.videos?.[0], raw.snapshot?.images?.[0], raw.pageProfilePictureUrl),
    source_platform: "apify",
    source_archive_url: firstString(raw.adLibraryUrl, raw.ad_library_url, raw.url),
    days_running: Number(raw.daysRunning ?? raw.days_running ?? raw.days_active) || null,
    first_seen: raw.startDate ?? raw.start_date ?? now,
    last_seen: raw.endDate ?? raw.end_date ?? now,
    times_seen: 1,
    creative_hash: hash,
    raw,
  };
}

async function fetchMetaAdsFromApify({ brand, apifyToken, actorId, country, limit }) {
  const actor = actorId || DEFAULT_ACTOR;
  const searchTerm = brandFromDomain(brand);
  const input = {
    searchTerms: [searchTerm, brand],
    urls: [`https://www.facebook.com/${searchTerm.toLowerCase()}`],
    countryCode: country,
    maxResults: limit,
    maxAds: limit,
    limit,
  };

  const url = new URL(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items`);
  url.searchParams.set("token", apifyToken);
  url.searchParams.set("timeout", "300");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actor} failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Apify ${actor} returned non-array payload`);
  }
  return data;
}

async function loadTargetBrands(supabase, singleBrand) {
  if (singleBrand) {
    const domain = normalizeDomain(singleBrand);
    return [{ domain, label: brandFromDomain(domain) }];
  }

  const brands = new Map();

  const { data: watchlist, error: watchErr } = await supabase
    .from("agency_watchlist")
    .select("domain, label");

  if (watchErr) throw new Error(`agency_watchlist: ${watchErr.message}`);
  for (const row of watchlist ?? []) {
    const domain = normalizeDomain(row.domain);
    if (!domain) continue;
    brands.set(domain, { domain, label: row.label ?? brandFromDomain(domain) });
  }

  const { data: coverage, error: covErr } = await supabase
    .from("advertiser_coverage")
    .select("domain")
    .not("domain", "is", null);

  if (!covErr) {
    for (const row of coverage ?? []) {
      const domain = normalizeDomain(row.domain);
      if (!domain || brands.has(domain)) continue;
      brands.set(domain, { domain, label: brandFromDomain(domain) });
    }
  }

  return [...brands.values()].sort((a, b) => a.domain.localeCompare(b.domain));
}

async function findPlacementByHash(supabase, domain, hash) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("ad_placements")
    .select("id, times_seen, first_seen, destination_id")
    .eq("domain", domain)
    .eq("creative_hash", hash)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`ad_placements lookup: ${error.message}`);
  return data;
}

async function upsertDestination(supabase, { advertiser, landingUrl, pageTitle, now, dryRun }) {
  const url = normalizeDestinationUrl(landingUrl);
  if (!url) return { action: "skipped", reason: "no_landing_url" };

  const row = {
    advertiser: normalizeDomain(advertiser),
    domain: destinationHost(url),
    url,
    url_hash: destinationUrlHash(url),
    page_title: pageTitle,
    first_seen: now,
    last_seen: now,
    ad_count: 1,
    enrichment_status: "pending",
  };

  if (dryRun) {
    return { action: "would_upsert", url, url_hash: row.url_hash, id: null };
  }

  if (!supabase) {
    throw new Error("Supabase client required for live destination writes");
  }

  const { data: existing, error: findErr } = await supabase
    .from("advertiser_destinations")
    .select("id, ad_count, first_seen")
    .eq("advertiser", row.advertiser)
    .eq("url_hash", row.url_hash)
    .maybeSingle();

  if (findErr) throw new Error(`advertiser_destinations lookup: ${findErr.message}`);

  if (existing) {
    const { data: updated, error: updErr } = await supabase
      .from("advertiser_destinations")
      .update({
        last_seen: now,
        ad_count: (existing.ad_count ?? 0) + 1,
        page_title: pageTitle ?? undefined,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (updErr) throw new Error(`advertiser_destinations update: ${updErr.message}`);
    return { action: "updated", id: updated.id, url };
  }

  const { data: inserted, error: insErr } = await supabase
    .from("advertiser_destinations")
    .insert(row)
    .select("id")
    .single();
  if (insErr) throw new Error(`advertiser_destinations insert: ${insErr.message}`);
  return { action: "inserted", id: inserted.id, url };
}

async function savePlacement(supabase, placement, destinationId, dryRun) {
  const now = new Date().toISOString();
  const existing = await findPlacementByHash(supabase, placement.domain, placement.creative_hash);

  const payload = {
    ...placement,
    last_seen: now,
    destination_id: destinationId ?? existing?.destination_id ?? null,
  };

  if (dryRun) {
    return {
      action: existing ? "would_update" : "would_insert",
      creative_hash: placement.creative_hash,
      landing_url: placement.landing_url,
      destination_id: destinationId ?? existing?.destination_id ?? null,
    };
  }

  if (!supabase) {
    throw new Error("Supabase client required for live placement writes");
  }

  if (existing) {
    const { data, error } = await supabase
      .from("ad_placements")
      .update({
        last_seen: now,
        times_seen: (existing.times_seen ?? 0) + 1,
        landing_url: placement.landing_url,
        headline: placement.headline,
        hook: placement.hook,
        primary_cta: placement.primary_cta,
        days_running: placement.days_running,
        destination_id: destinationId ?? existing.destination_id,
        raw: placement.raw,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(`ad_placements update: ${error.message}`);
    return { action: "updated", id: data.id, creative_hash: placement.creative_hash };
  }

  const { data, error } = await supabase
    .from("ad_placements")
    .insert({
      ...payload,
      first_seen: placement.first_seen ?? now,
    })
    .select("id")
    .single();
  if (error) throw new Error(`ad_placements insert: ${error.message}`);
  return { action: "inserted", id: data.id, creative_hash: placement.creative_hash };
}

async function ingestBrand(ctx) {
  const { supabase, brand, dryRun, apifyToken, actorId, country, limit, useFixture } = ctx;
  const report = {
    brand: brand.domain,
    pulled: 0,
    placements: { inserted: 0, updated: 0, would_insert: 0, would_update: 0 },
    destinations: { inserted: 0, updated: 0, skipped: 0, would_upsert: 0 },
    samples: [],
    errors: [],
  };

  let rawAds;
  try {
    if (useFixture) {
      rawAds = FIXTURE_ADS;
    } else {
      rawAds = await fetchMetaAdsFromApify({
        brand: brand.domain,
        apifyToken,
        actorId,
        country,
        limit,
      });
    }
  } catch (err) {
    report.errors.push(err.message ?? String(err));
    return report;
  }

  report.pulled = rawAds.length;
  const now = new Date().toISOString();

  for (const raw of rawAds) {
    const placement = mapApifyAd(raw, brand.domain);
    let destinationResult = { action: "skipped" };
    let destinationId = null;

    try {
      if (placement.landing_url) {
        destinationResult = await upsertDestination(supabase, {
          advertiser: brand.domain,
          landingUrl: placement.landing_url,
          pageTitle: placement.headline,
          now,
          dryRun,
        });
        if (destinationResult.id) destinationId = destinationResult.id;
      } else {
        destinationResult = { action: "skipped", reason: "no_landing_url" };
      }

      const placementResult = await savePlacement(supabase, placement, destinationId, dryRun);

      const destKey =
        destinationResult.action === "would_upsert"
          ? "would_upsert"
          : destinationResult.action === "inserted"
            ? "inserted"
            : destinationResult.action === "updated"
              ? "updated"
              : "skipped";
      report.destinations[destKey] = (report.destinations[destKey] ?? 0) + 1;

      const placeKey =
        placementResult.action === "would_insert"
          ? "would_insert"
          : placementResult.action === "would_update"
            ? "would_update"
            : placementResult.action;
      if (report.placements[placeKey] != null) {
        report.placements[placeKey] += 1;
      }

      if (report.samples.length < 3) {
        report.samples.push({
          creative_hash: placement.creative_hash,
          headline: placement.headline,
          landing_url: placement.landing_url,
          channel_platform: placement.channel_platform,
          placement: placementResult.action,
          destination: destinationResult.action,
        });
      }
    } catch (err) {
      report.errors.push(err.message ?? String(err));
    }
  }

  return report;
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = Boolean(args["dry-run"] ?? args.dryRun);
  const singleBrand = args.brand ?? args.domain ?? null;
  const limit = Number(args.limit ?? DEFAULT_LIMIT);
  const country = String(args.country ?? DEFAULT_COUNTRY);
  const actorId = process.env.APIFY_META_ACTOR ?? DEFAULT_ACTOR;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apifyToken = process.env.APIFY_TOKEN ?? process.env.APIFY_API_TOKEN ?? null;
  const useFixture = dryRun && !apifyToken;

  if (!useFixture && (!supabaseUrl || !serviceKey)) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }
  if (!dryRun && !apifyToken) {
    console.error("APIFY_TOKEN is required for live ingestion (or use --dry-run with fixture).");
    process.exit(1);
  }

  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

  console.log(
    `[meta-daily-ingestion] starting dryRun=${dryRun} brand=${singleBrand ?? "all"} actor=${actorId} fixture=${useFixture}`,
  );

  let brands;
  if (singleBrand) {
    const domain = normalizeDomain(singleBrand);
    brands = [{ domain, label: brandFromDomain(domain) }];
  } else if (supabase) {
    brands = await loadTargetBrands(supabase, null);
  } else {
    brands = [{ domain: normalizeDomain("commbank.com.au"), label: "CommBank" }];
  }

  if (!brands.length) {
    console.error("No brands found. Add domains to agency_watchlist or pass --brand.");
    process.exit(1);
  }

  const summary = {
    ok: true,
    dry_run: dryRun,
    fixture: useFixture,
    actor: actorId,
    country,
    limit,
    brands_processed: 0,
    totals: {
      pulled: 0,
      placements_inserted: 0,
      placements_updated: 0,
      destinations_inserted: 0,
      destinations_updated: 0,
    },
    brands: [],
    errors: [],
  };

  for (const brand of brands) {
    const report = await ingestBrand({
      supabase,
      brand,
      dryRun,
      apifyToken,
      actorId,
      country,
      limit,
      useFixture,
    });

    summary.brands_processed += 1;
    summary.totals.pulled += report.pulled;
    summary.totals.placements_inserted += report.placements.inserted ?? 0;
    summary.totals.placements_updated += report.placements.updated ?? 0;
    summary.totals.destinations_inserted += report.destinations.inserted ?? 0;
    summary.totals.destinations_updated += report.destinations.updated ?? 0;
    summary.brands.push(report);
    if (report.errors.length) summary.errors.push(...report.errors.map((e) => `${brand.domain}: ${e}`));
  }

  if (summary.errors.length) summary.ok = false;

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.ok ? 0 : 1);
}

main().catch((err) => {
  console.error("[meta-daily-ingestion] failed:", err.message ?? err);
  process.exit(1);
});
