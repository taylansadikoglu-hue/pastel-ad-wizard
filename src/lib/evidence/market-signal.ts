import type { TrafficProfile } from "@/lib/feeds/types";
import { formatPct, formatVisits } from "@/lib/feeds/normalize-domain";

export type MarketSignalView = {
  movement: string;
  detail: string;
  categoryPosition: string | null;
  searchMix: string | null;
};

/** Customer-facing traffic / demand signal — omitted when data is not useful. */
export function buildMarketSignalView(traffic: TrafficProfile | null | undefined): MarketSignalView | null {
  if (!traffic?.monthlyVisits) return null;

  const change = traffic.visitsChangePct;
  let movement = "Traffic signal is stable";
  if (change != null) {
    if (change > 0.03) movement = "Interest is rising";
    else if (change < -0.03) movement = "Attention is cooling";
    else movement = "Traffic signal is steady";
  }

  const detailParts = [
    `${formatVisits(traffic.monthlyVisits)} monthly visits`,
    change != null ? `${formatPct(change, { fromFraction: true })} visit change` : null,
  ].filter(Boolean);

  const categoryPosition =
    traffic.categoryRank != null
      ? `#${traffic.categoryRank}${traffic.category ? ` in ${traffic.category}` : ""}${
          traffic.categoryRankChange != null && traffic.categoryRankChange !== 0
            ? ` (${traffic.categoryRankChange > 0 ? "↑" : "↓"}${Math.abs(traffic.categoryRankChange)})`
            : ""
        }`
      : null;

  const searchMix =
    traffic.organicSearchShare != null || traffic.paidSearchShare != null
      ? [
          traffic.organicSearchShare != null
            ? `${formatPct(traffic.organicSearchShare, { fromFraction: true })} organic search`
            : null,
          traffic.paidSearchShare != null
            ? `${formatPct(traffic.paidSearchShare, { fromFraction: true })} paid search`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  if (!detailParts.length && !categoryPosition && !searchMix) return null;

  return {
    movement,
    detail: detailParts.join(" · "),
    categoryPosition,
    searchMix,
  };
}
