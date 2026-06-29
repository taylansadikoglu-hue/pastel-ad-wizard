import type { LandingPageExtraction } from "./extract-landing-page";
import type { AdvertiserDestinationRow } from "./types";

/** Compact landing-page summary passed to the tagger with ad copy. */
export type LandingPageSummary = {
  url: string;
  title?: string | null;
  meta?: string | null;
  h1?: string | null;
  h2?: string[];
  visibleOffers?: string[];
  cta?: string | null;
};

export function landingSummaryFromExtraction(extraction: LandingPageExtraction): LandingPageSummary {
  return {
    url: extraction.url,
    title: extraction.title,
    meta: extraction.meta,
    h1: extraction.h1,
    h2: extraction.h2,
    visibleOffers: extraction.visibleOffers,
    cta: extraction.cta,
  };
}

export function landingSummaryFromRow(row: AdvertiserDestinationRow): LandingPageSummary {
  return {
    url: row.url,
    title: row.page_title,
    meta: row.meta_description,
    h1: row.h1,
    h2: row.h2s ?? [],
    visibleOffers: row.visible_offers ?? [],
    cta: row.cta,
  };
}

export function formatLandingPageSummary(summary: LandingPageSummary): string {
  const lines = [
    `URL: ${summary.url}`,
    summary.title ? `Title: ${summary.title}` : null,
    summary.meta ? `Meta: ${summary.meta}` : null,
    summary.h1 ? `H1: ${summary.h1}` : null,
    summary.h2?.length ? `H2: ${summary.h2.join(" | ")}` : null,
    summary.visibleOffers?.length ? `Visible offers: ${summary.visibleOffers.join(" | ")}` : null,
    summary.cta ? `CTA: ${summary.cta}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}
