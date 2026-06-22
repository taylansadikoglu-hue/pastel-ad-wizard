// Base URL for the RevenueAd math engine.
// Prefers VITE_ENGINE_URL; falls back to the direct IP while DNS propagates.
export const ENGINE_URL: string =
  (import.meta.env.VITE_ENGINE_URL as string | undefined) ?? "https://api.revenuad.com:3001";

export function engineUrl(path: string): string {
  const base = ENGINE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
