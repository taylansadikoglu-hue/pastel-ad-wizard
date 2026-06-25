// Canonical display names for known Australian advertisers.
// Use displayBrand() in every component that renders an advertiser/brand name.
export const BRAND_DISPLAY: Record<string, string> = {
  nab: "NAB",
  commbank: "CommBank",
  "commbank.com.au": "CommBank",
  commonwealthbank: "CommBank",
  "commonwealthbank.com.au": "CommBank",
  anz: "ANZ",
  "anz.com.au": "ANZ",
  westpac: "Westpac",
  "westpac.com.au": "Westpac",
  macquarie: "Macquarie",
  "macquarie.com.au": "Macquarie",
  newcastlepermanent: "Newcastle Permanent",
  "newcastlepermanent.com.au": "Newcastle Permanent",
  suncorp: "Suncorp",
  "suncorp.com.au": "Suncorp",
  ing: "ING",
  "ing.com.au": "ING",
  me: "ME Bank",
  "me.com.au": "ME Bank",
  mebank: "ME Bank",
  bendigo: "Bendigo Bank",
  "bendigo.com.au": "Bendigo Bank",
  bankwest: "Bankwest",
  "bankwest.com.au": "Bankwest",
  ubank: "UBank",
  "ubank.com.au": "UBank",
  woolworths: "Woolworths",
  "woolworths.com.au": "Woolworths",
  coles: "Coles",
  "coles.com.au": "Coles",
  telstra: "Telstra",
  "telstra.com.au": "Telstra",
  optus: "Optus",
  "optus.com.au": "Optus",
  toyota: "Toyota",
  "toyota.com.au": "Toyota",
  ford: "Ford",
  "ford.com.au": "Ford",
  nib: "NIB",
  "nib.com.au": "NIB",
  medibank: "Medibank",
  "medibank.com.au": "Medibank",
  finder: "Finder",
  "finder.com.au": "Finder",
  canstar: "Canstar",
  "canstar.com.au": "Canstar",
  "news.com.au": "News.com.au",
};

export function displayBrand(raw: string | null | undefined): string {
  if (!raw) return "—";
  const trimmed = String(raw).trim();
  if (!trimmed) return "—";
  const key = trimmed.toLowerCase().replace(/^www\./, "");
  if (BRAND_DISPLAY[key]) return BRAND_DISPLAY[key];
  const root = key.split(".")[0] ?? key;
  if (BRAND_DISPLAY[root]) return BRAND_DISPLAY[root];
  // Multi-word brand passed in directly — preserve casing
  if (/\s/.test(trimmed)) {
    return trimmed
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return root.charAt(0).toUpperCase() + root.slice(1);
}

// Spend-index helper used wherever spend appears.
// 7-tier: <500K=1, <2M=2, <10M=3, <30M=4, <80M=5, <150M=6, 150M+=7
export function spendLevel(spend: number | null | undefined): number {
  const n = Number(spend);
  if (!Number.isFinite(n) || n <= 0) return 1;
  if (n < 500_000) return 1;
  if (n < 2_000_000) return 2;
  if (n < 10_000_000) return 3;
  if (n < 30_000_000) return 4;
  if (n < 80_000_000) return 5;
  if (n < 150_000_000) return 6;
  return 7;
}
