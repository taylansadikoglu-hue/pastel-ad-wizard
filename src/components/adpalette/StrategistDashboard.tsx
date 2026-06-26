import { useEffect, useState } from "react";
import { WorkspaceShell } from "./WorkspaceShell";
import {
  loadStrategistIntelligence,
  normalizeBarbsBrief,
  normalizeBarbsConfidence,
} from "@/lib/api-gateway";
import { getAgencyContext, type AgencyContext } from "@/lib/agency-watchlist";
import { cn } from "@/lib/utils";

/** Shared dark-dense cockpit tokens */
const DC = {
  card: "card-dense",
  label: "dense-label",
  meta: "dense-meta",
  empty: "dense-empty",
  border: "border border-neutral-800",
  surface: "bg-neutral-900",
  chip: "dense-chip",
} as const;

function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <div>
        <div className={cn(DC.label, "tracking-widest")}>{index}</div>
        <h2 className="text-base font-semibold tracking-tight text-neutral-100">{title}</h2>
      </div>
      {subtitle && <div className={cn(DC.meta, "uppercase tracking-wide text-right max-w-[45%]")}>{subtitle}</div>}
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
  return (
    <span className={cn(DC.chip, tone)}>
      {value ?? "—"}
    </span>
  );
}

function PriorityChip({ priority }: { priority: string | null }) {
  const p = (priority ?? "").toLowerCase();
  const tone = p.includes("emerging")
    ? "text-emerald-400 border-emerald-800/80 bg-emerald-950/50"
    : p.includes("competitive")
      ? "text-amber-400 border-amber-800/80 bg-amber-950/50"
      : "text-neutral-400 border-neutral-800 bg-neutral-900";
  return (
    <span className={cn(DC.chip, tone)}>
      {priority ?? "—"}
    </span>
  );
}

