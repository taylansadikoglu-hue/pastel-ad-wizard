import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";

type Props = {
  coverage: AdlibraryCoverage | null;
  onEvidence?: () => void;
  variant?: "dark" | "linen";
};

export function AdlibraryCoverageCard({ coverage, onEvidence, variant = "dark" }: Props) {
  if (!coverage) return null;
  const isLinen = variant === "linen";

  return (
    <section
      className={isLinen ? undefined : "rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"}
      style={
        isLinen
          ? {
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 12,
              padding: 16,
              marginTop: 16,
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3
            className={isLinen ? undefined : "text-sm font-semibold tracking-wide text-neutral-300"}
            style={isLinen ? { fontSize: 14, fontWeight: 600, color: "#1C1C1A" } : undefined}
          >
            Observed creative activity
          </h3>
          {!coverage.available ? (
            <p className={isLinen ? undefined : "mt-1 text-sm text-neutral-500"} style={isLinen ? { marginTop: 4, fontSize: 13, color: "#6B6B62" } : undefined}>
              Pipeline configured — awaiting first sync
            </p>
          ) : coverage.hasData ? (
            <p className={isLinen ? undefined : "mt-1 text-xs text-emerald-400"} style={isLinen ? { marginTop: 4, fontSize: 12, color: "#2D7D46" } : undefined}>
              Live indexed creatives
            </p>
          ) : (
            <p className={isLinen ? undefined : "mt-1 text-sm text-neutral-500"} style={isLinen ? { marginTop: 4, fontSize: 13, color: "#6B6B62" } : undefined}>
              Pipeline ready — awaiting index credits to populate
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Optional
          </span>
          {onEvidence ? (
            <button
              type="button"
              onClick={onEvidence}
              className="dense-chip text-neutral-400 hover:text-amber-400/90 border-neutral-700 text-[10px] px-2 py-1"
            >
              Evidence
            </button>
          ) : null}
        </div>
      </div>

      {coverage.available && coverage.hasData ? (
        <>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Advertisers tracked</dt>
              <dd className="font-medium text-neutral-100">{coverage.advertisersTracked}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ads indexed</dt>
              <dd className="font-medium text-neutral-100">{coverage.adsIndexed}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Enriched ads</dt>
              <dd className="font-medium text-neutral-100">{coverage.enrichedAds}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last run</dt>
              <dd className="font-medium text-neutral-100">
                {coverage.lastRunAt
                  ? new Date(coverage.lastRunAt).toLocaleDateString("en-AU")
                  : "—"}
              </dd>
            </div>
          </dl>
          {coverage.creditsRemaining != null ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Credits remaining (last run): {coverage.creditsRemaining}
            </p>
          ) : null}
        </>
      ) : (
        <p className={isLinen ? undefined : "mt-2 text-xs text-neutral-500"} style={isLinen ? { marginTop: 8, fontSize: 12, color: "#6B6B62" } : undefined}>
          Once credits are topped up, creatives will index automatically and appear in evidence drawers.
        </p>
      )}
    </section>
  );
}
