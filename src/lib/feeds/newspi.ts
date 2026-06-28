import { ENGINE_URL } from "@/lib/engine";
import { normalizeDomain, rootToken } from "./normalize-domain";
import type { NewsArticle } from "./types";

type WarroomNews = {
  news?: { articles?: unknown[] } | unknown[];
  articles?: unknown[];
};

function mapArticle(raw: unknown): NewsArticle | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!title) return null;
  return {
    title,
    url: typeof row.url === "string" ? row.url : null,
    source: typeof row.source === "string" ? row.source : null,
    publishedAt:
      typeof row.published_at === "string"
        ? row.published_at
        : typeof row.date === "string"
          ? row.date
          : null,
  };
}

/** News feed — engine warroom today; Newspi API key reserved for direct provider later. */
export async function fetchNewsFeed(domain: string, brandLabel?: string | null): Promise<NewsArticle[]> {
  const candidates = [brandLabel?.trim(), rootToken(domain), normalizeDomain(domain)].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${ENGINE_URL}/api/advertisers/${encodeURIComponent(candidate)}/warroom`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as WarroomNews;
      const newsField = body.news;
      const articlesRaw = Array.isArray(newsField)
        ? newsField
        : Array.isArray(newsField?.articles)
          ? newsField.articles
          : Array.isArray(body.articles)
            ? body.articles
            : [];
      const articles = articlesRaw.map(mapArticle).filter((a): a is NewsArticle => Boolean(a));
      if (articles.length) return articles.slice(0, 8);
    } catch {
      /* try next candidate */
    }
  }

  return [];
}
