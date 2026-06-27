/** Launch pricing — agency account with multiple client workspaces. */
export type PlanKey = "launch" | "growth" | "pro";

export type PricingPlan = {
  key: PlanKey;
  name: string;
  price: number;
  workspaces: string;
  categories: string;
  badge?: string;
  perks: string[];
};

export const LAUNCH_CATEGORY_SLUGS = new Set(["banking", "retail", "insurance", "telco"]);

export const PRICING_PLANS: PricingPlan[] = [
  {
    key: "launch",
    name: "Launch",
    price: 299,
    workspaces: "1 active client workspace",
    categories: "1 full category (Banking, Retail, Insurance, or Telco)",
    perks: [
      "Market snapshot + channel mix",
      "Repeated messaging + whitespace",
      "3 recommended moves",
      "Pitch story export (PDF)",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    price: 799,
    workspaces: "3 active client workspaces",
    categories: "4 full categories",
    badge: "MOST POPULAR",
    perks: [
      "Everything in Launch",
      "Multi-client workspace switching",
      "Competitor set per client",
      "Priority intelligence refresh",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 1499,
    workspaces: "8 active client workspaces",
    categories: "All launch categories + category packs",
    perks: [
      "Everything in Growth",
      "Premium export pack eligible",
      "Agency-wide pitch templates",
      "Dedicated onboarding",
    ],
  },
];

export const PRICING_ADDONS = [
  { label: "Extra active client workspace", price: 149 },
  { label: "Extra category pack", price: 199 },
  { label: "Premium export pack", price: 99 },
] as const;

export function isLaunchCategory(slug: string): boolean {
  const key = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (LAUNCH_CATEGORY_SLUGS.has(key)) return true;
  return [...LAUNCH_CATEGORY_SLUGS].some((c) => key.includes(c) || c.includes(key.split("-")[0] ?? ""));
}
