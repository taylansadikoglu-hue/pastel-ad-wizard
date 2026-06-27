// Base URL for the RevenuAD Signal math engine.
// Prefers VITE_ENGINE_URL; falls back to production API host.
const configuredEngineUrl =
  (import.meta.env.VITE_ENGINE_URL as string | undefined) ?? "https://api.revenuad.com";

export const ENGINE_URL: string = configuredEngineUrl.replace(
  "api.revenuead.com",
  "api.revenuad.com",
);

export function engineUrl(path: string): string {
  const base = ENGINE_URL.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
