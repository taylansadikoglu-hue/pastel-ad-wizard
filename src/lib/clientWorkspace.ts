import { supabase } from "@/integrations/supabase/client";

export const ACTIVE_CLIENT_WORKSPACE_KEY = "revenuad_active_client_workspace_id";

export type ClientWorkspace = {
  id: number;
  agency_id: string | null;
  client_name: string;
  client_domain: string;
  category: string;
  competitor_domains: string[];
  audience: string | null;
  tone: string | null;
  objective: string | null;
  excluded_channels: string[];
  status: string;
  created_at: string;
  updated_at: string;
};

export type CreateClientWorkspaceInput = {
  client_name: string;
  client_domain: string;
  category: string;
  competitor_domains: string[];
};

const CATEGORY_OPTIONS = [
  "Banking",
  "Insurance",
  "Superannuation",
  "Telco",
  "Automotive",
  "Retail",
  "Travel",
  "Food Delivery",
  "Health Insurance",
  "Real Estate",
] as const;

export { CATEGORY_OPTIONS };

export function normalizeClientDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

export function parseCompetitorDomains(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((d) => normalizeClientDomain(d))
    .filter(Boolean);
}

export function readActiveWorkspaceId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ACTIVE_CLIENT_WORKSPACE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function writeActiveWorkspaceId(id: number | null): void {
  if (typeof window === "undefined") return;
  if (id == null) {
    localStorage.removeItem(ACTIVE_CLIENT_WORKSPACE_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_CLIENT_WORKSPACE_KEY, String(id));
}

function mapRow(row: Record<string, unknown>): ClientWorkspace {
  const competitors = row.competitor_domains;
  return {
    id: Number(row.id),
    agency_id: (row.agency_id as string | null) ?? null,
    client_name: String(row.client_name ?? ""),
    client_domain: normalizeClientDomain(String(row.client_domain ?? "")),
    category: String(row.category ?? ""),
    competitor_domains: Array.isArray(competitors)
      ? competitors.map((d) => normalizeClientDomain(String(d)))
      : [],
    audience: (row.audience as string | null) ?? null,
    tone: (row.tone as string | null) ?? null,
    objective: (row.objective as string | null) ?? null,
    excluded_channels: Array.isArray(row.excluded_channels)
      ? row.excluded_channels.map(String)
      : [],
    status: String(row.status ?? "active"),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function fetchClientWorkspaces(): Promise<ClientWorkspace[]> {
  const { data, error } = await supabase
    .from("client_workspaces")
    .select("*")
    .eq("status", "active")
    .order("client_name");

  if (error) {
    console.error("[client_workspaces] fetch failed", error);
    return [];
  }

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function createClientWorkspace(
  input: CreateClientWorkspaceInput,
): Promise<{ workspace: ClientWorkspace | null; error: string | null }> {
  const payload = {
    client_name: input.client_name.trim(),
    client_domain: normalizeClientDomain(input.client_domain),
    category: input.category.trim(),
    competitor_domains: input.competitor_domains.map(normalizeClientDomain).filter(Boolean),
    status: "active",
  };

  const { data, error } = await supabase
    .from("client_workspaces")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { workspace: null, error: error.message };
  }

  return { workspace: mapRow(data as Record<string, unknown>), error: null };
}

export function domainMatchesWorkspace(domain: string, workspace: ClientWorkspace): boolean {
  const normalized = normalizeClientDomain(domain);
  if (normalized === workspace.client_domain) return true;
  return workspace.competitor_domains.some(
    (c) => normalized === c || normalized.endsWith(`.${c.split(".")[0]}`),
  );
}
