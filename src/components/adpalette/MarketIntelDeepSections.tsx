import type { MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import { translateTerritory } from "@/lib/radInsightTranslator";
import { cn } from "@/lib/utils";

const DC = {
  card: "card-dense",
  label: "dense-label",
  meta: "dense-meta",
  chip: "dense-chip",
} as const;

function brandLabel(domain: string): string {
  return domain.replace(/^www\./, "").split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function territoryTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("open")) return "text-emerald-400 border-emerald-800/80 bg-emerald-950/40";
  if (s.includes("crowded") || s.includes("competitive")) return "text-amber-400 border-amber-800/80 bg-amber-950/40";
  return "text-neutral-300 border-neutral-700 bg-neutral-900";
}

type SectionHeaderProps = {
  index: string;
  title: string;
  subtitle?: string;
  onEvidence?: () => void;
};

function SectionHeader({ index, title, subtitle, onEvidence, linen }: SectionHeaderProps & { linen?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <div
          className={linen ? undefined : cn(DC.label, "tracking-widest")}
          style={linen ? { fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9E9D94" } : undefined}
        >
          {index}
        </div>
        <h2
          className={linen ? undefined : "text-base font-semibold tracking-tight text-neutral-100"}
          style={linen ? { fontSize: 15, fontWeight: 600, color: "#1C1C1A", marginTop: 4 } : undefined}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className={linen ? undefined : cn(DC.meta, "mt-1 normal-case max-w-2xl")}
            style={linen ? { marginTop: 4, fontSize: 12, color: "#6B6B62", maxWidth: 640 } : undefined}
          >
            {subtitle}
          </p>
        )}
      </div>
      {onEvidence && (
        <button
          type="button"
          onClick={onEvidence}
          className={linen ? undefined : cn(DC.chip, "shrink-0 text-neutral-400 hover:text-amber-400/90 border-neutral-700")}
          style={
            linen
              ? {
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#C9963A",
                  background: "#FDF6E8",
                  border: "1px solid #E8D5A0",
                  borderRadius: 999,
                  padding: "4px 10px",
                  cursor: "pointer",
                }
              : undefined
          }
        >
          Evidence
        </button>
      )}
    </div>
  );
}

type Props = {
  intel: MarketStrategistIntel | null;
  variant?: "dark" | "linen";
  onEvidence: (
    moduleId: "territories" | "threats" | "meeting" | "changes" | "positioning" | "evidence" | "strategicActions",
    rowIndex?: number,
    rowLabel?: string,
  ) => void;
};

