import { useEffect, useState } from "react";
import { WorkspaceShell } from "./WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

type Exec = {
  dominant_market: string | null;
  strongest_brand: string | null;
  dominant_emotion: string | null;
  top_opportunity_category: string | null;
  top_opportunity_emotion: string | null;
};

type DashKpis = {
  brands_tracked: number | null;
  ads_collected: number | null;
  intelligence_coverage: number | null;
  live_brands: number | null;
  pending_brands: number | null;
  open_opportunities: number | null;
};

type MarketSummary = { category: string | null; ads: number | null; share_of_market: number | null };
type Narrative = { category: string | null; share_of_market: number | null; category_narrative: string | null };
type TopOpp = {
  category: string | null;
  emotion: string | null;
  market_density: string | null;
  strategic_priority: string | null;
  recommendation: string | null;
  opportunity_score: number | null;
};
type BrandLeader = {
  brand: string | null;
  primary_category: string | null;
  dominant_emotion: string | null;
  customer_stage: string | null;
  primary_cta: string | null;
  creative_volume: number | null;
};
type Territory = {
  emotion: string | null;
  brands_using: number | null;
  avg_share: number | null;
  territory_status: string | null;
};
type Pitch = {
  category: string | null;
  category_leader: string | null;
  dominant_emotion: string | null;
  whitespace_emotion: string | null;
  recommendation: string | null;
  action: string | null;
};

