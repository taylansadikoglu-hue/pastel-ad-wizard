import type { AdlibraryAdvertiserIntel } from "@/lib/adlibraryCoverage";

type Props = {
  intel: AdlibraryAdvertiserIntel | null;
};

export function AdlibraryAdvertiserPanel({ intel }: Props) {
  if (!intel) return null;

  if (!intel.available) {
    return (
      <section className="rounded-xl border border-border/60 bg-card/30 p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
            AdLibrary
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Optional
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Coverage data unavailable</p>
      </section>
    );
  }

  if (!intel.hasAdlibraryAds) return null;

  const topWinner = intel.winningConcepts[0];

  return (
    <section className="rounded-xl border border-border/60 bg-card/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          AdLibrary
        </span>
        <span className="text-xs text-muted-foreground">
          {intel.adlibraryAdCount} indexed creative{intel.adlibraryAdCount === 1 ? "" : "s"}
        </span>
      </div>

      {intel.enrichmentSummary ? (
        <p className="text-sm text-foreground/85 leading-relaxed">{intel.enrichmentSummary}</p>
      ) : null}

      {topWinner ? (
        <div className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Winning concept
          </p>
          <p className="mt-1">
            Tier {topWinner.tier ?? "—"}
            {topWinner.composite_score != null
              ? ` · score ${topWinner.composite_score}`
              : ""}
          </p>
        </div>
      ) : null}

      {intel.sampleSourceUrl ? (
        <a
          href={intel.sampleSourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs text-sky-400 hover:underline"
        >
          View creative source
        </a>
      ) : null}
    </section>
  );
}
