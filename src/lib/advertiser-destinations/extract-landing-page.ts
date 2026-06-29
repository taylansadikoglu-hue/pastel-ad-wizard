/**
 * Fetch a destination URL and extract landing-page signals (no OpenAI).
 */

import * as cheerio from "cheerio";

export type LandingPageExtraction = {
  url: string;
  title: string | null;
  meta: string | null;
  h1: string | null;
  h2: string[];
  visibleOffers: string[];
  cta: string | null;
  fetchedAt: string;
};

const CTA_PATTERN =
  /^(apply|apply now|sign up|signup|get started|start now|learn more|book now|shop now|buy now|download|register|join now|contact us|talk to us|enquire|enquire now|compare|see rates|view offer|claim offer|open account)/i;

const OFFER_PATTERN =
  /(\d+(\.\d+)?%\s*(p\.a\.|pa|per annum)?)|(\$\d[\d,]*(\.\d{2})?)|(\d+\s*months?\s+free)|(\bfree\b.{0,40})|(\bsave\b.{0,40})|(\bbonus\b.{0,40})|(\bcashback\b.{0,40})|(\blimited\s+time\b.{0,40})|(\boffer\b.{0,40})|(\bpromo(tion)?\b.{0,40})/i;

const OFFER_SELECTOR =
  "[class*='offer'], [class*='promo'], [class*='deal'], [class*='banner'], [class*='hero'], [id*='offer'], [id*='promo'], [data-offer], [data-promo]";

const CTA_SELECTOR =
  "button, [role='button'], input[type='submit'], a.btn, a.button, [class*='cta'], [class*='button']";

function cleanText(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text.length ? text : null;
}

function uniqueStrings(values: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const text = cleanText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function metaContent($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = cleanText($(selector).first().attr("content"));
    if (value) return value;
  }
  return null;
}

function collectOffers($: cheerio.CheerioAPI): string[] {
  const candidates: string[] = [];

  $(OFFER_SELECTOR).each((_, el) => {
    const text = cleanText($(el).text());
    if (text && text.length <= 220) candidates.push(text);
  });

  $("h1, h2, h3, p, li, strong, em, span").each((_, el) => {
    const text = cleanText($(el).text());
    if (!text || text.length > 180) return;
    if (OFFER_PATTERN.test(text)) candidates.push(text);
  });

  return uniqueStrings(candidates, 8);
}

function collectCtas($: cheerio.CheerioAPI): string[] {
  const candidates: string[] = [];

  $(CTA_SELECTOR).each((_, el) => {
    const text = cleanText($(el).text()) ?? cleanText($(el).attr("value")) ?? cleanText($(el).attr("aria-label"));
    if (!text || text.length > 60) return;
    if (CTA_PATTERN.test(text)) candidates.push(text);
  });

  $("a").each((_, el) => {
    const text = cleanText($(el).text());
    if (!text || text.length > 60) return;
    if (CTA_PATTERN.test(text)) candidates.push(text);
  });

  return uniqueStrings(candidates, 6);
}

export function parseLandingPageHtml(url: string, html: string): LandingPageExtraction {
  const $ = cheerio.load(html);

  const title =
    cleanText($("title").first().text()) ??
    metaContent($, ["meta[property='og:title']", "meta[name='twitter:title']"]);

  const meta =
    metaContent($, [
      "meta[name='description']",
      "meta[property='og:description']",
      "meta[name='twitter:description']",
    ]) ?? null;

  const h1 = cleanText($("h1").first().text());
  const h2 = uniqueStrings(
    $("h2")
      .toArray()
      .map((el) => $(el).text()),
    6,
  );

  const visibleOffers = collectOffers($);
  const ctas = collectCtas($);

  return {
    url,
    title,
    meta,
    h1,
    h2,
    visibleOffers,
    cta: ctas[0] ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function extractLandingPage(
  url: string,
  opts?: { timeoutMs?: number; userAgent?: string },
): Promise<LandingPageExtraction> {
  const normalized = url.trim();
  const timeoutMs = opts?.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          opts?.userAgent ??
          "Mozilla/5.0 (compatible; RevenuAD-DestinationEnrichment/1.0; +https://revenuad.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${normalized}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`Non-HTML content-type: ${contentType || "unknown"}`);
    }

    const html = await res.text();
    return parseLandingPageHtml(normalized, html);
  } finally {
    clearTimeout(timer);
  }
}
