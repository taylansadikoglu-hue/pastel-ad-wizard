export { enrichAndStoreDestination, mapExtractionToDestinationFields } from "./enrich";
export { extractLandingPage, parseLandingPageHtml } from "./extract-landing-page";
export { upsertAdvertiserDestination } from "./upsert";
export {
  destinationHost,
  destinationUrlHash,
  normalizeAdvertiser,
  normalizeDestinationUrl,
} from "./url";
export type {
  AdvertiserDestinationRow,
  AdvertiserDestinationUpsertInput,
  AdvertiserDestinationUpsertResult,
  DestinationEnrichmentStatus,
} from "./types";
export type { EnrichDestinationInput, EnrichDestinationResult } from "./enrich";
export type { LandingPageExtraction } from "./extract-landing-page";
