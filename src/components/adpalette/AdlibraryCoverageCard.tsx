import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";

type Props = {
  coverage: AdlibraryCoverage | null;
  onEvidence?: () => void;
};

export function AdlibraryCoverageCard({ coverage, onEvidence }: Props) {
  if (!coverage) return null;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-neutral-300">AdLibrary coverage</h3>
          {!coverage.available ? (
            <p className="mt-1 text-sm text-neutral-500">Coverage data unavailable</p>
          ) : coverage.hasData ? (
            <p className="mt-1 text-xs text-emerald-400">Live pipeline data</p>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">No AdLibrary rows indexed yet</p>
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
      ) : null}
    </section>
  );
}