export function MarketIntelDeepSections({ intel, onEvidence, variant = "dark" }: Props) {
  if (!intel?.available) return null;
  const isLinen = variant === "linen";

  const exec = intel.executivePack;
  const gap = intel.competitiveGap;
  const hero = intel.dashboardHero;

  return (
    <>
      {(exec?.ceoSummary || exec?.headline || hero?.marketStory) && (
        <section>
          <SectionHeader
            index="07"
            title="Executive read"
            subtitle="C-suite narrative from strategist intelligence"
            onEvidence={() => onEvidence("evidence")}
          />
          <div className={cn(DC.card, "space-y-3")}>
            {hero?.marketStory && (
              <p className="text-sm font-medium text-amber-400/90">{hero.marketStory}</p>
            )}
            {exec?.headline && (
              <h3 className="text-lg font-semibold text-neutral-50 leading-snug">{exec.headline}</h3>
            )}
            {exec?.observation && <p className="text-sm text-neutral-300 leading-relaxed">{exec.observation}</p>}
            {exec?.ceoSummary && exec.ceoSummary !== exec.headline && (
              <p className="text-sm text-neutral-400 leading-relaxed">{exec.ceoSummary}</p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {exec?.marketTemperature && (
                <span className={cn(DC.chip, "text-rose-300 border-rose-900/60")}>{exec.marketTemperature} market</span>
              )}
              {hero?.fastestMomentum && (
                <span className={cn(DC.chip, "text-neutral-200")}>Fastest momentum: {brandLabel(hero.fastestMomentum)}</span>
              )}
              {hero?.topOpportunity && (
                <span className={cn(DC.chip, "text-emerald-300 border-emerald-900/50")}>Top opportunity: {brandLabel(hero.topOpportunity)}</span>
              )}
            </div>
            {exec?.recommendedAction && (
              <p className="text-sm text-neutral-100 border-t border-neutral-800 pt-3 mt-2">
                <span className="text-amber-400/90 font-medium">Recommended: </span>
                {exec.recommendedAction}
              </p>
            )}
          </div>
        </section>
      )}

      {gap?.gapNarrative && (
        <section>
          <SectionHeader index="08" title="Competitive gap" subtitle="Where the category leaves room to win" />
          <div className={cn(DC.card, "space-y-2")}>
            {gap.strongestThreat && (
              <p className="text-sm text-neutral-200">
                <span className="font-semibold text-neutral-50">Primary threat: </span>
                {brandLabel(gap.strongestThreat)}
              </p>
            )}
            <p className="text-sm text-neutral-300 leading-relaxed">{gap.gapNarrative}</p>
            {gap.strategicOpening && (
              <p className="text-sm text-emerald-400/90 leading-relaxed">{gap.strategicOpening}</p>
            )}
          </div>
        </section>
      )}

      {intel.territories.length > 0 && (
        <section>
          <SectionHeader
            index="09"
            title="Emotional territory map"
            subtitle="Which messages are crowded vs open in the category"
            onEvidence={() => onEvidence("territories")}
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {intel.territories.map((t, i) => (
              <button
                key={t.emotion}
                type="button"
                onClick={() => onEvidence("territories", i, translateTerritory(t.emotion))}
                className={cn(DC.card, "text-left py-3 px-3 hover:border-neutral-600 transition-colors")}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold text-neutral-100">{translateTerritory(t.emotion)}</span>
                  <span className={cn(DC.chip, territoryTone(t.status))}>{t.status}</span>
                </div>
                <p className={cn(DC.meta, "normal-case")}>
                  {t.brandsUsing} brand{t.brandsUsing === 1 ? "" : "s"} · {t.avgShare.toFixed(1)}% avg share
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {intel.risks.length > 0 && (
        <section>
          <SectionHeader
            index="10"
            title="Threat radar"
            subtitle="Competitors that need immediate attention"
            onEvidence={() => onEvidence("threats")}
          />
          <div className={cn(DC.card, "divide-y divide-neutral-800")}>
            {intel.risks.slice(0, 5).map((r, i) => (
              <button
                key={r.competitorDomain}
                type="button"
                onClick={() => onEvidence("threats", i, brandLabel(r.competitorDomain))}
                className="w-full text-left py-3 first:pt-0 last:pb-0 hover:opacity-90"
              >
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-sm font-semibold text-neutral-100">{brandLabel(r.competitorDomain)}</span>
                  <span className={cn(DC.chip, r.riskLevel.toLowerCase().includes("immediate") ? "text-rose-400 border-rose-900/60" : "text-neutral-400")}>
                    {r.riskLevel} · {r.threatScore}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed">{r.narrative}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {intel.meetingPrep.length > 0 && (
        <section>
          <SectionHeader index="11" title="Meeting prep" subtitle="Structured talking points for your next client call" onEvidence={() => onEvidence("meeting")} />
          <div className={cn(DC.card, "space-y-4")}>
            {intel.meetingPrep.map((row) => (
              <div key={row.section}>
                <div className={cn(DC.label, "text-amber-400/80 mb-1")}>{row.section}</div>
                <p className="text-sm text-neutral-200 leading-relaxed">{row.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {intel.dailyChanges.length > 0 && (
        <section>
          <SectionHeader index="12" title="What changed this week" subtitle="Brands shifting momentum or pressure" onEvidence={() => onEvidence("changes")} />
          <div className={cn(DC.card)}>
            <ul className="space-y-2 m-0 p-0 list-none">
              {intel.dailyChanges.map((row, i) => (
                <li key={row.brandDomain} className="flex justify-between gap-3 text-sm border-b border-neutral-800/80 last:border-0 pb-2 last:pb-0">
                  <span className="font-medium text-neutral-100">{brandLabel(row.brandDomain)}</span>
                  <span className={cn(DC.meta, "normal-case text-right")}>
                    {[row.marketChange, row.momentum, row.pressure].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {intel.positioningMap.length > 0 && (
        <section>
          <SectionHeader index="13" title="Category positioning map" subtitle="Share of voice vs creative intensity" onEvidence={() => onEvidence("positioning")} />
          <div className={cn(DC.card)}>
            <div className="grid gap-2 sm:grid-cols-2">
              {intel.positioningMap.map((row, i) => (
                <button
                  key={row.brand}
                  type="button"
                  onClick={() => onEvidence("positioning", i, row.brand)}
                  className="text-left py-2 px-2 rounded border border-neutral-800 hover:border-neutral-600"
                >
                  <div className="text-sm font-semibold text-neutral-100">{row.brand}</div>
                  <div className={cn(DC.meta, "mt-1 normal-case")}>
                    SOV {row.shareOfVoice ?? "—"}% · {row.placements ?? 0} placements
                    {row.topEmotion ? ` · ${row.topEmotion}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {intel.strategicActions.length > 0 && (
        <section>
          <SectionHeader
            index="14"
            title="Strategic actions"
            subtitle="Priority moves from intelligence engine"
            onEvidence={() => onEvidence("strategicActions")}
          />
          <div className={cn(DC.card, "space-y-2")}>
            {intel.strategicActions.map((a, i) => (
              <button
                key={a.action}
                type="button"
                onClick={() => onEvidence("strategicActions", i, a.action)}
                className="flex w-full gap-3 text-left text-sm text-neutral-100 hover:opacity-90"
              >
                {a.priority != null && (
                  <span className="shrink-0 w-6 h-6 rounded-full bg-amber-950 border border-amber-800/60 text-amber-400 text-xs font-semibold flex items-center justify-center">
                    {a.priority}
                  </span>
                )}
                <span>{a.action}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
