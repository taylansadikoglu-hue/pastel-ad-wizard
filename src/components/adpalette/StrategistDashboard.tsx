import { useCallback, useEffect, useState } from "react";
import { WorkspaceShell } from "./WorkspaceShell";
import {
  loadStrategistIntelligence,
  normalizeRadBrief,
  normalizeRadConfidence,
  type StrategistIntelBundle,
} from "@/lib/api-gateway";
import { getAgencyContext, type AgencyContext } from "@/lib/agency-watchlist";
import { generatePitchDeck } from "@/lib/export-pptx";
import { cn } from "@/lib/utils";
import { MODULE_META, type PanelFocus } from "./strategist/data-module-types";
import { HardDataPanel } from "./strategist/HardDataPanel";
import { selectDominantTheme, selectSurfacedThemes, isThemeAllowed } from "@/lib/radInsightTranslator";

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
  const [panelFocus, setPanelFocus] = useState<PanelFocus | null>(null);

  const hardDataPayload = {
    threats,
    challengers,
    whitespace,
    momentum,
    exec,
    pitch,
    agencyId: agencyCtx?.agencyId ?? null,
  };

  const openPanel = (moduleId: PanelFocus["moduleId"], rowIndex?: number, rowLabel?: string) => {
    setPanelFocus({ moduleId, rowIndex, rowLabel });
  };

  const handleExportPitch = useCallback(async () => {
    if (!intelBundle) return;
    await generatePitchDeck(intelBundle, { agencyContext: agencyCtx });
  }, [intelBundle, agencyCtx]);

  useEffect(() => {
    let active = true;
    (async () => {
      const ctx = await getAgencyContext();
      const bundle = await loadStrategistIntelligence(ctx);
      if (!active) return;

      setAgencyCtx(ctx);
      setIntelBundle(bundle);
      setBrief(normalizeRadBrief(bundle.brief.data as Record<string, unknown> | null, null) as Brief | null);
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
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <WorkspaceShell variant="dark-dense" title="Market Intel">
        <div className={cn(DC.empty, "text-center")}>
          <span className="text-neutral-400 text-sm">Loading market intel for your watchlist…</span>
        </div>
      </WorkspaceShell>
    );
  }

  const leaders = [...threats]
    .sort((a, b) => (Number(b.creative_volume) || Number(b.demand) || 0) - (Number(a.creative_volume) || Number(a.demand) || 0))
    .slice(0, 5);

  const pressureBrands = [...threats]
    .sort((a, b) => (Number(b.threat_score) || 0) - (Number(a.threat_score) || 0))
    .slice(0, 5);

  const gettingLouder = [...momentum]
    .sort((a, b) => (Number(b.latest_interest) || 0) - (Number(a.latest_interest) || 0))
    .slice(0, 6);

  const risingChallengers = [...challengers]
    .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
    .slice(0, 4);

  const openAngles = [...whitespace]
    .filter((r) => !r.emotion || isThemeAllowed(r.emotion))
    .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
    .slice(0, 5);

  const actionablePitch = pitch.filter((r) => r.action && r.recommendation);

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
    brief ||
    leaders.length > 0 ||
    gettingLouder.length > 0 ||
    openAngles.length > 0 ||
    actionablePitch.length > 0 ||
    exec;

  const happeningText =
    brief?.summary ??
    (exec?.dominant_market
      ? `${exec.dominant_market} is active right now. ${exec.strongest_brand ? `${exec.strongest_brand} is setting the pace.` : "Leadership is still consolidating."}`
      : null);

  return (
    <WorkspaceShell
      variant="dark-dense"
      title="Market Intel"
      subtitle="What your client faces, what competitors are doing, and what to say in tomorrow's meeting"
      onExportPitch={handleExportPitch}
      exportPitchDisabled={!intelBundle}
    >
      <div className="space-y-8">
        {/* 01 — What's happening */}
        {(brief?.headline || happeningText) && (
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
                  {brief.headline}
                </h1>
              )}
              {happeningText && (
                <p className="text-sm leading-relaxed text-neutral-300 max-w-3xl">{happeningText}</p>
              )}
              {brief?.strategic_opening && (
                <p className="text-sm leading-relaxed text-neutral-400 border-l-2 border-amber-600/60 pl-3">
                  {brief.strategic_opening}
                </p>
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
        {(gettingLouder.length > 0 || risingChallengers.length > 0 || pressureBrands.length > 0) && (
          <section>
            <SectionHeader
              index={MODULE_META.momentum.index}
              title={MODULE_META.momentum.title}
              subtitle={MODULE_META.momentum.subtitle}
              onEvidence={() => openPanel("momentum")}
            />
            <div className="space-y-3">
              {pressureBrands.length > 0 && (
                <div className={cn(DC.card)}>
                  <div className={cn(DC.label, "mb-2 text-rose-400/90")}>Who&apos;s putting the most pressure</div>
                  <ul className="space-y-2">
                    {pressureBrands.map((r, i) => (
                      <li key={r.competitor_domain ?? i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-neutral-100">{brandLabel(r.competitor_domain)}</span>
                        <MomentumChip value={i === 0 && brief?.strongest_threat ? "Highest pressure" : r.demand != null ? "Active spend" : null} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                {gettingLouder.map((r, i) => (
                  <button
                    key={r.brand_domain ?? r.keyword ?? i}
                    type="button"
                    onClick={() => openPanel("momentum", i, r.brand_domain ?? undefined)}
                    className={cn(DC.card, "text-left py-2 px-3 hover:border-neutral-600 transition-colors")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-100 truncate">
                        {brandLabel(r.brand_domain)}
                      </span>
                      <MomentumChip value={r.momentum} />
                    </div>
                    {r.keyword && <div className={cn(DC.meta, "mt-1 truncate")}>Rising on: {r.keyword}</div>}
                  </button>
                ))}
                {risingChallengers.map((r, i) => (
                  <button
                    key={`ch-${r.brand_domain ?? r.keyword ?? i}`}
                    type="button"
                    onClick={() => openPanel("challengers", i, r.brand_domain ?? r.keyword ?? undefined)}
                    className={cn(DC.card, "text-left py-2 px-3 hover:border-neutral-600 transition-colors border-amber-900/40")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-neutral-100 truncate">
                        {brandLabel(r.brand_domain) || r.keyword}
                      </span>
                      <MomentumChip value={r.momentum ?? "Emerging"} />
                    </div>
                    {brief?.emerging_challenger &&
                      r.brand_domain?.toLowerCase().includes(brief.emerging_challenger.toLowerCase()) && (
                        <div className={cn(DC.meta, "mt-1 text-amber-400/80")}>Watch this brand</div>
                      )}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

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
                  <span className="font-semibold text-neutral-50 capitalize">{dominantMessage}</span>.
                  {contestedGround(pitch) ? ` Most brands are fighting over the same angle.` : " Few brands own a distinct message yet."}
                </p>
              )}
              {marketMessages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {marketMessages.map((msg) => (
                    <span key={msg} className={cn(DC.chip, "text-neutral-200 border-neutral-700 capitalize")}>
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
                const label = [r.category, r.emotion].filter(Boolean).join(" · ");
                return (
                  <button
                    key={`${r.category}-${r.emotion}-${i}`}
                    type="button"
                    onClick={() => openPanel("whitespace", i, label || undefined)}
                    className={cn(DC.card, "text-left py-3 px-3 hover:border-emerald-800/50 transition-colors")}
                  >
                    <div className={cn(DC.label, "text-emerald-400/90 mb-1")}>Angles nobody is owning</div>
                    <div className="text-sm font-medium text-neutral-100">{label || "Unclaimed positioning"}</div>
                    {r.recommendation && (
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed line-clamp-3">{r.recommendation}</p>
                    )}
                    {brief?.whitespace_emotion && r.emotion?.toLowerCase() === brief.whitespace_emotion.toLowerCase() && (
                      <div className={cn(DC.meta, "mt-2 text-emerald-400/80")}>Best fit for your client</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 06 — What I'd recommend tomorrow */}
        {(brief?.recommended_action || actionablePitch.length > 0) && (
          <section>
            <SectionHeader
              index={MODULE_META.pitch.index}
              title={MODULE_META.pitch.title}
              subtitle={MODULE_META.pitch.subtitle}
              onEvidence={() => openPanel("pitch")}
            />
            <div className="space-y-3">
              {brief?.recommended_action && (
                <div className={cn(DC.card, "bg-neutral-950 border-amber-800/40")}>
                  <div className={cn(DC.label, "mb-2 text-amber-400/90")}>Recommended next moves</div>
                  <p className="text-sm font-medium leading-relaxed text-neutral-100">{brief.recommended_action}</p>
                </div>
              )}
              {actionablePitch.map((r, i) => {
                const pitchIndex = pitch.indexOf(r);
                return (
                  <button
                    key={`${r.category}-${r.action}-${i}`}
                    type="button"
                    onClick={() => openPanel("pitch", pitchIndex >= 0 ? pitchIndex : i, r.category ?? undefined)}
                    className={cn(DC.card, "text-left w-full hover:border-neutral-600 transition-colors")}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={cn(DC.meta)}>{r.category ?? "Category"}</span>
                      <span className={cn(DC.chip, "text-amber-400 border-amber-800/80 shrink-0")}>{r.action}</span>
                    </div>
                    <p className="text-sm text-neutral-200 leading-relaxed">{r.recommendation}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

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
