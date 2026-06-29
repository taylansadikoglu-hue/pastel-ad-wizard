import { ACTIVE_CLIENT_WORKSPACE_KEY, normalizeClientDomain } from "@/lib/clientWorkspace";
import { CORE_CATEGORY_ORDER } from "@/lib/categoryCatalog";

export const DEMO_EMAIL = "demo@revenuad.com";
export const DEMO_PASSWORD = "RevenueAdDemo2026!";
export const DEMO_ROLE = "demo";

export const DEMO_WORKSPACE_NAME = "CommBank";
export const DEMO_WORKSPACE_DOMAIN = "commbank.com.au";

/** User-facing label for the seeded workspace (localStorage). */
export const DEMO_ACTIVE_WORKSPACE_KEY = "active_workspace";

export const DEMO_ADVERTISER_BLOCKED_MESSAGE =
  "This demo environment currently showcases CommBank only.";

export const DEMO_READ_ONLY_MESSAGE = "Demo accounts are read-only.";

export type DemoPermissions = {
  readOnly: true;
  canExport: false;
  canScan: false;
  canEdit: false;
  canCreateWorkspace: false;
};

export const DEMO_PERMISSIONS: DemoPermissions = {
  readOnly: true,
  canExport: false,
  canScan: false,
  canEdit: false,
  canCreateWorkspace: false,
};

export type DemoUserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

export function isDemoEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEMO_EMAIL;
}

export function isDemoRole(role: string | null | undefined): boolean {
  return (role ?? "").trim().toLowerCase() === DEMO_ROLE;
}

export function resolveDemoUser(user: DemoUserLike | null | undefined): boolean {
  if (!user) return false;
  const meta = user.user_metadata ?? {};
  const role = (meta.role ?? meta.app_role) as string | undefined;
  return isDemoEmail(user.email) || isDemoRole(role);
}

export function normalizeDemoPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/app";
}

export function isDemoRouteAllowed(pathname: string): boolean {
  const path = normalizeDemoPath(pathname);
  if (path === "/app") return true;
  if (path === "/app/pcr" || path.startsWith("/app/pcr/")) return true;
  if (path === "/app/categories" || path.startsWith("/app/categories/")) return true;
  if (path.startsWith("/app/category/")) {
    const slug = path.slice("/app/category/".length).split("/")[0] ?? "";
    if (CORE_CATEGORY_ORDER.includes(slug as (typeof CORE_CATEGORY_ORDER)[number])) return true;
  }
  if (path === `/app/advertiser/${DEMO_WORKSPACE_DOMAIN}`) return true;
  return false;
}

export function isDemoAdvertiserAllowed(domain: string): boolean {
  return normalizeClientDomain(domain) === DEMO_WORKSPACE_DOMAIN;
}

export function isCommBankWorkspace(workspace: {
  client_name?: string | null;
  client_domain?: string | null;
}): boolean {
  const name = (workspace.client_name ?? "").trim().toLowerCase();
  const domain = normalizeClientDomain(workspace.client_domain ?? "");
  return name === DEMO_WORKSPACE_NAME.toLowerCase() || domain === DEMO_WORKSPACE_DOMAIN;
}

export function seedDemoLocalStorage(workspaceId?: number | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_ACTIVE_WORKSPACE_KEY, DEMO_WORKSPACE_NAME);
  if (workspaceId != null && Number.isFinite(workspaceId)) {
    localStorage.setItem(ACTIVE_CLIENT_WORKSPACE_KEY, String(workspaceId));
  }
}
