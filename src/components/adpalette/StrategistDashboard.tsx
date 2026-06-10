import { useEffect, useState } from "react";
import { WorkspaceShell } from "./WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

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

function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <div>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{index}</div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      {subtitle && <div className="mono text-[10px] uppercase text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

function MomentumChip({ value }: { value: string | null }) {
  const v = (value ?? "").toLowerCase();
  const tone = v.includes("rising") || v.includes("accel")
    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100"
    : v.includes("decl") || v.includes("cool")
      ? "bg-rose-100 dark:bg-rose-900/40 text-rose-950 dark:text-rose-100"
      : "bg-secondary";
  return (
    <span className={`mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] ${tone}`}>
      {value ?? "—"}
    </span>
  );
}

function PriorityChip({ priority }: { priority: string | null }) {
  const p = (priority ?? "").toLowerCase();
  const tone = p.includes("emerging")
    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100"
    : p.includes("competitive")
      ? "bg-orange-100 dark:bg-orange-900/40 text-orange-950 dark:text-orange-100"
      : "bg-secondary";
  return (
    <span className={`mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] ${tone}`}>
      {priority ?? "—"}
    </span>
  );
}

function EvidenceBlock({ items }: { items: { label: string; value: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-auto pt-4 border-t border-ink/10">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        Why BARBS Thinks This
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {items.map((it) => (
          <div key={it.label}>
            <div className="text-sm font-semibold tracking-tight truncate" title={it.value}>
              {it.value}
            </div>
            <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
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

  useEffect(() => {
    let active = true;
    (async () => {
      const [b, t, c, w, m, e, p, cf] = await Promise.all([
        supabase.from("ra_barbs_client_brief").select("*").limit(1).maybeSingle(),
        supabase.from("ra_client_threats").select("*"),
        supabase.from("ra_brand_opportunities").select("*"),
        supabase.from("ra_top_opportunities").select("*"),
        supabase.from("ra_market_pressure").select("*"),
        supabase.from("ra_executive_summary").select("*").maybeSingle(),
        supabase.from("ra_pitch_brief").select("*"),
        supabase.from("ra_barbs_confidence").select("*").limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setBrief((b.data ?? null) as Brief | null);
      setThreats((t.data ?? []) as Threat[]);
      setChallengers((c.data ?? []) as Challenger[]);
      setWhitespace((w.data ?? []) as Whitespace[]);
      setMomentum((m.data ?? []) as Momentum[]);
      setExec((e.data ?? null) as Exec | null);
      setPitch((p.data ?? []) as Pitch[]);
      setConfidence((cf.data ?? null) as Confidence | null);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <WorkspaceShell title="BARBS Morning Brief">
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">
          Loading live intelligence…
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
    if (signals >= 3) return { label: "High", tone: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100" };
    if (signals === 2) return { label: "Medium", tone: "bg-amber-100 dark:bg-amber-900/40 text-amber-950 dark:text-amber-100" };
    return { label: "Low", tone: "bg-secondary text-muted-foreground" };
  };

  return (
    <WorkspaceShell
      title="BARBS Morning Brief"
      subtitle="Your senior strategy director's read of the market this morning."
    >
      <div className="space-y-16">
        {brief && (brief.headline || brief.summary) && (
          <section>
            <div className="space-y-10">
              {/* Eyebrow */}
              <div className="flex items-center gap-3 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                <span>Today's Brief</span>
                <span className="text-ink/30">·</span>
                <span>{brief.client_name ?? "Client"}</span>
                {brief.category && <><span className="text-ink/30">·</span><span>{brief.category}</span></>}
              </div>

              {/* Headline */}
              {brief.headline && (
                <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.02] max-w-5xl">
                  {brief.headline}
                </h1>
              )}
              {brief.summary && (
                <p className="text-lg md:text-xl leading-relaxed text-ink/70 max-w-3xl">
                  {brief.summary}
                </p>
              )}

              {/* Three scan cards */}
              <div className="grid md:grid-cols-3 gap-4 pt-2">
                {brief.strongest_threat && (
                  <div className="rounded-2xl bg-secondary/40 p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-rose-700 dark:text-rose-300">
                      <span className="inline-block size-1.5 rounded-full bg-rose-500" />
                      Strongest Threat
                    </div>
                    <div className="text-2xl font-bold tracking-tight truncate" title={brief.strongest_threat}>
                      {brief.strongest_threat}
                    </div>
                    <EvidenceBlock items={threatEvidence} />
                  </div>
                )}
                {brief.emerging_challenger && (
                  <div className="rounded-2xl bg-secondary/40 p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-300">
                      <span className="inline-block size-1.5 rounded-full bg-amber-500" />
                      Emerging Challenger
                    </div>
                    <div className="text-2xl font-bold tracking-tight truncate" title={brief.emerging_challenger}>
                      {brief.emerging_challenger}
                    </div>
                    <EvidenceBlock items={challengerEvidence} />
                  </div>
                )}
                {(brief.strategic_opening || brief.whitespace_emotion) && (
                  <div className="rounded-2xl bg-secondary/40 p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                      <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                      Strategic Opening
                    </div>
                    {brief.strategic_opening ? (
                      <p className="text-base leading-snug font-medium">{brief.strategic_opening}</p>
                    ) : (
                      <div className="text-2xl font-bold tracking-tight">{brief.whitespace_emotion}</div>
                    )}
                    <EvidenceBlock items={openingEvidence} />
                  </div>
                )}
              </div>

              {/* Recommended Action */}
              {brief.recommended_action && (
                <div className="rounded-2xl bg-ink text-paper p-8 md:p-10">
                  <div className="mono text-[10px] uppercase tracking-widest text-paper/60 mb-3">
                    Recommended Action
                  </div>
                  <p className="text-xl md:text-2xl font-semibold leading-snug max-w-4xl">
                    {brief.recommended_action}
                  </p>
                </div>
              )}

              {/* Confidence */}
              {confidence && (confidence.ads_analysed != null || confidence.brands_tracked != null || confidence.trend_points != null || confidence.classification_coverage != null) && (
                <div className="flex flex-wrap items-end gap-x-10 gap-y-6 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</span>
                    <span className="mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100">
                      High
                    </span>
                  </div>
                  {confidence.ads_analysed != null && (
                    <div>
                      <div className="text-xl font-bold tracking-tight">{confidence.ads_analysed.toLocaleString()}</div>
                      <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">Creatives</div>
                    </div>
                  )}
                  {confidence.brands_tracked != null && (
                    <div>
                      <div className="text-xl font-bold tracking-tight">{confidence.brands_tracked.toLocaleString()}</div>
                      <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">Brands</div>
                    </div>
                  )}
                  {confidence.trend_points != null && (
                    <div>
                      <div className="text-xl font-bold tracking-tight">{confidence.trend_points.toLocaleString()}</div>
                      <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">Trend points</div>
                    </div>
                  )}
                  {confidence.classification_coverage != null && (
                    <div>
                      <div className="text-xl font-bold tracking-tight">{Number(confidence.classification_coverage).toFixed(0)}%</div>
                      <div className="mono text-[10px] uppercase text-muted-foreground mt-0.5">Coverage</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {topThreats.length > 0 && (
          <section>
            <SectionHeader index="01" title="Competitors" subtitle="Live · ra_client_threats" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {topThreats.map((r, i) => {
                const t = Number(r.threat_score) || 0;
                const d = Number(r.demand) || 0;
                const c = Number(r.creative_volume) || 0;
                const dT = delta(t, avgThreat);
                const dD = delta(d, avgDemand);
                const conf = confidenceFor(r);
                const insight = insightFor(r);
                return (
                  <div key={i} className="rounded-2xl bg-secondary/30 p-6 space-y-5">
                    {/* Rank + domain + confidence */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="mono text-[10px] font-bold px-2 py-1 rounded-md bg-ink text-paper shrink-0">
                          #{String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="font-bold truncate text-base" title={r.competitor_domain ?? ""}>
                          {r.competitor_domain ?? "—"}
                        </div>
                      </div>
                      <span className={`mono text-[10px] uppercase px-2 py-0.5 rounded-full ${conf.tone}`}>
                        {conf.label}
                      </span>
                    </div>

                    {/* Hero number: threat score */}
                    <div>
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Threat Score</div>
                        {dT !== 0 && avgThreat > 0 && (
                          <span className={`mono text-[10px] ${dT > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {dT > 0 ? "+" : ""}{dT}% vs avg
                          </span>
                        )}
                      </div>
                      <div className="text-4xl font-bold tracking-tight tabular-nums">{t || "—"}</div>
                      <div className="mt-2 h-1 w-full rounded-full bg-ink/10 overflow-hidden">
                        <div className="h-full bg-ink" style={{ width: `${pct(t, maxThreat)}%` }} />
                      </div>
                    </div>

                    {/* Demand + Creative side by side */}
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <div className="mono text-[10px] uppercase text-muted-foreground">Demand</div>
                          {dD !== 0 && avgDemand > 0 && (
                            <span className={`mono text-[10px] ${dD > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                              {dD > 0 ? "+" : ""}{dD}%
                            </span>
                          )}
                        </div>
                        <div className="text-xl font-bold tabular-nums">{d}</div>
                        <div className="mt-1.5 h-1 w-full rounded-full bg-ink/10 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${pct(d, maxDemand)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="mono text-[10px] uppercase text-muted-foreground mb-1">Creative</div>
                        <div className="text-xl font-bold tabular-nums">{c}</div>
                        <div className="mt-1.5 h-1 w-full rounded-full bg-ink/10 overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${pct(c, maxCreative)}%` }} />
                        </div>
                      </div>
                    </div>

                    {insight && (
                      <div className="pt-1 text-sm leading-snug text-ink/80 border-t border-ink/10">
                        <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1">Insight</span>
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
            <SectionHeader index="02" title="Emerging Challengers" subtitle="Live · ra_brand_opportunities" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topChallengers.map((r, i) => (
                <div key={i} className="card-flat p-5">
                  <div className="flex items-baseline justify-between mb-2">
                    <div className="font-bold truncate" title={r.brand_domain ?? ""}>{r.brand_domain ?? "—"}</div>
                    <MomentumChip value={r.momentum} />
                  </div>
                  {r.keyword && (
                    <div className="text-sm mb-3 text-ink/80">around <span className="font-semibold">{r.keyword}</span></div>
                  )}
                  <div className="grid grid-cols-3 gap-y-1 text-xs">
                    <span className="mono text-muted-foreground">Opportunity</span>
                    <span className="col-span-2 text-right font-semibold">{r.opportunity_score ?? 0}</span>
                    <span className="mono text-muted-foreground">Interest</span>
                    <span className="col-span-2 text-right">{r.latest_interest ?? 0}</span>
                    <span className="mono text-muted-foreground">Creative</span>
                    <span className="col-span-2 text-right">{r.creative_volume ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {topWhitespace.length > 0 && (
          <section>
            <SectionHeader index="03" title="Strategic Whitespace" subtitle="Live · ra_top_opportunities" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topWhitespace.map((r, i) => (
                <div key={i} className="card-flat p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[10px] uppercase text-muted-foreground">
                      {r.category ?? "—"}{r.emotion && <span className="ml-1 text-ink/70">· {r.emotion}</span>}
                    </div>
                    <PriorityChip priority={r.strategic_priority} />
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{r.recommendation ?? "—"}</p>
                  <div className="mono text-[10px] flex items-center justify-between text-muted-foreground">
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
            <SectionHeader index="04" title="Momentum Watchlist" subtitle="Live · ra_market_pressure" />
            <div className="grid gap-3 md:grid-cols-2">
              {watchlist.map((r, i) => (
                <div key={i} className="card-flat p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-bold truncate" title={r.brand_domain ?? ""}>{r.brand_domain ?? "—"}</div>
                    {r.keyword && <div className="text-xs text-muted-foreground truncate">{r.keyword}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="mono text-[10px] uppercase text-muted-foreground">Interest</div>
                      <div className="font-bold">{r.latest_interest ?? 0}</div>
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
            <SectionHeader index="05" title="Executive Summary" subtitle="Live · ra_executive_summary" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {exec.dominant_market && (
                <div className="card-flat p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">Dominant Market</div>
                  <div className="font-bold mt-1 truncate">{exec.dominant_market}</div>
                </div>
              )}
              {exec.strongest_brand && (
                <div className="card-flat p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">Strongest Brand</div>
                  <div className="font-bold mt-1 truncate">{exec.strongest_brand}</div>
                </div>
              )}
              {exec.dominant_emotion && (
                <div className="card-flat p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">Dominant Emotion</div>
                  <div className="font-bold mt-1 truncate">{exec.dominant_emotion}</div>
                </div>
              )}
              {exec.top_opportunity_category && (
                <div className="card-flat p-4">
                  <div className="mono text-[10px] uppercase text-muted-foreground">Top Opportunity</div>
                  <div className="font-bold mt-1 truncate">{exec.top_opportunity_category}</div>
                  {exec.top_opportunity_emotion && (
                    <div className="mono text-[10px] text-muted-foreground mt-1">{exec.top_opportunity_emotion}</div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {actionablePitch.length > 0 && (
          <section>
            <SectionHeader index="06" title="Strategic Advisor" subtitle="Live · ra_pitch_brief" />
            <div className="grid gap-3 md:grid-cols-2">
              {actionablePitch.map((r, i) => (
                <div key={i} className="card-flat p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[10px] uppercase text-muted-foreground">
                      {r.category ?? "—"}
                      {r.category_leader && <span className="ml-1 text-ink/70">· leader {r.category_leader}</span>}
                    </div>
                    <span className="mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">
                      {r.action}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed mb-2">{r.recommendation ?? "—"}</p>
                  <div className="mono text-[10px] text-muted-foreground flex items-center gap-3">
                    {r.dominant_emotion && <span>Dominant: {r.dominant_emotion}</span>}
                    {r.whitespace_emotion && <span>Whitespace: {r.whitespace_emotion}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!brief && topThreats.length === 0 && topChallengers.length === 0 && topWhitespace.length === 0 && (
          <div className="card-flat p-8 text-sm text-muted-foreground">
            No intelligence yet — add a tracked brand under Brand Intelligence to populate.
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
