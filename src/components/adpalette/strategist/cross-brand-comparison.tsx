import type { CrossBrandRow } from "@/lib/evidence/cross-brand";
import { formatEstSpend } from "@/lib/evidence/cross-brand";
import { displayBrand } from "@/utils/brandDisplay";
import { cn } from "@/lib/utils";

function MovementPill({ label }: { label: string }) {
  const v = label.toLowerCase();
  const tone =
    v.includes("rising") || v.includes("interest is rising")
      ? "text-emerald-300 bg-emerald-950/40 border-emerald-800"
      : v.includes("cooling") || v.includes("attention is cooling")
        ? "text-rose-300 bg-rose-950/30 border-rose-900"
        : "text-neutral-300 bg-neutral-900 border-neutral-700";
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", tone)}>
      {label}
    </span>
  );
}

export function CrossBrandComparison({
  rows,
  loading,
}: {
  rows: CrossBrandRow[];
  loading?: boolean;
}) {
  if (loading) {
    return <p className="text-xs text-neutral-500 m-0">Loading brand comparison…</p>;
  }

  if (!rows.length) {
    return (
      <p className="text-xs text-neutral-500 m-0 leading-relaxed">
        Add client and competitor domains to your workspace to compare brands side by side.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const spend = formatEstSpend(row.estMonthlySpend);
        return (
          <article
            key={row.domain}
            className={cn(
              "rounded-lg border p-3 space-y-2",
              row.isFocus
                ? "border-amber-700/60 bg-amber-950/20"
                : "border-neutral-800 bg-neutral-900/60",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-neutral-100 truncate">
                    {displayBrand(row.label)}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                    {row.role === "client" ? "Client" : "Competitor"}
                  </span>
                  {row.isFocus ? (
                    <span className="text-[10px] font-medium text-amber-300/90">In focus</span>
                  ) : null}
                </div>
                <div className="text-[11px] text-neutral-500 truncate">{row.domain}</div>
              </div>
              {row.movement ? <MovementPill label={row.movement} /> : null}
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>
                <dt className="text-neutral-500">Creatives</dt>
                <dd className="font-semibold text-neutral-100 tabular-nums">
                  {row.creatives ?? row.proofCount ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Threat</dt>
                <dd className="font-semibold text-neutral-100 tabular-nums">
                  {row.threatScore != null ? row.threatScore.toFixed(1) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Demand</dt>
                <dd className="font-semibold text-neutral-100 tabular-nums">
                  {row.demand != null ? row.demand.toFixed(1) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Spend signal</dt>
                <dd className="font-semibold text-neutral-100">{spend ?? "—"}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-neutral-500">
              {row.primaryChannel ? <span>Channel: {row.primaryChannel}</span> : null}
              {row.categoryPosition ? <span>{row.categoryPosition}</span> : null}
              {row.proofCount > 0 ? (
                <span>{row.proofCount} proof card{row.proofCount === 1 ? "" : "s"}</span>
              ) : null}
            </div>

            {row.topProof ? (
              <p className="text-[11px] text-neutral-400 m-0 italic line-clamp-2">
                Top creative: {row.topProof}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
