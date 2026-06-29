import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAdvertiserPlacements,
  PLACEMENT_INTEL_SELECT,
  normalisePlacementRow,
} from "@/lib/advertiserPlacements";
import { placementToCreativeProof, type CreativeProofCard } from "@/lib/evidence/creative-proof";

function rootSlug(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "").split(".")[0] ?? domain;
}

/** Load observed creatives for workspace brands (normalized placements first). */
export async function fetchCreativeProofForDomains(
  supabase: SupabaseClient,
  domains: string[],
  limitPerDomain = 8,
): Promise<CreativeProofCard[]> {
  const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  if (!unique.length) return [];

  const cards: CreativeProofCard[] = [];
  const seen = new Set<string>();

  for (const domain of unique.slice(0, 8)) {
    const result = await fetchAdvertiserPlacements(supabase, domain, limitPerDomain);
    for (const row of result.rows) {
      const card = placementToCreativeProof(row);
      const key = String(card.id);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
  }

  if (cards.length) return cards;

  // Broad category fallback — recent indexed creatives for any watchlist root
  const patterns = unique.map((d) => `%${rootSlug(d)}%`);
  const orFilter = patterns.map((p) => `domain.ilike.${p}`).join(",");
  const { data } = await supabase
    .from("ad_placements")
    .select(PLACEMENT_INTEL_SELECT)
    .or(orFilter)
    .order("last_seen", { ascending: false, nullsFirst: false })
    .limit(limitPerDomain * unique.length);

  return (data ?? []).map((row) => placementToCreativeProof(normalisePlacementRow(row as Record<string, unknown>)));
}
