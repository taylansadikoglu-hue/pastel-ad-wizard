import type { CreativeProofCard } from "@/lib/evidence/creative-proof";
import type { MarketSignalView } from "@/lib/evidence/market-signal";
import { displayBrand } from "@/utils/brandDisplay";

export type BrandThreatMetric = {
  domain: string;
  creativeVolume?: number | null;
  threatScore?: number | null;
  demand?: number | null;
};

export type BrandMatrixMetric = {
  domain: string;
  estMonthlySpend?: number | null;
  primaryChannel?: string | null;
};

export type CrossBrandRow = {
  domain: string;
  label: string;
  role: "client" | "competitor";
  creatives: number | null;
  threatScore: number | null;
  demand: number | null;
  estMonthlySpend: number | null;
  primaryChannel: string | null;
  movement: string | null;
  categoryPosition: string | null;
  proofCount: number;
  topProof: string | null;
  isFocus: boolean;
};

function normDomain(d: string): string {
  return d.toLowerCase().replace(/^www\./, "").trim();
}

function matchMetric(metrics: BrandThreatMetric[], domain: string): BrandThreatMetric | undefined {
  const n = normDomain(domain);
  return metrics.find((m) => {
    const md = normDomain(m.domain);
    return md === n || md.includes(n.split(".")[0] ?? "") || n.includes(md.split(".")[0] ?? "");
  });
}

function matchMatrix(rows: BrandMatrixMetric[], domain: string): BrandMatrixMetric | undefined {
  const n = normDomain(domain);
  return rows.find((m) => normDomain(m.domain) === n);
}

function proofsForDomain(creatives: CreativeProofCard[], domain: string): CreativeProofCard[] {
  const root = normDomain(domain).split(".")[0] ?? domain;
  return creatives.filter((c) => {
    const cd = c.domain ? normDomain(c.domain) : "";
    const adv = c.advertiser.toLowerCase();
    return cd === normDomain(domain) || cd.includes(root) || adv.includes(root);
  });
}

export function buildCrossBrandComparison(opts: {
  clientDomain: string | null;
  clientName: string | null;
  competitorDomains: string[];
  focusDomain?: string | null;
  threatMetrics?: BrandThreatMetric[];
  matrixMetrics?: BrandMatrixMetric[];
  marketSignals?: Record<string, MarketSignalView | null>;
  creatives?: CreativeProofCard[];
}): CrossBrandRow[] {
  const {
    clientDomain,
    clientName,
    competitorDomains,
    focusDomain,
    threatMetrics = [],
    matrixMetrics = [],
    marketSignals = {},
    creatives = [],
  } = opts;

  const focus = focusDomain ? normDomain(focusDomain) : null;
  const domains: { domain: string; role: "client" | "competitor" }[] = [];

  if (clientDomain?.trim()) {
    domains.push({ domain: clientDomain.trim(), role: "client" });
  }
  for (const d of competitorDomains) {
    if (!d?.trim()) continue;
    const nd = normDomain(d);
    if (domains.some((x) => normDomain(x.domain) === nd)) continue;
    domains.push({ domain: d.trim(), role: "competitor" });
  }

  const rows = domains.map(({ domain, role }) => {
    const nd = normDomain(domain);
    const threat = matchMetric(threatMetrics, domain);
    const matrix = matchMatrix(matrixMetrics, domain);
    const signal = marketSignals[nd] ?? marketSignals[domain] ?? null;
    const proofs = proofsForDomain(creatives, domain);
    const top = proofs[0];

    return {
      domain,
      label: role === "client" && clientName ? displayBrand(clientName) : displayBrand(domain),
      role,
      creatives: threat?.creativeVolume ?? (proofs.length || null),
      threatScore: threat?.threatScore ?? null,
      demand: threat?.demand ?? null,
      estMonthlySpend: matrix?.estMonthlySpend ?? null,
      primaryChannel: matrix?.primaryChannel ?? null,
      movement: signal?.movement ?? null,
      categoryPosition: signal?.categoryPosition ?? null,
      proofCount: proofs.length,
      topProof: top?.headline ?? top?.body?.slice(0, 72) ?? null,
      isFocus: focus != null && (nd === focus || nd.includes(focus.split(".")[0] ?? "")),
    } satisfies CrossBrandRow;
  });

  return rows.sort((a, b) => {
    const aScore = (Number(a.threatScore) || 0) + (Number(a.creatives) || 0) * 0.1;
    const bScore = (Number(b.threatScore) || 0) + (Number(b.creatives) || 0) * 0.1;
    if (a.role !== b.role && a.role === "client") return -1;
    if (a.role !== b.role && b.role === "client") return 1;
    return bScore - aScore;
  });
}

export function formatEstSpend(value: number | null | undefined): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M/mo est.`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K/mo est.`;
  return `$${Math.round(n)}/mo est.`;
}