const PALETTE = ["#23251D", "var(--primary)", "#7C8076", "#A1A39A", "#D4D6CB", "#5A5D52"];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-flat p-4">
      <div className="mono text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-1 leading-tight truncate" title={value}>
        {value}
      </div>
      {hint && <div className="mono text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <div className="mono text-[10px] uppercase text-muted-foreground">{index}</div>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {subtitle && <div className="mono text-[10px] text-muted-foreground">{subtitle}</div>}
    </div>
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

function ActionChip({ action }: { action: string | null }) {
  const a = (action ?? "").toLowerCase();
  const tone = a.includes("recommended")
    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-950 dark:text-emerald-100"
    : a.includes("monitor")
      ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-950 dark:text-yellow-100"
      : "bg-secondary";
  return (
    <span className={`mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] ${tone}`}>
      {action ?? "—"}
    </span>
  );
}

export function StrategistDashboard() {
  const [exec, setExec] = useState<Exec | null>(null);
  const [kpis, setKpis] = useState<DashKpis | null>(null);
  const [market, setMarket] = useState<MarketSummary[]>([]);
  const [narr, setNarr] = useState<Narrative[]>([]);
  const [opps, setOpps] = useState<TopOpp[]>([]);
  const [brands, setBrands] = useState<BrandLeader[]>([]);
  const [terr, setTerr] = useState<Territory[]>([]);
  const [pitch, setPitch] = useState<Pitch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [e, d, m, n, o, b, t, p] = await Promise.all([
        supabase.from("ra_executive_summary").select("*").maybeSingle(),
        supabase.from("ra_dashboard").select("*").maybeSingle(),
        supabase.from("ra_market_summary").select("*"),
        supabase.from("ra_strategy_narratives").select("*"),
        supabase.from("ra_top_opportunities").select("*"),
        supabase.from("ra_brand_intelligence").select("*"),
        supabase.from("ra_strategic_territories").select("*"),
        supabase.from("ra_pitch_brief").select("*"),
      ]);
      if (!active) return;
      setExec((e.data ?? null) as Exec | null);
      setKpis((d.data ?? null) as DashKpis | null);
      setMarket((m.data ?? []) as MarketSummary[]);
      setNarr((n.data ?? []) as Narrative[]);
      setOpps((o.data ?? []) as TopOpp[]);
      setBrands((b.data ?? []) as BrandLeader[]);
      setTerr((t.data ?? []) as Territory[]);
      setPitch((p.data ?? []) as Pitch[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const recommendedTerritory =
    terr.find((r) => (r.territory_status ?? "").toLowerCase() === "open")?.emotion ??
    [...terr].sort((a, b) => (Number(a.avg_share) || 0) - (Number(b.avg_share) || 0))[0]?.emotion ??
    null;

  const topOpps = [...opps]
    .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
    .slice(0, 6);

  const brandLeaders = [...brands]
    .sort((a, b) => (Number(b.creative_volume) || 0) - (Number(a.creative_volume) || 0))
    .slice(0, 6);

  const actionablePitch = pitch.filter((r) => r.action && r.recommendation);

  const marketChart = market
    .filter((r) => r.category && (Number(r.share_of_market) || 0) > 0)
    .map((r) => ({ name: r.category as string, value: Number(r.share_of_market) || 0, ads: Number(r.ads) || 0 }));

  if (loading) {
    return (
      <WorkspaceShell title="Dashboard">
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading live intelligence…</div>
      </WorkspaceShell>
    );
  }

  const hasExec =
    exec &&
    (exec.dominant_market ||
      exec.strongest_brand ||
      exec.dominant_emotion ||
      exec.top_opportunity_category ||
      recommendedTerritory);

  return (
    <WorkspaceShell
      title="Dashboard"
      subtitle="What is happening, who is winning, what territory is open, and what to do next."
    >
      <div className="space-y-8">
        {hasExec && exec && (
          <section>
            <SectionHeader index="00" title="Executive Summary" subtitle="Live · ra_executive_summary" />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {exec.dominant_market && <StatCard label="Dominant Market" value={exec.dominant_market} />}
              {exec.strongest_brand && <StatCard label="Strongest Brand" value={exec.strongest_brand} />}
              {exec.dominant_emotion && <StatCard label="Dominant Emotion" value={exec.dominant_emotion} />}
              {exec.top_opportunity_category && (
                <StatCard
                  label="Top Opportunity"
                  value={exec.top_opportunity_category}
                  hint={exec.top_opportunity_emotion ?? undefined}
                />
              )}
              {recommendedTerritory && (
                <StatCard label="Recommended Territory" value={recommendedTerritory} hint="Open whitespace" />
              )}
            </div>
            {kpis && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                <StatCard label="Brands Tracked" value={String(kpis.brands_tracked ?? 0)} hint={`${kpis.live_brands ?? 0} live`} />
                <StatCard label="Ads Collected" value={String(kpis.ads_collected ?? 0)} />
                <StatCard label="Intelligence Coverage" value={`${Number(kpis.intelligence_coverage ?? 0)}%`} />
                <StatCard label="Open Opportunities" value={String(kpis.open_opportunities ?? 0)} />
              </div>
            )}
          </section>
        )}

        {marketChart.length > 0 && (
          <section>
            <SectionHeader index="01" title="Market Composition" subtitle="Live · ra_market_summary" />
            <div className="card-flat p-4 grid md:grid-cols-2 gap-4 items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={marketChart} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} stroke="var(--ink)" strokeWidth={2}>
                      {marketChart.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--paper)", border: "2px solid var(--ink)", borderRadius: 4, fontSize: 12 }}
                      formatter={(v: number, _n, p: any) => [`${v}% · ${p.payload.ads} ads`, p.payload.name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {marketChart.map((r, i) => (
                  <div key={r.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-3 h-3 border-2 border-ink rounded-[2px]" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="truncate font-semibold">{r.name}</span>
                    </div>
                    <span className="mono text-[11px] text-muted-foreground">{r.value}% · {r.ads} ads</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {narr.length > 0 && (
          <section>
            <SectionHeader index="02" title="Market Narratives" subtitle="Live · ra_strategy_narratives" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {narr.map((n, i) => (
                <div key={i} className="card-flat p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold">{n.category ?? "—"}</div>
                    <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">
                      {Number(n.share_of_market) || 0}%
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">{n.category_narrative ?? "—"}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {topOpps.length > 0 && (
          <section>
            <SectionHeader index="03" title="Top Opportunities" subtitle="Live · ra_top_opportunities" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topOpps.map((o, i) => (
                <div key={i} className="card-flat p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[10px] uppercase text-muted-foreground">
                      {o.category ?? "—"}
                      {o.emotion && <span className="ml-1 text-ink/70">· {o.emotion}</span>}
                    </div>
                    <PriorityChip priority={o.strategic_priority} />
                  </div>
                  <p className="text-sm leading-relaxed">{o.recommendation ?? "—"}</p>
                  <div className="mono text-[10px] mt-2 text-muted-foreground flex items-center justify-between">
                    <span>{o.market_density ?? ""}</span>
                    <span>Score {o.opportunity_score ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {brandLeaders.length > 0 && (
          <section>
            <SectionHeader index="04" title="Brand Leaders" subtitle="Live · ra_brand_intelligence" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {brandLeaders.map((b, i) => (
                <div key={i} className="card-flat p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-bold truncate" title={b.brand ?? ""}>{b.brand ?? "—"}</div>
                    <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">
                      {b.creative_volume ?? 0} ads
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-[11px]">
                    {b.primary_category && (
                      <>
                        <span className="mono text-muted-foreground">Category</span>
                        <span className="text-right">{b.primary_category}</span>
                      </>
                    )}
                    {b.dominant_emotion && (
                      <>
                        <span className="mono text-muted-foreground">Emotion</span>
                        <span className="text-right">{b.dominant_emotion}</span>
                      </>
                    )}
                    {b.customer_stage && (
                      <>
                        <span className="mono text-muted-foreground">Stage</span>
                        <span className="text-right">{b.customer_stage}</span>
                      </>
                    )}
                    {b.primary_cta && (
                      <>
                        <span className="mono text-muted-foreground">CTA</span>
                        <span className="text-right truncate">{b.primary_cta}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {actionablePitch.length > 0 && (
          <section>
            <SectionHeader index="05" title="Strategic Advisor" subtitle="Live · ra_pitch_brief" />
            <div className="grid gap-3 md:grid-cols-2">
              {actionablePitch.map((r, i) => (
                <div key={i} className="card-flat p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="mono text-[10px] uppercase text-muted-foreground">
                      {r.category ?? "—"}
                      {r.category_leader && <span className="ml-1 text-ink/70">· leader {r.category_leader}</span>}
                    </div>
                    <ActionChip action={r.action} />
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

        {!hasExec && marketChart.length === 0 && topOpps.length === 0 && brandLeaders.length === 0 && (
          <div className="card-flat p-8 text-sm text-muted-foreground">
            No intelligence yet — add a tracked brand under Brand Intelligence to populate.
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
