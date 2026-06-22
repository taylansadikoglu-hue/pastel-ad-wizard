import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

type CategoryOwnership = {
  category: string | null;
  domain: string | null;
  placements: number | null;
  share_of_voice: number | null;
};
type CompetitivePressure = {
  category: string | null;
  competitors: number | null;
  total_creatives: number | null;
  avg_creatives_per_brand: number | null;
};
type Positioning = {
  domain: string | null;
  top_product: string | null;
  top_emotion: string | null;
  top_buyer_stage: string | null;
  placements: number | null;
  x_axis: number | null;
  y_axis: number | null;
};
type Opportunity = {
  category: string | null;
  emotion: string | null;
  market_density: string | null;
  strategic_priority: string | null;
  recommendation: string | null;
};

const PALETTE = [
  "var(--primary)",
  "#23251D",
  "#A1A39A",
  "#D4D6CB",
  "#7C8076",
  "#5A5D52",
];

function Section({
  index,
  title,
  source,
  children,
}: {
  index: string;
  title: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="mono text-[10px] uppercase text-muted-foreground">{index}</div>
          <h2 className="text-lg font-bold">{title}</h2>
        </div>
        <div className="mono text-[10px] text-muted-foreground">Live · {source}</div>
      </div>
      {children}
    </section>
  );
}

