import { useCallback, useEffect, useState } from "react";
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { AdlibraryCoverageCard } from "@/components/adpalette/AdlibraryCoverageCard";
import { ClientWorkspaceEmptyState } from "@/components/adpalette/ClientWorkspaceEmptyState";
import { MarketIntelDeepSections } from "@/components/adpalette/MarketIntelDeepSections";
import { useClientWorkspace } from "@/contexts/ClientWorkspaceContext";
import { WorkspaceShell } from "./WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import {
  loadStrategistIntelligence,
  normalizeRadBrief,
  normalizeRadConfidence,
  type StrategistIntelBundle,
} from "@/lib/api-gateway";
import { getAgencyContext, type AgencyContext } from "@/lib/agency-watchlist";
import { generatePitchDeck } from "@/lib/export-pptx";
import { cn } from "@/lib/utils";
import { displayBrand } from "@/utils/brandDisplay";
import { MODULE_META, type DataModuleId, type PanelFocus } from "./strategist/data-module-types";
import { HardDataPanel } from "./strategist/HardDataPanel";
import {
  buildLouderRankList,
  buildOpenAngleCopy,
  buildRecommendedMoves,
  buildWhatThisMeans,
  isThemeAllowed,
  parseSpendRange,
  sanitizeInsightCopy,
  selectDominantTheme,
  selectSurfacedThemes,
  translateTerritory,
} from "@/lib/radInsightTranslator";
import { fetchMarketStrategistIntel, type MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import { buildMarketChannelMix } from "@/lib/channelMix";
import { fetchAdlibraryCoverage, EMPTY_COVERAGE, type AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import { safeOptional } from "@/lib/safeQuery";

const DC = {
  card: "card-dense",
  label: "dense-label",
  meta: "dense-meta",
  empty: "dense-empty",
  chip: "dense-chip",
} as const;

function SectionHeader({
  index,
  title,
  subtitle,
  onEvidence,
}: {
  index: string;
  title: string;
  subtitle?: string;
  onEvidence?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <div className={cn(DC.label, "tracking-widest")}>{index}</div>
        <h2 className="text-base font-semibold tracking-tight text-neutral-100">{title}</h2>
        {subtitle && <p className={cn(DC.meta, "mt-1 normal-case max-w-2xl")}>{subtitle}</p>}
      </div>
      {onEvidence && (
        <button
          type="button"
          onClick={onEvidence}
          className={cn(DC.chip, "shrink-0 text-neutral-400 hover:text-amber-400/90 border-neutral-700")}
        >
          Evidence
        </button>
      )}
    </div>
  );
}

function MomentumChip({ value }: { value: string | null }) {
  const v = (value ?? "").toLowerCase();
  const tone = v.includes("rising") || v.includes("accel")
    ? "text-emerald-400 border-emerald-800/80 bg-emerald-950/50"
    : v.includes("decl") || v.includes("cool")
      ? "text-rose-400 border-rose-800/80 bg-rose-950/50"
      : "text-neutral-400 border-neutral-800 bg-neutral-900";
  return <span className={cn(DC.chip, tone)}>{value ?? "—"}</span>;
}

function EmptyState({ agencyCtx }: { agencyCtx: AgencyContext | null }) {
  return (
    <div className={DC.empty}>
      <p className="text-neutral-200 font-medium mb-2">No market intel yet</p>
      <p className="text-neutral-400 text-sm leading-relaxed max-w-md mx-auto">
        {agencyCtx?.domains.size === 0
          ? "Add your client's competitors to the watchlist, then run a scan. Market Intel fills in once brands are tracked."
          : "Run a scan on your watchlist brands. You'll get a meeting-ready read on who's leading, who's getting louder, and what to recommend next."}
      </p>
    </div>
  );
}

type Brief = {
  client_name: string | null;
  category: string | null;
  headline: string | null;
  summary: string | null;
  strategic_opening: string | null;
  recommended_action: string | null;
  strongest_threat: string | null;
  fastest_mover: string | null;
  emerging_challenger: string | null;
  whitespace_category: string | null;
  whitespace_emotion: string | null;
  whitespace_score: number | null;
};

type Threat = {
  competitor_domain: string | null;
  creative_volume: number | null;
  demand: number | null;
  threat_score: number | null;
};

type Challenger = {
  brand_domain: string | null;
  keyword: string | null;
  opportunity_score: number | null;
  pressure: string | null;
  momentum: string | null;
  latest_interest: number | null;
  creative_volume: number | null;
};

type Whitespace = {
  category: string | null;
  emotion: string | null;
  strategic_priority: string | null;
  market_density: string | null;
  recommendation: string | null;
  opportunity_score: number | null;
};

type Momentum = {
  brand_domain: string | null;
  keyword: string | null;
  momentum: string | null;
  latest_interest: number | null;
  creative_volume: number | null;
  pressure: string | null;
};

type Exec = {
  dominant_market: string | null;
  strongest_brand: string | null;
  dominant_emotion: string | null;
  top_opportunity_category: string | null;
  top_opportunity_emotion: string | null;
};

type Pitch = {
  category: string | null;
  category_leader: string | null;
  dominant_emotion: string | null;
  whitespace_emotion: string | null;
  recommendation: string | null;
  action: string | null;
};

type Confidence = {
  ads_analysed: number | null;
  brands_tracked: number | null;
  trend_points: number | null;
  classification_coverage: number | null;
};

function brandLabel(domain: string | null | undefined): string {
  if (!domain) return "Unknown brand";
  return domain.replace(/^www\./, "").split(".")[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StrategistDashboard() {
  const { activeWorkspace, loading: workspaceLoading } = useClientWorkspace();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [challengers, setChallengers] = useState<Challenger[]>([]);
  const [whitespace, setWhitespace] = useState<Whitespace[]>([]);
  const [momentum, setMomentum] = useState<Momentum[]>([]);
  const [exec, setExec] = useState<Exec | null>(null);
  const [pitch, setPitch] = useState<Pitch[]>([]);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyCtx, setAgencyCtx] = useState<AgencyContext | null>(null);
  const [intelBundle, setIntelBundle] = useState<StrategistIntelBundle | null>(null);
  const [marketIntel, setMarketIntel] = useState<MarketStrategistIntel | null>(null);
  const [adlibraryCoverage, setAdlibraryCoverage] = useState<AdlibraryCoverage | null>(null);
  const [panelFocus, setPanelFocus] = useState<PanelFocus | null>(null);

  const openPanel = (moduleId: DataModuleId, rowIndex?: number, rowLabel?: string) => {
    setPanelFocus({ moduleId, rowIndex, rowLabel });
  };

  const handleExportPitch = useCallback(async () => {
    if (!intelBundle) return;
    await generatePitchDeck(intelBundle, { agencyContext: agencyCtx });
  }, [intelBundle, agencyCtx]);

  useEffect(() => {
    if (workspaceLoading) return;
    if (!activeWorkspace) {
      setLoading(false);
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      try {
        const ctx = await getAgencyContext();
        const bundle = await loadStrategistIntelligence(ctx, activeWorkspace);
        const deepIntel = await safeOptional(
          "marketStrategistIntel",
          () => fetchMarketStrategistIntel(supabase, activeWorkspace),
          { available: false, executivePack: null, competitiveGap: null, dashboardHero: null, territories: [], risks: [], meetingPrep: [], dailyChanges: [], positioningMap: [], evidencePack: [], strategicActions: [] },
        );
        const coverage = await safeOptional(
          "adlibraryCoverage",
          () => fetchAdlibraryCoverage(supabase),
          EMPTY_COVERAGE,
        );

        if (!active) return;

        setAgencyCtx(ctx);
        setIntelBundle(bundle);
        setMarketIntel(deepIntel);
        setAdlibraryCoverage(coverage);

        const normalizedBrief = normalizeRadBrief(
          bundle.brief.data as Record<string, unknown> | null,
          null,
        ) as Brief | null;

        setBrief(
          normalizedBrief ??
            ({
              client_name: activeWorkspace.client_name,
              category: activeWorkspace.category,
              headline: `${activeWorkspace.category} market intel`,
              summary: `Scoped to ${activeWorkspace.client_name} and ${activeWorkspace.competitor_domains.length} competitors.`,
            } as Brief),
        );
        setThreats((bundle.threats.data ?? []) as Threat[]);
        setChallengers((bundle.challengers.data ?? []) as Challenger[]);
        setWhitespace((bundle.whitespace.data ?? []) as Whitespace[]);
        setMomentum((bundle.momentum.data ?? []) as Momentum[]);
        setExec((bundle.executive.data ?? null) as Exec | null);
        setPitch((bundle.pitch.data ?? []) as Pitch[]);
        setConfidence(
          normalizeRadConfidence(
            bundle.pulse.data as Record<string, unknown> | null,
            bundle.confidence.data as Record<string, unknown> | null,
          ) as Confidence | null,
        );
      } catch (err) {
        console.error("[Market Intel] required load failed:", err);
        if (active) {
          setBrief({
            client_name: activeWorkspace.client_name,
            category: activeWorkspace.category,
            headline: `${activeWorkspace.category} market intel`,
            summary: "Strategist bundle unavailable — workspace context is still active.",
          } as Brief);
          setMarketIntel(null);
          setAdlibraryCoverage(EMPTY_COVERAGE);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeWorkspace, workspaceLoading]);

  if (workspaceLoading || loading) {
    return (
      <WorkspaceShell variant="dark-dense" title="Market Intel">
        <div className={cn(DC.empty, "text-center")}>
          <span className="text-neutral-400 text-sm">Loading market intel for your watchlist…</span>
        </div>
      </WorkspaceShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <WorkspaceShell variant="dark-dense" title="Market Intel">
        <ClientWorkspaceEmptyState />
      </WorkspaceShell>
    );
  }

  const leaders = [...threats]
    .sort((a, b) => (Number(b.creative_volume) || Number(b.demand) || 0) - (Number(a.creative_volume) || Number(a.demand) || 0))
    .slice(0, 5);

  const louderRank = buildLouderRankList(threats, momentum, brief?.strongest_threat);

  const openAngles = [...whitespace]
    .filter((r) => !r.emotion || isThemeAllowed(r.emotion))
    .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
    .slice(0, 4);

  const recommendedMoves = [
    ...(marketIntel?.executivePack?.recommendedAction ? [marketIntel.executivePack.recommendedAction] : []),
    ...(marketIntel?.strategicActions.map((a) => a.action) ?? []),
    ...buildRecommendedMoves(brief?.client_name),
  ].filter((v, i, arr) => v && arr.indexOf(v) === i).slice(0, 3);

  const channelMixResult = buildMarketChannelMix(intelBundle?.brief.data as Record<string, unknown> | null);
  const spendRange = parseSpendRange(intelBundle?.brief.data as Record<string, unknown> | null);

  const marketMessages = selectSurfacedThemes(
    challengers.map((c) => ({
      keyword: c.keyword,
      creative_volume: c.creative_volume,
    })),
  );
  const dominantMessage = selectDominantTheme(
    challengers.map((c) => ({ keyword: c.keyword, creative_volume: c.creative_volume })),
    exec?.dominant_emotion,
  );

  const hasAnyData =
    Boolean(activeWorkspace) ||
    brief ||
    leaders.length > 0 ||
    louderRank.length > 0 ||
    openAngles.length > 0 ||
    recommendedMoves.length > 0 ||
    exec ||
    marketIntel?.available;

  const happeningText = brief?.summary ? sanitizeInsightCopy(brief.summary) : null;

  const whatThisMeans =
    brief?.client_name && (brief?.category || exec?.dominant_market)
      ? buildWhatThisMeans({
          clientName: brief.client_name,
          category: brief.category ?? exec?.dominant_market ?? "This category",
          dominantTheme: exec?.dominant_emotion ?? "trust",
          openTheme: exec?.top_opportunity_emotion ?? brief.whitespace_emotion,
        })
      : null;

  const hardDataPayload = {
    threats,
    challengers,
    whitespace,
    momentum,
    exec,
    pitch,
    agencyId: agencyCtx?.agencyId ?? null,
    marketIntel,
    channelMix: channelMixResult,
    adlibraryCoverage,
    confidence,
    brief,
    workspace: activeWorkspace
      ? {
          client_name: activeWorkspace.client_name,
          client_domain: activeWorkspace.client_domain,
          competitor_domains: activeWorkspace.competitor_domains,
          category: activeWorkspace.category,
        }
      : null,
    recommendedMoves,
    intelBundle,
  };

  return (
    <WorkspaceShell
      variant="dark-dense"
      title="Market Intel"
      subtitle={`${activeWorkspace.client_name} · ${activeWorkspace.category} — what your client faces, what competitors are doing, and what to say in tomorrow's meeting`}
      onExportPitch={handleExportPitch}
      exportPitchDisabled={!intelBundle}
    >
      <div className="space-y-8">
        {activeWorkspace && activeWorkspace.competitor_domains.length > 0 && (
          <section className="flex flex-wrap items-center gap-2">
            <span className="dense-meta text-neutral-400 text-xs uppercase tracking-wide">Competitors</span>
            {activeWorkspace.competitor_domains.map((d) => (
              <a
                key={d}
                href={`/app/advertiser/${d}`}
                className="dense-chip text-xs px-2 py-1 rounded-md border border-neutral-700 text-neutral-200 hover:border-amber-600"
              >
                {displayBrand(d)}
              </a>
            ))}
          </section>
        )}

        {/* 01 — What's happening */}
        {(brief?.headline || happeningText || whatThisMeans) && (
          <section>
            <SectionHeader
              index={MODULE_META.executive.index}
              title={MODULE_META.executive.title}
              subtitle={MODULE_META.executive.subtitle}
              onEvidence={() => openPanel("executive")}
            />
            <div className={cn(DC.card, "space-y-3")}>
              {(brief?.client_name || brief?.category) && (
                <div className={cn(DC.meta, "uppercase tracking-wider")}>
                  {[brief?.client_name, brief?.category].filter(Boolean).join(" · ")}
                </div>
              )}
              {brief?.headline && (
                <h1 className="text-xl md:text-2xl font-semibold tracking-tight leading-snug text-neutral-50">
                  {sanitizeInsightCopy(brief.headline)}
                </h1>
              )}
              {whatThisMeans && (
                <div className="space-y-1">
                  <div className={cn(DC.label, "text-amber-400/90")}>What this means</div>
                  <p className="text-sm leading-relaxed text-neutral-200 max-w-3xl">{whatThisMeans}</p>
                </div>
              )}
              {happeningText && (
                <p className="text-sm leading-relaxed text-neutral-400 max-w-3xl">{happeningText}</p>
              )}
              {confidence && (confidence.ads_analysed != null || confidence.brands_tracked != null) && (
                <div className={cn(DC.meta, "pt-2 border-t border-neutral-800 flex flex-wrap gap-x-4 gap-y-1")}>
                  {confidence.brands_tracked != null && (
                    <span>{confidence.brands_tracked.toLocaleString()} brands tracked</span>
                  )}
                  {confidence.ads_analysed != null && (
                    <span>{confidence.ads_analysed.toLocaleString()} ads analysed</span>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 02 — Who is leading */}
        {(exec?.strongest_brand || leaders.length > 0) && (
          <section>
            <SectionHeader
              index={MODULE_META.competitors.index}
              title={MODULE_META.competitors.title}
              subtitle={MODULE_META.competitors.subtitle}
              onEvidence={() => openPanel("competitors")}
            />
            <div className={cn(DC.card, "space-y-4")}>
              {exec?.strongest_brand && (
                <p className="text-sm text-neutral-200 leading-relaxed">
                  <span className="font-semibold text-neutral-50">{exec.strongest_brand}</span>
                  {exec.dominant_market ? ` is leading observed activity in ${exec.dominant_market}.` : " is leading observed activity in this category."}
                </p>
              )}
              {leaders.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {leaders.map((r, i) => (
                    <button
                      key={r.competitor_domain ?? i}
                      type="button"
                      onClick={() => openPanel("competitors", i, r.competitor_domain ?? undefined)}
                      className={cn(DC.card, "text-left py-2 px-3 hover:border-neutral-600 transition-colors")}
                    >
                      <div className="text-sm font-semibold text-neutral-100 truncate">
                        {brandLabel(r.competitor_domain)}
                      </div>
                      <div className={cn(DC.meta, "mt-1")}>
                        {r.creative_volume != null
                          ? `${Number(r.creative_volume).toLocaleString()} active creatives`
                          : r.demand != null
                            ? `${Number(r.demand).toLocaleString()} observed demand signals`
                            : "Tracked competitor"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 03 — Who is getting louder */}
        {louderRank.length > 0 && (
          <section>
            <SectionHeader
              index={MODULE_META.momentum.index}
              title={MODULE_META.momentum.title}
              subtitle={MODULE_META.momentum.subtitle}
              onEvidence={() => openPanel("momentum")}
            />
            <div className={cn(DC.card)}>
              <ul className="space-y-2">
                {louderRank.map((row, i) => (
                  <li
                    key={row.brand}
                    className="flex items-center justify-between gap-3 text-sm border-b border-neutral-800/80 last:border-0 pb-2 last:pb-0"
                  >
                    <span className="font-medium text-neutral-100">
                      {brandLabel(row.brand)}
                    </span>
                    <MomentumChip value={row.label} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* Channel mix */}
        <section>
          <SectionHeader
            index="03b"
            title="Where activity is showing up"
            subtitle="Channel share across observed category activity"
            onEvidence={() => openPanel("channelMix")}
          />
          <div className={cn(DC.card)}>
            <ChannelMixBars
              rows={channelMixResult.rows}
              overallConfidence={channelMixResult.overallConfidence}
              sourceLabel={channelMixResult.sourceLabel}
              estimationTooltip={channelMixResult.estimationTooltip}
              variant="dark"
              animate={false}
            />
          </div>
        </section>

        {/* Spend / activity estimate */}
        <section>
          <SectionHeader
            index="03c"
            title="Spend / activity estimate"
            subtitle="Directional range from observed activity — not verified media spend"
          />
          <div className={cn(DC.card)}>
            {spendRange ? (
              <p className="text-sm font-medium text-neutral-100">{spendRange.label}</p>
            ) : (
              <p className="text-sm text-neutral-300">Spend estimate unavailable for this view.</p>
            )}
          </div>
        </section>

        {/* 04 — What the market keeps saying */}
        {(marketMessages.length > 0 || dominantMessage) && (
          <section>
            <SectionHeader
              index={MODULE_META.challengers.index}
              title={MODULE_META.challengers.title}
              subtitle={MODULE_META.challengers.subtitle}
              onEvidence={() => openPanel("challengers")}
            />
            <div className={cn(DC.card)}>
              {dominantMessage && (
                <p className="text-sm text-neutral-200 leading-relaxed mb-3">
                  The market keeps coming back to{" "}
                  <span className="font-semibold text-neutral-50">{dominantMessage}</span>.
                  {contestedGround(pitch) ? " Most brands are fighting over the same angle." : " Few brands own a distinct message yet."}
                </p>
              )}
              {marketMessages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {marketMessages.map((msg) => (
                    <span key={msg} className={cn(DC.chip, "text-neutral-200 border-neutral-700")}>
                      {msg}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* 05 — What nobody owns yet */}
        {openAngles.length > 0 && (
          <section>
            <SectionHeader
              index={MODULE_META.whitespace.index}
              title={MODULE_META.whitespace.title}
              subtitle={MODULE_META.whitespace.subtitle}
              onEvidence={() => openPanel("whitespace")}
            />
            <div className="grid gap-2 md:grid-cols-2">
              {openAngles.map((r, i) => {
                const territoryLabel = translateTerritory(r.emotion);
                const saturated = (r.market_density ?? "").toLowerCase() === "high"
                  || (r.strategic_priority ?? "").toLowerCase() === "saturated";
                const body = buildOpenAngleCopy({
                  clientName: brief?.client_name ?? "Your client",
                  territoryRaw: r.emotion ?? "",
                  brandCount: undefined,
                  saturated,
                });
                return (
                  <button
                    key={`${r.category}-${r.emotion}-${i}`}
                    type="button"
                    onClick={() => openPanel("whitespace", i, territoryLabel)}
                    className={cn(DC.card, "text-left py-3 px-3 hover:border-emerald-800/50 transition-colors")}
                  >
                    <div className="text-sm font-medium text-neutral-100">{territoryLabel}</div>
                    <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{body}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 06 — Recommended next moves */}
        {recommendedMoves.length > 0 && (
          <section>
            <SectionHeader
              index={MODULE_META.pitch.index}
              title={MODULE_META.pitch.title}
              subtitle={MODULE_META.pitch.subtitle}
              onEvidence={() => openPanel("pitch")}
            />
            <div className={cn(DC.card, "bg-neutral-950 border-amber-800/40 space-y-3")}>
              <ol className="space-y-3 list-none m-0 p-0">
                {recommendedMoves.map((move, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-neutral-100">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-amber-950 border border-amber-800/60 text-amber-400 text-xs font-semibold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span>{move}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <AdlibraryCoverageCard
          coverage={adlibraryCoverage}
          onEvidence={() => openPanel("adlibrary")}
        />

        <MarketIntelDeepSections
          intel={marketIntel}
          onEvidence={(moduleId, rowIndex, rowLabel) => openPanel(moduleId, rowIndex, rowLabel)}
        />

        {!hasAnyData && <EmptyState agencyCtx={agencyCtx} />}
      </div>

      <HardDataPanel focus={panelFocus} onClose={() => setPanelFocus(null)} data={hardDataPayload} />
    </WorkspaceShell>
  );
}

function contestedGround(pitchRows: Pitch[]): boolean {
  const emotions = pitchRows.map((p) => p.dominant_emotion).filter(Boolean);
  if (emotions.length < 2) return false;
  const unique = new Set(emotions);
  return unique.size <= emotions.length / 2;
}
