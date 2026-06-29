import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";

type Props = {
  coverage: AdlibraryCoverage | null;
};

export function AdlibraryCoverageCard({ coverage }: Props) {
  if (!coverage) return null;

  if (!coverage.available) {
    return (
      <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-wide text-neutral-300">AdLibrary coverage</h3>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Optional
          </span>
        </div>
        <p className="text-sm text-neutral-500">Coverage data unavailable</p>
      </section>
    );
  }

  if (!coverage.hasData) return null;

  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-foreground/90">
          AdLibrary coverage
        </h3>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
          Live
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Advertisers tracked</dt>
          <dd className="font-medium">{coverage.advertisersTracked}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ads indexed</dt>
          <dd className="font-medium">{coverage.adsIndexed}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Enriched ads</dt>
          <dd className="font-medium">{coverage.enrichedAds}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Last run</dt>
          <dd className="font-medium">
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
    </section>
  );
}