function MarketIntelligencePage() {
  const [ownership, setOwnership] = useState<CategoryOwnership[]>([]);
  const [pressure, setPressure] = useState<CompetitivePressure[]>([]);
  const [pos, setPos] = useState<Positioning[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [a, b, c, d] = await Promise.all([
        supabase.from("category_ownership").select("category, domain, placements, share_of_voice"),
        supabase
          .from("competitive_pressure")
          .select("category, competitors, total_creatives, avg_creatives_per_brand"),
        supabase
          .from("positioning_quadrant")
          .select("domain, top_product, top_emotion, top_buyer_stage, placements, x_axis, y_axis"),
        supabase
          .from("strategist_opportunities")
          .select("category, emotion, market_density, strategic_priority, recommendation"),
      ]);
      if (!active) return;
      setOwnership((a.data ?? []) as CategoryOwnership[]);
      setPressure((b.data ?? []) as CompetitivePressure[]);
      setPos((c.data ?? []) as Positioning[]);
      setOpps((d.data ?? []) as Opportunity[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Category leaders: top 3 domains per category by share_of_voice
  const leadersByCategory = (() => {
    const map = new Map<string, CategoryOwnership[]>();
    for (const r of ownership) {
      const k = r.category ?? "Unclassified";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([category, rows]) => ({
      category,
      rows: rows
        .sort((a, b) => (Number(b.share_of_voice) || 0) - (Number(a.share_of_voice) || 0))
        .slice(0, 3),
    }));
  })();

  // SOV donut: top category by total placements
  const sovTopCategory = (() => {
    if (ownership.length === 0) return null;
    const totals = new Map<string, number>();
    for (const r of ownership) {
      const k = r.category ?? "Unclassified";
      totals.set(k, (totals.get(k) ?? 0) + (Number(r.placements) || 0));
    }
    const [topCat] = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    if (!topCat) return null;
    const rows = ownership
      .filter((r) => (r.category ?? "Unclassified") === topCat[0])
      .map((r) => ({ name: r.domain ?? "—", value: Number(r.share_of_voice) || 0 }))
      .filter((d) => d.value > 0);
    return { category: topCat[0], rows };
  })();

  const whiteSpace = opps.filter((o) => (o.market_density ?? "").toLowerCase() === "low");

  if (loading) {
    return (
      <WorkspaceShell title="Market Intel">
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading market intelligence…</div>
      </WorkspaceShell>
    );
  }

  const empty =
    ownership.length === 0 && pressure.length === 0 && pos.length === 0 && opps.length === 0;

  return (
    <WorkspaceShell
      title="Market Intel"
      subtitle="Category leaders, competitive pressure, share of voice, positioning and white space — live."
    >
      {empty ? (
        <div className="card-flat p-8 text-sm text-muted-foreground">
          No market intelligence yet — add tracked brands under Brand Intelligence to populate.
        </div>
      ) : (
        <div className="space-y-8">
          {leadersByCategory.length > 0 && (
            <Section index="01" title="Category Leaders" source="category_ownership">
              <div className="grid gap-3 md:grid-cols-2">
                {leadersByCategory.map((g) => (
                  <div key={g.category} className="card-flat p-4">
                    <div className="font-bold mb-2">{g.category}</div>
                    <div className="space-y-2">
                      {g.rows.map((r, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="truncate">{r.domain ?? "—"}</span>
                            <span className="mono">{(Number(r.share_of_voice) || 0).toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-secondary border-2 border-ink rounded-[3px] overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, Number(r.share_of_voice) || 0)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {pressure.length > 0 && (
            <Section index="02" title="Competitive Pressure" source="competitive_pressure">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {pressure
                  .sort((a, b) => (Number(b.competitors) || 0) - (Number(a.competitors) || 0))
                  .map((p, i) => (
                    <div key={i} className="card-flat p-4">
                      <div className="mono text-[10px] uppercase text-muted-foreground">{p.category ?? "—"}</div>
                      <div className="text-2xl font-bold mt-1">{Number(p.competitors) || 0}</div>
                      <div className="mono text-[10px] text-muted-foreground">competitors</div>
                      <div className="mt-3 text-[11px] space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Creatives</span>
                          <span className="font-semibold">
                            {Number(p.total_creatives) || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg / brand</span>
                          <span className="font-semibold">
                            {(Number(p.avg_creatives_per_brand) || 0).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Section>
          )}

          {sovTopCategory && sovTopCategory.rows.length > 0 && (
            <Section index="03" title={`Share of Voice · ${sovTopCategory.category}`} source="category_ownership">
              <div className="card-flat p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sovTopCategory.rows}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {sovTopCategory.rows.map((_, i) => (
                          <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="var(--ink)" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "var(--paper)",
                          border: "2px solid var(--ink)",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                        formatter={(v: number) => `${v.toFixed(1)}%`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Section>
          )}

          {pos.length > 0 && (
            <Section index="04" title="Positioning Map" source="positioning_quadrant">
              <div className="card-flat p-4">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                      <XAxis
                        type="number"
                        dataKey="x_axis"
                        name="Stage"
                        tick={{ fontSize: 11 }}
                        label={{ value: "Customer stage →", position: "insideBottom", offset: -2, fontSize: 11 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y_axis"
                        name="Emotion"
                        tick={{ fontSize: 11 }}
                        label={{ value: "Emotion intensity ↑", angle: -90, position: "insideLeft", fontSize: 11 }}
                      />
                      <ZAxis type="number" dataKey="placements" range={[60, 400]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{
                          background: "var(--paper)",
                          border: "2px solid var(--ink)",
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as Positioning;
                          return (
                            <div className="bg-paper border-2 border-ink rounded-[3px] p-2 text-[11px]">
                              <div className="font-bold">{d.domain}</div>
                              <div>{d.top_product ?? "—"}</div>
                              <div className="text-muted-foreground">
                                {d.top_emotion ?? "—"} · {d.top_buyer_stage ?? "—"}
                              </div>
                              <div className="mono mt-1">{d.placements ?? 0} placements</div>
                            </div>
                          );
                        }}
                      />
                      <Scatter data={pos} fill="var(--primary)" stroke="var(--ink)" strokeWidth={2} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Section>
          )}

          {whiteSpace.length > 0 && (
            <Section index="05" title="White Space Opportunities" source="strategist_opportunities">
              <div className="grid gap-3 md:grid-cols-2">
                {whiteSpace.map((o, i) => (
                  <div key={i} className="card-flat p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="mono text-[10px] uppercase text-muted-foreground">
                        {o.category ?? "Unclassified"}
                        {o.emotion && <span className="ml-1 text-ink/70">· {o.emotion}</span>}
                      </div>
                      <span className="mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-green-100 dark:bg-green-900/40 text-green-950 dark:text-green-100">
                        Low density
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{o.recommendation ?? "—"}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/pcr")({
  head: () => ({ meta: [{ title: "Market Intelligence — RevenueAd" }] }),
  component: MarketIntelligencePage,
});
