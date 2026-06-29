import type { AdLibraryAd } from "./adlibraryClient.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlacementUpsertStats = {
  inserted: number;
  updated: number;
  skipped: number;
};

export type MapAdInput = {
  ad: AdLibraryAd;
  category: string;
  domain?: string | null;
  advertiserName: string;
};

export function adlibraryCreativeHash(adKey: string): string {
  return `adlibrary:${adKey}`;
}

export function mapAdToPlacement(input: MapAdInput): Record<string, unknown> {
  const { ad, category, domain, advertiserName } = input;
  const adKey = String(ad.ad_key ?? "");
  const platform = String(ad.platform ?? "unknown").toLowerCase();

  return {
    domain: domain ?? slugDomain(advertiserName),
    advertiser_name: ad.advertiser_name ?? advertiserName,
    category,
    ad_title: ad.title ?? null,
    raw_copy: ad.body ?? null,
    hook: ad.title ?? null,
    headline: ad.title ?? null,
    channel: platformChannel(platform),
    channel_platform: capitalizePlatform(platform),
    media_url: ad.preview_img_url ?? null,
    creative_url: ad.preview_img_url ?? null,
    times_seen: ad.impression ?? null,
    first_seen: ad.first_seen ?? null,
    last_seen: ad.last_seen ?? null,
    landing_url: (ad.landing_url as string | undefined) ?? null,
    source_platform: "adlibrary",
    source_archive_url: (ad.source_archive_url as string | undefined) ?? null,
    creative_hash: adKey ? adlibraryCreativeHash(adKey) : null,
    raw: {
      source: "adlibrary",
      ad_key: adKey,
      like_count: ad.like_count ?? null,
      share_count: ad.share_count ?? null,
      impression: ad.impression ?? null,
      geo: ad.geo ?? null,
      payload: ad,
    },
    data_quality: "adlibrary_ingest",
  };
}

export async function upsertAdlibraryPlacement(
  supabase: SupabaseClient | null,
  row: Record<string, unknown>,
  dryRun: boolean,
): Promise<"inserted" | "updated" | "skipped"> {
  const creativeHash = row.creative_hash as string | null;
  if (!creativeHash) return "skipped";

  if (dryRun) return "inserted";

  if (!supabase) {
    throw new Error("Supabase client required for non-dry-run upsert");
  }

  const { data: existing, error: fetchErr } = await supabase
    .from("ad_placements")
    .select("*")
    .eq("creative_hash", creativeHash)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(`Placement fetch failed: ${fetchErr.message}`);
  }

  if (!existing) {
    const { error: insertErr } = await supabase.from("ad_placements").insert(row);
    if (insertErr) throw new Error(`Placement insert failed: ${insertErr.message}`);
    return "inserted";
  }

  const patch = mergePlacementRow(existing as Record<string, unknown>, row);
  const { error: updateErr } = await supabase
    .from("ad_placements")
    .update(patch)
    .eq("id", (existing as { id: number }).id);

  if (updateErr) throw new Error(`Placement update failed: ${updateErr.message}`);
  return "updated";
}

const GPT_FIELDS = [
  "hook_analysis",
  "strategist_takeaway",
  "buyer_stage",
  "emotional_driver",
  "offer_type",
  "primary_cta",
  "product_type",
  "market_signal",
  "offer_signal",
  "detected_cta",
  "extracted_offer",
] as const;

export function mergePlacementRow(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(incoming)) {
    if (value == null || value === "") continue;

    if ((GPT_FIELDS as readonly string[]).includes(key)) {
      const cur = existing[key];
      if (cur != null && String(cur).trim() !== "") continue;
    }

    if (key === "raw" && existing.raw && typeof existing.raw === "object") {
      patch.raw = { ...(existing.raw as object), ...(value as object) };
      continue;
    }

    patch[key] = value;
  }

  // Always refresh sighting metrics when present
  for (const metric of ["times_seen", "last_seen"] as const) {
    if (incoming[metric] != null) patch[metric] = incoming[metric];
  }

  return patch;
}

export function parseEnrichmentTags(enrichment: {
  summary?: string | null;
  analysis?: string | null;
  markdown?: string | null;
}): Record<string, string | null> {
  const blob = [enrichment.markdown, enrichment.analysis, enrichment.summary]
    .filter(Boolean)
    .join("\n");

  return {
    hook_analysis: extractField(blob, /hook[:\s]+(.+?)(?:\n|$)/i),
    strategist_takeaway: extractField(blob, /(?:takeaway|summary)[:\s]+(.+?)(?:\n|$)/i),
    buyer_stage: extractField(blob, /buyer\s*stage[:\s]+(.+?)(?:\n|$)/i),
    emotional_driver: extractField(blob, /emotional\s*driver[:\s]+(.+?)(?:\n|$)/i),
    offer_type: extractField(blob, /offer\s*type[:\s]+(.+?)(?:\n|$)/i),
    primary_cta: extractField(blob, /(?:primary\s*)?cta[:\s]+(.+?)(?:\n|$)/i),
    product_type: extractField(blob, /product\s*type[:\s]+(.+?)(?:\n|$)/i),
    market_signal: extractField(blob, /market\s*signal[:\s]+(.+?)(?:\n|$)/i),
    offer_signal: extractField(blob, /offer\s*signal[:\s]+(.+?)(?:\n|$)/i),
  };
}

function extractField(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

function slugDomain(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `${slug}.com.au`;
}

function platformChannel(platform: string): string {
  if (platform.includes("tiktok")) return "TikTok";
  if (platform.includes("insta")) return "Meta";
  if (platform.includes("face")) return "Meta";
  return "Social";
}

function capitalizePlatform(platform: string): string {
  if (platform.includes("tiktok")) return "TikTok";
  if (platform.includes("insta")) return "Instagram";
  if (platform.includes("face")) return "Facebook";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}
