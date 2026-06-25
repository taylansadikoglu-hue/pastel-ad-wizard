import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

type Opportunity = {
  category: string | null;
  emotion: string | null;
  market_density: string | null;
  strategic_priority: string | null;
  recommendation: string | null;
};
type Pressure = {
  category: string | null;
  competitors: number | null;
  total_creatives: number | null;
  avg_creatives_per_brand: number | null;
};
type Ownership = {
  category: string | null;
  domain: string | null;
  placements: number | null;
  share_of_voice: number | null;
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

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

function StrategicAdvisorPage() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [pressure, setPressure] = useState<Pressure[]>([]);
  const [ownership, setOwnership] = useState<Ownership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase
          .from("strategist_opportunities")
          .select("category, emotion, market_density, strategic_priority, recommendation"),
        supabase
          .from("competitive_pressure")
          .select("category, competitors, total_creatives, avg_creatives_per_brand"),
        supabase.from("category_ownership").select("category, domain, placements, share_of_voice"),
      ]);
      if (!active) return;
      setOpps((a.data ?? []) as Opportunity[]);
      setPressure((b.data ?? []) as Pressure[]);
      setOwnership((c.data ?? []) as Ownership[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const pitches = [...opps].sort(
    (x, y) =>
      (PRIORITY_RANK[(x.strategic_priority ?? "").toLowerCase()] ?? 9) -
      (PRIORITY_RANK[(y.strategic_priority ?? "").toLowerCase()] ?? 9),
  );

  const threats = [...pressure].sort(
    (a, b) => (Number(b.competitors) || 0) - (Number(a.competitors) || 0),
  );

  const whiteSpace = opps.filter((o) => (o.market_density ?? "").toLowerCase() === "low");

  // Category summaries: leader + intensity per category
  const categorySummaries = (() => {
    const leaders = new Map<string, Ownership>();
    for (const r of ownership) {
      const k = r.category ?? "Unclassified";
      const cur = leaders.get(k);
      if (!cur || (Number(r.share_of_voice) || 0) > (Number(cur.share_of_voice) || 0)) {
        leaders.set(k, r);
      }
    }
    const pmap = new Map(pressure.map((p) => [p.category ?? "Unclassified", p] as const));
    return Array.from(leaders.entries()).map(([category, leader]) => ({
      category,
      leader,
      pressure: pmap.get(category) ?? null,
    }));
  })();

  if (loading) {
    return (
      <WorkspaceShell title="Strategy">
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading strategic guidance…</div>
      </WorkspaceShell>
    );
  }

  const empty = pitches.length === 0 && threats.length === 0 && categorySummaries.length === 0;

  return (
    <WorkspaceShell
      title="Strategy"
      subtitle="Pitch recommendations, competitive threats, white space, and category summaries — your next move, live."
    >
      {empty ? (
        <div className="card-flat p-8 text-sm text-muted-foreground">
          Strategic Advisor activates once tracked brands and category signals are available.
        </div>
      ) : (
        <div className="space-y-8">
          {pitches.length > 0 && (
            <Section index="01" title="Pitch Recommendations" source="strategist_opportunities">
              <div className="grid gap-3 md:grid-cols-2">
                {pitches.map((o, i) => (
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
            </Section>
          )}

          {threats.length > 0 && (
            <Section index="02" title="Competitive Threats" source="competitive_pressure">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {threats.map((p, i) => (
                  <div key={i} className="card-flat p-4">
                    <div className="mono text-[10px] uppercase text-muted-foreground">{p.category ?? "—"}</div>
                    <div className="text-2xl font-bold mt-1">{Number(p.competitors) || 0}</div>
                    <div className="mono text-[10px] text-muted-foreground">competitors</div>
                    <div className="mt-3 text-[11px] flex justify-between">
                      <span className="text-muted-foreground">Avg / brand</span>
                      <span className="font-semibold">
                        {(Number(p.avg_creatives_per_brand) || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {whiteSpace.length > 0 && (
            <Section index="03" title="White Space" source="strategist_opportunities">
              <div className="grid gap-3 md:grid-cols-2">
                {whiteSpace.map((o, i) => (
                  <div key={i} className="card-flat p-4">
                    <div className="mono text-[10px] uppercase text-muted-foreground mb-1">
                      {o.category ?? "Unclassified"}
                      {o.emotion && <span className="ml-1 text-ink/70">· {o.emotion}</span>}
                    </div>
                    <p className="text-sm leading-relaxed">{o.recommendation ?? "—"}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {categorySummaries.length > 0 && (
            <Section index="04" title="Category Summaries" source="category_ownership + competitive_pressure">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {categorySummaries.map((c) => (
                  <div key={c.category} className="card-flat p-4">
                    <div className="font-bold mb-2">{c.category}</div>
                    <div className="text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leader</span>
                        <span className="font-semibold truncate ml-2">{c.leader.domain ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Share of voice</span>
                        <span className="font-semibold">
                          {(Number(c.leader.share_of_voice) || 0).toFixed(1)}%
                        </span>
                      </div>
                      {c.pressure && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Competitors</span>
                            <span className="font-semibold">{Number(c.pressure.competitors) || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Avg / brand</span>
                            <span className="font-semibold">
                              {(Number(c.pressure.avg_creatives_per_brand) || 0).toFixed(1)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
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

export const Route = createFileRoute("/_authenticated/app/advisor")({
  head: () => ({ meta: [{ title: "Strategic Advisor — RevenuAD Signal" }] }),
  component: StrategicAdvisorPage,
});
