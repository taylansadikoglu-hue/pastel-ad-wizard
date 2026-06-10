import { useEffect, useState } from "react";
import { WorkspaceShell } from "./WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

type Coverage = {
  domain: string;
  category: string | null;
  placements: number | null;
  latest_placement: string | null;
  coverage_status: string | null;
};

type PipelineRow = { domain: string; pipeline_stage: string | null };

type Opportunity = {
  category: string | null;
  emotion: string | null;
  market_density: string | null;
  strategic_priority: string | null;
  recommendation: string | null;
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card-flat p-4">
      <div className="mono text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
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
  const tone =
    p === "urgent"
      ? "bg-red-100 dark:bg-red-900/40 text-red-950 dark:text-red-100"
      : p === "high"
        ? "bg-orange-100 dark:bg-orange-900/40 text-orange-950 dark:text-orange-100"
        : p === "medium"
          ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-950 dark:text-yellow-100"
          : "bg-secondary";
  return (
    <span className={`mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] ${tone}`}>
      {priority ?? "—"}
    </span>
  );
}

export function StrategistDashboard() {
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [c, p, o] = await Promise.all([
        supabase.from("advertiser_coverage").select("domain, category, placements, latest_placement, coverage_status"),
        supabase.from("advertiser_pipeline").select("domain, pipeline_stage"),
        supabase
          .from("strategist_opportunities")
          .select("category, emotion, market_density, strategic_priority, recommendation"),
      ]);
      if (!active) return;
      setCoverage((c.data ?? []) as Coverage[]);
      setPipeline((p.data ?? []) as PipelineRow[]);
      setOpps((o.data ?? []) as Opportunity[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const brandsTracked = new Set(coverage.map((r) => r.domain)).size;
  const adsCollected = coverage.reduce((s, r) => s + (Number(r.placements) || 0), 0);
  const covered = coverage.filter((r) => (r.coverage_status ?? "").toLowerCase() === "covered").length;
  const coveragePct = coverage.length ? Math.round((covered / coverage.length) * 100) : 0;

  const pipelineBuckets = (() => {
    const map = new Map<string, number>();
    for (const r of pipeline) {
      const k = r.pipeline_stage?.trim() || "Unclassified";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);
  })();

  const topOpps = [...opps]
    .sort(
      (a, b) =>
        (PRIORITY_RANK[(a.strategic_priority ?? "").toLowerCase()] ?? 9) -
        (PRIORITY_RANK[(b.strategic_priority ?? "").toLowerCase()] ?? 9),
    )
    .slice(0, 5);

  const PIPELINE_COLORS = ["var(--primary)", "#23251D", "#A1A39A", "#D4D6CB", "#7C8076"];

  return (
    <WorkspaceShell
      title="Dashboard"
      subtitle="Live strategist cockpit — competitors, coverage, pipeline, and the next move."
    >
      {loading ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading live intelligence…</div>
      ) : (
        <div className="space-y-8">
          <section>
            <SectionHeader index="01" title="Market Overview" subtitle="Live · advertiser_coverage" />
            {coverage.length === 0 ? (
              <div className="card-flat p-6 text-sm text-muted-foreground">
                No tracked brands yet — add a domain under Brand Intelligence to begin.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Brands Tracked" value={brandsTracked} />
                <Stat label="Ads Collected" value={adsCollected.toLocaleString()} />
                <Stat label="Coverage Score" value={`${coveragePct}%`} hint={`${covered} of ${coverage.length} covered`} />
                <Stat
                  label="Categories"
                  value={new Set(coverage.map((r) => r.category).filter(Boolean)).size}
                />
              </div>
            )}
          </section>

          {pipelineBuckets.length > 0 && (
            <section>
              <SectionHeader index="02" title="Discovery Pipeline" subtitle="Live · advertiser_pipeline" />
              <div className="card-flat p-4">
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineBuckets} layout="vertical" margin={{ left: 24, right: 24 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip
                        contentStyle={{
                          background: "var(--paper)",
                          border: "2px solid var(--ink)",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {pipelineBuckets.map((_, i) => (
                          <Cell key={i} fill={PIPELINE_COLORS[i % PIPELINE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          )}

          {topOpps.length > 0 && (
            <section>
              <SectionHeader index="03" title="Latest Opportunities" subtitle="Live · strategist_opportunities" />
              <div className="grid gap-3 md:grid-cols-2">
                {topOpps.map((o, i) => (
                  <div key={i} className="card-flat p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="mono text-[10px] uppercase text-muted-foreground">
                        {o.category ?? "Unclassified"}
                        {o.emotion && <span className="ml-1 text-ink/70">· {o.emotion}</span>}
                      </div>
                      <PriorityChip priority={o.strategic_priority} />
                    </div>
                    <p className="text-sm leading-relaxed">{o.recommendation ?? "—"}</p>
                    {o.market_density && (
                      <div className="mono text-[10px] mt-2 text-muted-foreground">
                        Market density: {o.market_density}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}
