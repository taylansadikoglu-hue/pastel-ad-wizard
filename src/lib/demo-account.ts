import { ACTIVE_CLIENT_WORKSPACE_KEY, normalizeClientDomain } from "@/lib/clientWorkspace";
import { CORE_CATEGORY_ORDER } from "@/lib/categoryCatalog";

export const DEMO_EMAIL = "demo@revenuad.com";
export const DEMO_PASSWORD = "RevenueAdDemo2026!";
/** Shared read-only showcase login for media beta testers (CommBank + Woolworths). */
export const BETA_DEMO_EMAIL = "beta@revenuad.com";
export const BETA_DEMO_PASSWORD = "RevenueAdBeta2026!";
export const DEMO_ROLE = "demo";

/** All emails that resolve to the read-only showcase environment. */
export const DEMO_ACCOUNT_EMAILS = [DEMO_EMAIL, BETA_DEMO_EMAIL] as const;

/** Primary demo workspace — Banking */
export const DEMO_WORKSPACE_NAME = "CommBank";
export const DEMO_WORKSPACE_DOMAIN = "commbank.com.au";

/**
 * Second showcase advertiser: Woolworths leads Retail — the most populated
 * non-banking core vertical in our category index (31 tracked brands).
 */
export const DEMO_SECOND_WORKSPACE_NAME = "Woolworths";
export const DEMO_SECOND_WORKSPACE_DOMAIN = "woolworths.com.au";

export type DemoShowcaseAdvertiser = {
  name: string;
  domain: string;
  category: string;
};

export const DEMO_SHOWCASE_ADVERTISERS: DemoShowcaseAdvertiser[] = [
  { name: DEMO_WORKSPACE_NAME, domain: DEMO_WORKSPACE_DOMAIN, category: "Banking" },
  { name: DEMO_SECOND_WORKSPACE_NAME, domain: DEMO_SECOND_WORKSPACE_DOMAIN, category: "Retail" },
];

const DEMO_ALLOWED_DOMAINS = new Set(
  DEMO_SHOWCASE_ADVERTISERS.map((a) => normalizeClientDomain(a.domain)),
);

/** User-facing label for the seeded workspace (localStorage). */
export const DEMO_ACTIVE_WORKSPACE_KEY = "active_workspace";

export const DEMO_ADVERTISER_BLOCKED_MESSAGE =
  "This demo environment showcases CommBank (Banking) and Woolworths (Retail) only.";

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
  const normalized = (email ?? "").trim().toLowerCase();
  return DEMO_ACCOUNT_EMAILS.some((e) => e === normalized);
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
  for (const domain of DEMO_ALLOWED_DOMAINS) {
    if (path === `/app/advertiser/${domain}`) return true;
  }
  return false;
}

export function isDemoAdvertiserAllowed(domain: string): boolean {
  return DEMO_ALLOWED_DOMAINS.has(normalizeClientDomain(domain));
}

export function isDemoShowcaseWorkspace(workspace: {
  client_name?: string | null;
  client_domain?: string | null;
}): boolean {
  const name = (workspace.client_name ?? "").trim().toLowerCase();
  const domain = normalizeClientDomain(workspace.client_domain ?? "");
  return DEMO_SHOWCASE_ADVERTISERS.some(
    (a) =>
      name === a.name.toLowerCase() ||
      domain === normalizeClientDomain(a.domain) ||
      domain.includes(a.domain.split(".")[0] ?? ""),
  );
}

/** @deprecated Use isDemoShowcaseWorkspace */
export function isCommBankWorkspace(workspace: {
  client_name?: string | null;
  client_domain?: string | null;
}): boolean {
  return isDemoShowcaseWorkspace(workspace);
}

export function seedDemoLocalStorage(workspaceId?: number | null): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_ACTIVE_WORKSPACE_KEY, DEMO_WORKSPACE_NAME);
  if (workspaceId != null && Number.isFinite(workspaceId)) {
    localStorage.setItem(ACTIVE_CLIENT_WORKSPACE_KEY, String(workspaceId));
  }
}

export function demoShowcaseLabel(): string {
  return DEMO_SHOWCASE_ADVERTISERS.map((a) => a.name).join(" + ");
}
