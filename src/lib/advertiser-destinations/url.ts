export function normalizeDestinationUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("{{")) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProtocol);
    if (!u.hostname || u.hostname === "localhost") return null;
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function destinationHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^www\./, "").split("/")[0]?.toLowerCase() ?? url;
  }
}

export function destinationUrlHash(url: string): string {
  return normalizeDestinationUrl(url)?.toLowerCase() ?? url.toLowerCase();
}

export function normalizeAdvertiser(advertiser: string): string {
  return advertiser.trim().toLowerCase().replace(/^www\./, "");
}
