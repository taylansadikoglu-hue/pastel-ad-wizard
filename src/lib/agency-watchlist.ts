import { supabase } from "@/integrations/supabase/client";

export type AgencyWatchlistRow = {
  id: number;
  agency_id: number;
  client_name: string;
  client_domain: string;
  competitor_domain: string | null;
  category: string | null;
  country: string | null;
};

export type AgencyContext = {
  agencyId: number | null;
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

export function domainsFromWatchlist(entries: AgencyWatchlistRow[]): Set<string> {
  const domains = new Set<string>();
  for (const row of entries) {
    if (row.client_domain) domains.add(normalizeDomain(row.client_domain));
    if (row.competitor_domain) domains.add(normalizeDomain(row.competitor_domain));
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
 * All strategist queries MUST scope through this before reading intel views.
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
    .select("id, agency_id, client_name, client_domain, competitor_domain, category, country")
    .eq("agency_id", agencyId);

  if (error) {
    console.error("[agency_watchlist] query failed", error);
    return { agencyId, entries: [], domains: new Set() };
  }

  const rows = (entries ?? []) as AgencyWatchlistRow[];
  return {
    agencyId,
    entries: rows,
    domains: domainsFromWatchlist(rows),
  };
}
