/**
 * Drop-in replacement for direct ad_placements.insert() in PM2 ingest workers.
 *
 * On Seed (/opt/revenuad), after git pull:
 *
 *   const { ingestPlacementRow } = await import("./scripts/lib/ingestPlacement.ts");
 *
 * Replace:
 *   await supabase.from("ad_placements").insert(row);
 *
 * With:
 *   const { result, skipped, reason } = await ingestPlacementRow(supabase, row);
 *   if (skipped) console.log("[ingest] skip", reason);
 */
export {};