function EvidenceBlock({ items }: { items: { label: string; value: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-auto pt-2 border-t border-neutral-800">
      <div className={cn(DC.label, "mb-2")}>Why BARBS Thinks This</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {items.map((it) => (
          <div key={it.label}>
            <div className="text-xs font-semibold tracking-tight truncate text-neutral-100" title={it.value}>
              {it.value}
            </div>
            <div className={cn(DC.label, "mt-0.5 normal-case")}>{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ agencyCtx }: { agencyCtx: AgencyContext | null }) {
  return (
    <div className={DC.empty}>
      <p className="text-neutral-400 uppercase tracking-wider text-[10px] mb-2">No data found</p>
      <p>
        {`// agency_id=${agencyCtx?.agencyId ?? "null"} · watchlist_domains=${agencyCtx?.domains.size ?? 0}`}
      </p>
      <p className="mt-2 text-neutral-500">
        {agencyCtx?.domains.size === 0
          ? "> add brands to agency_watchlist to scope BARBS"
          : "> run scan on watchlist domains to populate threat cards"}
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

  useEffect(() => {
    let active = true;
    (async () => {
      const ctx = await getAgencyContext();
      const bundle = await loadStrategistIntelligence(ctx);
      if (!active) return;

      setAgencyCtx(ctx);

      const briefRow = (() => {
        const { data, metadata } = bundle.brief;
        if (!data) return null;
        if (metadata.source.startsWith("supabase:")) return data as Brief;
        return normalizeBarbsBrief(data as Record<string, unknown>, null) as Brief;
      })();

      const domains = ctx.domains;
      const scopedBrief =
        briefRow &&
        (briefRow.client_name == null ||
          [...domains].some((d) =>
            briefRow.client_name?.toLowerCase().includes(d.split(".")[0] ?? ""),
          ))
          ? briefRow
          : domains.size > 0
            ? briefRow
            : null;

      setBrief(scopedBrief);
      setThreats((bundle.threats.data ?? []) as Threat[]);
      setChallengers((bundle.challengers.data ?? []) as Challenger[]);
      setWhitespace((bundle.whitespace.data ?? []) as Whitespace[]);
      setMomentum((bundle.momentum.data ?? []) as Momentum[]);
      setExec((bundle.executive.data ?? null) as Exec | null);
      setPitch((bundle.pitch.data ?? []) as Pitch[]);
      setConfidence(
        normalizeBarbsConfidence(
          bundle.pulse.status === "ok" ? (bundle.pulse.data as Record<string, unknown>) : null,
          bundle.confidence.metadata.source.startsWith("supabase:")
            ? (bundle.confidence.data as Confidence | null)
            : null,
        ) as Confidence | null,
      );
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <WorkspaceShell variant="dark-dense" title="BARBS Morning Brief">
        <div className={cn(DC.empty, "text-center")}>
          <span className="text-neutral-500">{">"} loading intelligence stream…</span>
        </div>
      </WorkspaceShell>
    );
  }

  const topThreats = [...threats]
    .sort((a, b) => (Number(b.threat_score) || 0) - (Number(a.threat_score) || 0))
    .slice(0, 5);

  const topChallengers = [...challengers]
    .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
    .slice(0, 6);

  const topWhitespace = [...whitespace]
    .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
    .slice(0, 6);

  const watchlist = [...momentum]
    .sort((a, b) => (Number(b.latest_interest) || 0) - (Number(a.latest_interest) || 0))
    .slice(0, 8);

  const actionablePitch = pitch.filter((r) => r.action && r.recommendation);

  // Competitor analytics
  const threatVals = topThreats.map((r) => Number(r.threat_score) || 0);
  const demandVals = topThreats.map((r) => Number(r.demand) || 0);
  const creativeVals = topThreats.map((r) => Number(r.creative_volume) || 0);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
  const avgThreat = avg(threatVals);
  const avgDemand = avg(demandVals);
  const avgCreative = avg(creativeVals);
  const maxThreat = max(threatVals);
  const maxDemand = max(demandVals);
  const maxCreative = max(creativeVals);

  const pct = (v: number, m: number) => (m > 0 ? Math.min(100, Math.round((v / m) * 100)) : 0);
  const delta = (v: number, a: number) => (a > 0 ? Math.round(((v - a) / a) * 100) : 0);

  // Evidence behind each BARBS conclusion — live data only
  const threatTarget =
    topThreats.find(
      (t) =>
        t.competitor_domain &&
        brief?.strongest_threat &&
        t.competitor_domain.toLowerCase().includes(brief.strongest_threat.toLowerCase()),
    ) || topThreats[0];
  const threatRank = threatTarget
    ? topThreats.findIndex((t) => t.competitor_domain === threatTarget.competitor_domain) + 1
    : 0;
  const threatEvidence = threatTarget
    ? ([
        threatRank > 0 ? { label: "Threat Rank", value: `#${String(threatRank).padStart(2, "0")}` } : null,
        threatTarget.threat_score != null
          ? { label: "Threat Score", value: Number(threatTarget.threat_score).toFixed(1) }
          : null,
        threatTarget.demand != null
          ? { label: "Demand", value: Number(threatTarget.demand).toLocaleString() }
          : null,
        threatTarget.threat_score != null && avgThreat > 0
          ? {
              label: "vs Market Avg",
              value: `${delta(Number(threatTarget.threat_score), avgThreat) >= 0 ? "+" : ""}${delta(Number(threatTarget.threat_score), avgThreat)}%`,
            }
          : null,
      ].filter(Boolean) as { label: string; value: string }[])
    : [];

  const challengerTarget =
    topChallengers.find(
      (c) =>
        c.brand_domain &&
        brief?.emerging_challenger &&
        c.brand_domain.toLowerCase().includes(brief.emerging_challenger.toLowerCase()),
    ) || topChallengers[0];
  const challengerEvidence = challengerTarget
    ? ([
        challengerTarget.opportunity_score != null
          ? { label: "Opportunity Score", value: Number(challengerTarget.opportunity_score).toFixed(1) }
          : null,
        challengerTarget.momentum ? { label: "Momentum", value: challengerTarget.momentum } : null,
        challengerTarget.creative_volume != null
          ? { label: "Creative Volume", value: Number(challengerTarget.creative_volume).toLocaleString() }
          : null,
        challengerTarget.latest_interest != null
          ? { label: "Search Interest", value: Number(challengerTarget.latest_interest).toLocaleString() }
          : null,
      ].filter(Boolean) as { label: string; value: string }[])
    : [];

  const openingTarget =
    topWhitespace.find(
      (w) =>
        w.emotion &&
        brief?.whitespace_emotion &&
        w.emotion.toLowerCase() === brief.whitespace_emotion.toLowerCase(),
    ) || topWhitespace[0];
  const openingEvidence = openingTarget
    ? ([
        openingTarget.opportunity_score != null
          ? { label: "Opportunity Score", value: Number(openingTarget.opportunity_score).toFixed(1) }
          : null,
        openingTarget.market_density
          ? { label: "Competitive Density", value: openingTarget.market_density }
          : null,
        openingTarget.category ? { label: "Category", value: openingTarget.category } : null,
        openingTarget.strategic_priority
          ? { label: "Priority", value: openingTarget.strategic_priority }
          : null,
      ].filter(Boolean) as { label: string; value: string }[])
    : [];

  const insightFor = (r: Threat): string | null => {
    const d = Number(r.demand) || 0;
    const c = Number(r.creative_volume) || 0;
    const others = topThreats.filter((x) => x.competitor_domain !== r.competitor_domain);
    // Similar demand, lower creative
    const similarDemand = others.find((x) => {
      const xd = Number(x.demand) || 0;
      const xc = Number(x.creative_volume) || 0;
      return d > 0 && xd > 0 && Math.abs(xd - d) / Math.max(xd, d) < 0.2 && c < xc * 0.6;
    });
    if (similarDemand) {
      return `Generates similar demand to ${similarDemand.competitor_domain} with significantly lower creative volume.`;
    }
    if (d > avgDemand * 1.4 && c < avgCreative * 0.7 && avgCreative > 0) {
      return `Above-average demand on below-average creative output — efficient share capture.`;
    }
    if (c > avgCreative * 1.4 && d < avgDemand * 0.8 && avgDemand > 0) {
      return `High creative volume but underperforming on demand — diminishing returns.`;
    }
    return null;
  };

  const confidenceFor = (r: Threat): { label: string; tone: string } => {
    const signals = [r.threat_score, r.demand, r.creative_volume].filter((v) => Number(v) > 0).length;
    if (signals >= 3) return { label: "High", tone: "text-emerald-400 border-emerald-800/80 bg-emerald-950/50" };
    if (signals === 2) return { label: "Medium", tone: "text-amber-400 border-amber-800/80 bg-amber-950/50" };
    return { label: "Low", tone: "text-neutral-400 border-neutral-800 bg-neutral-900" };
  };

  return (
    <WorkspaceShell
      variant="dark-dense"
      title="BARBS Morning Brief"
      subtitle="Senior strategy director read · live agency scope"
    >
      <div className="space-y-6">
        {brief && (brief.headline || brief.summary) && (
          <section>
            <div className="space-y-4">
              <div className="flex items-center gap-2 dense-meta uppercase tracking-wider">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                <span>Today&apos;s Brief</span>
                <span className="text-neutral-600">·</span>
                <span>{brief.client_name ?? "Client"}</span>
                {brief.category && <><span className="text-neutral-600">·</span><span>{brief.category}</span></>}
              </div>

              {brief.headline && (
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight max-w-4xl text-neutral-50">
                  {brief.headline}
                </h1>
              )}
              {brief.summary && (
                <p className="text-sm leading-snug text-neutral-400 max-w-3xl">
                  {brief.summary}
                </p>
              )}

              <div className="grid md:grid-cols-3 gap-2 pt-1">
                {brief.strongest_threat && (
                  <div className={cn(DC.card, "flex flex-col gap-2")}>
                    <div className="flex items-center gap-2 dense-label text-rose-400">
                      <span className="inline-block size-1.5 rounded-full bg-rose-500" />
                      Strongest Threat
                    </div>
                    <div className="text-lg font-semibold tracking-tight truncate text-neutral-100" title={brief.strongest_threat}>
                      {brief.strongest_threat}
                    </div>
                    <EvidenceBlock items={threatEvidence} />
                  </div>
                )}
                {brief.emerging_challenger && (
                  <div className={cn(DC.card, "flex flex-col gap-2")}>
                    <div className="flex items-center gap-2 dense-label text-amber-400">
                      <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                      Emerging Challenger
                    </div>
                    <div className="text-lg font-semibold tracking-tight truncate text-neutral-100" title={brief.emerging_challenger}>
                      {brief.emerging_challenger}
                    </div>
                    <EvidenceBlock items={challengerEvidence} />
                  </div>
                )}
                {(brief.strategic_opening || brief.whitespace_emotion) && (
                  <div className={cn(DC.card, "flex flex-col gap-2")}>
                    <div className="flex items-center gap-2 dense-label text-emerald-400">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                      Strategic Opening
                    </div>
                    {brief.strategic_opening ? (
                      <p className="text-sm leading-snug font-medium text-neutral-200">{brief.strategic_opening}</p>
                    ) : (
                      <div className="text-lg font-semibold tracking-tight text-neutral-100">{brief.whitespace_emotion}</div>
                    )}
                    <EvidenceBlock items={openingEvidence} />
                  </div>
                )}
              </div>

              {brief.recommended_action && (
                <div className={cn(DC.card, "bg-neutral-950 border-neutral-700 p-3")}>
                  <div className={cn(DC.label, "mb-1 text-amber-500/90")}>Recommended Action</div>
                  <p className="text-sm font-medium leading-snug text-neutral-100 max-w-4xl">
                    {brief.recommended_action}
                  </p>
                </div>
              )}

              {confidence && (confidence.ads_analysed != null || confidence.brands_tracked != null || confidence.trend_points != null || confidence.classification_coverage != null) && (
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className={DC.label}>Confidence</span>
                    <span className={cn(DC.chip, "text-emerald-400 border-emerald-800/80 bg-emerald-950/50")}>
                      High
                    </span>
                  </div>
                  {confidence.ads_analysed != null && (
                    <div>
                      <div className="text-lg font-semibold tracking-tight tabular-nums text-neutral-100">{confidence.ads_analysed.toLocaleString()}</div>
                      <div className={cn(DC.label, "mt-0.5")}>Creatives</div>
                    </div>
                  )}
                  {confidence.brands_tracked != null && (
                    <div>
                      <div className="text-lg font-semibold tracking-tight tabular-nums text-neutral-100">{confidence.brands_tracked.toLocaleString()}</div>
                      <div className={cn(DC.label, "mt-0.5")}>Brands</div>
                    </div>
                  )}
                  {confidence.trend_points != null && (
                    <div>
                      <div className="text-lg font-semibold tracking-tight tabular-nums text-neutral-100">{confidence.trend_points.toLocaleString()}</div>
                      <div className={cn(DC.label, "mt-0.5")}>Trend points</div>
                    </div>
                  )}
                  {confidence.classification_coverage != null && (
                    <div>
                      <div className="text-lg font-semibold tracking-tight tabular-nums text-neutral-100">{Number(confidence.classification_coverage).toFixed(0)}%</div>
                      <div className={cn(DC.label, "mt-0.5")}>Coverage</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {topThreats.length > 0 && (
          <section>
            <SectionHeader index="01" title="Competitors" subtitle="agency_watchlist → client_threats" />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {topThreats.map((r, i) => {
                const t = Number(r.threat_score) || 0;
                const d = Number(r.demand) || 0;
                const c = Number(r.creative_volume) || 0;
                const dT = delta(t, avgThreat);
                const dD = delta(d, avgDemand);
                const conf = confidenceFor(r);
                const insight = insightFor(r);
                return (
                  <div key={i} className={cn(DC.card, "space-y-3")}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(DC.chip, "font-bold text-neutral-200 shrink-0")}>
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="font-semibold truncate text-sm text-neutral-100" title={r.competitor_domain ?? ""}>
                          {r.competitor_domain ?? "—"}
                        </div>
                      </div>
                      <span className={cn(DC.chip, conf.tone)}>{conf.label}</span>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <div className={DC.label}>Threat Score</div>
                        {dT !== 0 && avgThreat > 0 && (
                          <span className={cn(DC.meta, dT > 0 ? "text-rose-400" : "text-emerald-400")}>
                            {dT > 0 ? "+" : ""}{dT}% vs avg
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-semibold tracking-tight tabular-nums text-neutral-50">{t || "—"}</div>
                      <div className="mt-1 h-0.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                        <div className="h-full bg-neutral-200" style={{ width: `${pct(t, maxThreat)}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-baseline justify-between mb-0.5">
                          <div className={DC.label}>Demand</div>
                          {dD !== 0 && avgDemand > 0 && (
                            <span className={cn(DC.meta, dD > 0 ? "text-emerald-400" : "text-neutral-500")}>
                              {dD > 0 ? "+" : ""}{dD}%
                            </span>
                          )}
                        </div>
                        <div className="text-base font-semibold tabular-nums text-neutral-100">{d}</div>
                        <div className="mt-1 h-0.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                          <div className="h-full bg-emerald-600" style={{ width: `${pct(d, maxDemand)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className={cn(DC.label, "mb-0.5")}>Creative</div>
                        <div className="text-base font-semibold tabular-nums text-neutral-100">{c}</div>
                        <div className="mt-1 h-0.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                          <div className="h-full bg-amber-600" style={{ width: `${pct(c, maxCreative)}%` }} />
                        </div>
                      </div>
                    </div>

                    {insight && (
                      <div className="pt-1 text-xs leading-snug text-neutral-400 border-t border-neutral-800">
                        <span className={cn(DC.label, "block mb-0.5")}>Insight</span>
                        {insight}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {topChallengers.length > 0 && (
          <section>
            <SectionHeader index="02" title="Emerging Challengers" subtitle="brand_opportunities" />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {topChallengers.map((r, i) => (
                <div key={i} className={DC.card}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="font-semibold truncate text-sm text-neutral-100" title={r.brand_domain ?? ""}>{r.brand_domain ?? "—"}</div>
                    <MomentumChip value={r.momentum} />
                  </div>
                  {r.keyword && (
                    <div className="text-xs mb-2 text-neutral-400">around <span className="font-medium text-neutral-200">{r.keyword}</span></div>
                  )}
                  <div className="grid grid-cols-3 gap-y-0.5 text-xs">
                    <span className={DC.label}>Opportunity</span>
                    <span className="col-span-2 text-right font-medium tabular-nums text-neutral-100">{r.opportunity_score ?? 0}</span>
                    <span className={DC.label}>Interest</span>
                    <span className="col-span-2 text-right tabular-nums text-neutral-300">{r.latest_interest ?? 0}</span>
                    <span className={DC.label}>Creative</span>
                    <span className="col-span-2 text-right tabular-nums text-neutral-300">{r.creative_volume ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {topWhitespace.length > 0 && (
          <section>
            <SectionHeader index="03" title="Strategic Whitespace" subtitle="top_opportunities" />
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {topWhitespace.map((r, i) => (
                <div key={i} className={DC.card}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={DC.meta}>
                      {r.category ?? "—"}{r.emotion && <span className="ml-1 text-neutral-300">· {r.emotion}</span>}
                    </div>
                    <PriorityChip priority={r.strategic_priority} />
                  </div>
                  <p className="text-xs leading-snug mb-2 text-neutral-300">{r.recommendation ?? "—"}</p>
                  <div className={cn(DC.meta, "flex items-center justify-between uppercase")}>
                    <span>{r.market_density ?? ""}</span>
                    <span>Score {r.opportunity_score ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {watchlist.length > 0 && (
          <section>
            <SectionHeader index="04" title="Momentum Watchlist" subtitle="market_pressure" />
            <div className="grid gap-2 md:grid-cols-2">
              {watchlist.map((r, i) => (
                <div key={i} className={cn(DC.card, "flex items-center justify-between gap-3 py-2")}>
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-sm text-neutral-100" title={r.brand_domain ?? ""}>{r.brand_domain ?? "—"}</div>
                    {r.keyword && <div className={cn(DC.meta, "truncate")}>{r.keyword}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className={DC.label}>Interest</div>
                      <div className="font-semibold tabular-nums text-sm text-neutral-100">{r.latest_interest ?? 0}</div>
                    </div>
                    <MomentumChip value={r.momentum} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {exec && (exec.dominant_market || exec.strongest_brand || exec.dominant_emotion) && (
          <section>
            <SectionHeader index="05" title="Executive Summary" subtitle="executive_summary" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {exec.dominant_market && (
                <div className={DC.card}>
                  <div className={DC.label}>Dominant Market</div>
                  <div className="font-semibold mt-0.5 truncate text-sm text-neutral-100">{exec.dominant_market}</div>
                </div>
              )}
              {exec.strongest_brand && (
                <div className={DC.card}>
                  <div className={DC.label}>Strongest Brand</div>
                  <div className="font-semibold mt-0.5 truncate text-sm text-neutral-100">{exec.strongest_brand}</div>
                </div>
              )}
              {exec.dominant_emotion && (
                <div className={DC.card}>
                  <div className={DC.label}>Dominant Emotion</div>
                  <div className="font-semibold mt-0.5 truncate text-sm text-neutral-100">{exec.dominant_emotion}</div>
                </div>
              )}
              {exec.top_opportunity_category && (
                <div className={DC.card}>
                  <div className={DC.label}>Top Opportunity</div>
                  <div className="font-semibold mt-0.5 truncate text-sm text-neutral-100">{exec.top_opportunity_category}</div>
                  {exec.top_opportunity_emotion && (
                    <div className={cn(DC.meta, "mt-0.5")}>{exec.top_opportunity_emotion}</div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {actionablePitch.length > 0 && (
          <section>
            <SectionHeader index="06" title="Strategic Advisor" subtitle="pitch_brief" />
            <div className="grid gap-2 md:grid-cols-2">
              {actionablePitch.map((r, i) => (
                <div key={i} className={DC.card}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={DC.meta}>
                      {r.category ?? "—"}
                      {r.category_leader && <span className="ml-1 text-neutral-400">· leader {r.category_leader}</span>}
                    </div>
                    <span className={cn(DC.chip, "text-amber-400 border-amber-800/80")}>{r.action}</span>
                  </div>
                  <p className="text-xs leading-snug mb-1 text-neutral-300">{r.recommendation ?? "—"}</p>
                  <div className={cn(DC.meta, "flex items-center gap-3")}>
                    {r.dominant_emotion && <span>Dominant: {r.dominant_emotion}</span>}
                    {r.whitespace_emotion && <span>Whitespace: {r.whitespace_emotion}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!brief && topThreats.length === 0 && topChallengers.length === 0 && topWhitespace.length === 0 && (
          <EmptyState agencyCtx={agencyCtx} />
        )}
      </div>
    </WorkspaceShell>
  );
}
