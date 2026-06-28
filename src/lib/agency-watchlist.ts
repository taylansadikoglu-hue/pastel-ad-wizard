import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AgencyWatchlistRow = Database["public"]["Tables"]["agency_watchlist"]["Row"];

export type AgencyContext = {
  agencyId: string | null;
  entries: AgencyWatchlistRow[];
  domains: Set<string>;
};

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function watchlistDisplayName(row: Pick<AgencyWatchlistRow, "domain" | "label">): string {
  if (row.label?.trim()) return row.label.trim();
  const root = row.domain.split(".")[0] ?? row.domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

export function domainsFromWatchlist(entries: AgencyWatchlistRow[]): Set<string> {
  const domains = new Set<string>();
  for (const row of entries) {
    if (row.domain) domains.add(normalizeDomain(row.domain));
  }
  return domains;
}

export function domainInWatchlist(domain: string, watchlistDomains: Set<string>): boolean {
  const normalized = normalizeDomain(domain);
  if (watchlistDomains.has(normalized)) return true;
  const root = normalized.split(".")[0] ?? normalized;
  for (const tracked of watchlistDomains) {
    if (tracked === normalized) return true;
    if (tracked.startsWith(root) || normalized.startsWith(tracked.split(".")[0] ?? "")) return true;
  }
  return false;
}

/** Filter intelligence rows to domains present on the agency watchlist. */
export function filterByAgencyWatchlist<T extends Record<string, unknown>>(
  rows: T[],
  watchlistDomains: Set<string>,
  domainKey: keyof T,
): T[] {
  if (watchlistDomains.size === 0) return [];
  return rows.filter((row) => {
    const raw = row[domainKey];
    if (raw == null || raw === "") return false;
    return domainInWatchlist(String(raw), watchlistDomains);
  });
}

/**
 * Resolve agency_id and watchlist rows for the authenticated user.
 * Live schema: agencies.id uuid · profiles.agency_id uuid · watchlist domain/label.
 */
export async function getAgencyContext(): Promise<AgencyContext> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) {
    return { agencyId: null, entries: [], domains: new Set() };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_id")
    .eq("id", userId)
    .maybeSingle();

  let agencyId = profile?.agency_id ?? null;

  if (!agencyId) {
    const { data: fallback } = await supabase.from("agencies").select("id").limit(1).maybeSingle();
    agencyId = fallback?.id ?? null;
  }

  if (!agencyId) {
    return { agencyId: null, entries: [], domains: new Set() };
  }

  const { data: entries, error } = await supabase
    .from("agency_watchlist")
    .select("id, agency_id, domain, label, created_at")
    .eq("agency_id", agencyId)
    .order("label");

  if (error) {
    console.error("[agency_watchlist] query failed", error);
    return { agencyId, entries: [], domains: new Set() };
  }

  const rows = entries ?? [];
  return {
    agencyId,
    entries: rows,
    domains: domainsFromWatchlist(rows),
  };
}
