import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

type MarketDNA = { domain: string | null; emotion_mix: string | null };
type Pressure = {
  category: string | null;
  competitors: number | null;
  avg_creatives_per_brand: number | null;
};
type Opportunity = {
  category: string | null;
  emotion: string | null;
  market_density: string | null;
  strategic_priority: string | null;
  recommendation: string | null;
};

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

function parseEmotions(mix: string | null): string[] {
  return (mix ?? "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function AudienceSignalsPage() {
  const [market, setMarket] = useState<MarketDNA[]>([]);
  const [pressure, setPressure] = useState<Pressure[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [a, b, c] = await Promise.all([
        supabase.from("market_dna_v2").select("domain, emotion_mix"),
        supabase
          .from("competitive_pressure")
          .select("category, competitors, avg_creatives_per_brand"),
        supabase
          .from("strategist_opportunities")
          .select("category, emotion, market_density, strategic_priority, recommendation"),
      ]);
      if (!active) return;
      setMarket((a.data ?? []) as MarketDNA[]);
      setPressure((b.data ?? []) as Pressure[]);
      setOpps((c.data ?? []) as Opportunity[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Emotion ownership: emotion → [domains]
  const emotionOwnership = (() => {
    const map = new Map<string, Set<string>>();
    for (const r of market) {
      const domain = r.domain ?? "";
      if (!domain) continue;
      for (const e of parseEmotions(r.emotion_mix)) {
        if (!map.has(e)) map.set(e, new Set());
        map.get(e)!.add(domain);
      }
    }
    return Array.from(map.entries())
      .map(([emotion, domains]) => ({ emotion, domains: Array.from(domains) }))
      .sort((a, b) => b.domains.length - a.domains.length);
  })();

  const underused = emotionOwnership.filter((e) => e.domains.length === 1);
  const territoryGaps = opps.filter((o) =>
    ["high", "urgent"].includes((o.strategic_priority ?? "").toLowerCase()),
  );
  const saturation = [...pressure].sort(
    (a, b) => (Number(b.avg_creatives_per_brand) || 0) - (Number(a.avg_creatives_per_brand) || 0),
  );

  if (loading) {
    return (
      <WorkspaceShell title="Audience Intel">
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading audience signals…</div>
      </WorkspaceShell>
    );
  }

  const empty =
    emotionOwnership.length === 0 &&
    territoryGaps.length === 0 &&
    saturation.length === 0 &&
    underused.length === 0;

  return (
    <WorkspaceShell
      title="Audience Intel"
      subtitle="Emotion ownership, territory gaps, messaging saturation and underused emotional levers — live."
    >
      {empty ? (
        <div className="card-flat p-8 text-sm text-muted-foreground">
          No audience signal yet — add a tracked brand under Brand Intelligence to populate.
        </div>
      ) : (
        <div className="space-y-8">
          {emotionOwnership.length > 0 && (
            <Section index="01" title="Emotion Ownership" source="market_dna_v2">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {emotionOwnership.slice(0, 12).map((e) => (
                  <div key={e.emotion} className="card-flat p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold capitalize">{e.emotion}</div>
                      <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">
                        {e.domains.length} brand{e.domains.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {e.domains.slice(0, 6).map((d) => (
                        <span
                          key={d}
                          className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper truncate max-w-[120px]"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {territoryGaps.length > 0 && (
            <Section index="02" title="Territory Gaps" source="strategist_opportunities">
              <div className="grid gap-3 md:grid-cols-2">
                {territoryGaps.map((o, i) => (
                  <div key={i} className="card-flat p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="mono text-[10px] uppercase text-muted-foreground">
                        {o.category ?? "Unclassified"}
                        {o.emotion && <span className="ml-1 text-ink/70">· {o.emotion}</span>}
                      </div>
                      <span className="mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-orange-100 dark:bg-orange-900/40 text-orange-950 dark:text-orange-100">
                        {o.strategic_priority}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{o.recommendation ?? "—"}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {saturation.length > 0 && (
            <Section index="03" title="Messaging Saturation" source="competitive_pressure">
              <div className="card-flat p-4 space-y-3">
                {saturation.map((p, i) => {
                  const v = Number(p.avg_creatives_per_brand) || 0;
                  const max = Math.max(...saturation.map((s) => Number(s.avg_creatives_per_brand) || 0), 1);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold">{p.category ?? "—"}</span>
                        <span className="mono text-muted-foreground">
                          {v.toFixed(1)} avg / brand · {Number(p.competitors) || 0} brands
                        </span>
                      </div>
                      <div className="h-2 bg-secondary border-2 border-ink rounded-[3px] overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(v / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {underused.length > 0 && (
            <Section index="04" title="Underused Emotions" source="market_dna_v2">
              <div className="card-flat p-4">
                <p className="mono text-[10px] uppercase text-muted-foreground mb-3">
                  Owned by only one brand — open territory for the rest.
                </p>
                <div className="flex flex-wrap gap-2">
                  {underused.map((e) => (
                    <span
                      key={e.emotion}
                      className="text-sm px-2 py-1 border-2 border-ink rounded-[3px] bg-paper capitalize"
                    >
                      {e.emotion}
                      <span className="mono text-[10px] text-muted-foreground ml-1">· {e.domains[0]}</span>
                    </span>
                  ))}
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/sentiment")({
  head: () => ({ meta: [{ title: "Audience Signals — RevenuAD Signal" }] }),
  component: AudienceSignalsPage,
});
