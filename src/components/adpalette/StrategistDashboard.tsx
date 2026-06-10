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

  return (
    <WorkspaceShell
      title="BARBS Morning Brief"
      subtitle="Your senior strategy director's read of the market this morning."
    >
      <div className="space-y-12">
        {brief && (brief.headline || brief.summary) && (
          <section>
            <div className="card-flat p-8 md:p-12 bg-secondary/40">
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4">
                BARBS · {brief.client_name ?? "Client"} · {brief.category ?? "Market"}
              </div>
              {brief.headline && (
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.05] mb-6">
                  {brief.headline}
                </h1>
              )}
              {brief.summary && (
                <p className="text-lg md:text-xl leading-relaxed text-ink/85 mb-8 max-w-4xl">
                  {brief.summary}
                </p>
              )}
              <div className="grid md:grid-cols-2 gap-6 pt-6 border-t-2 border-ink/15">
                {brief.strategic_opening && (
                  <div>
                    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                      Strategic Opening
                    </div>
                    <p className="text-base leading-relaxed">{brief.strategic_opening}</p>
                  </div>
                )}
                {brief.recommended_action && (
                  <div>
                    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                      Recommended Action
                    </div>
                    <p className="text-base leading-relaxed font-semibold">{brief.recommended_action}</p>
                  </div>
                )}
              </div>
              {(brief.strongest_threat || brief.emerging_challenger || brief.whitespace_emotion) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 pt-6 border-t-2 border-ink/15">
                  {brief.strongest_threat && (
                    <div>
                      <div className="mono text-[10px] uppercase text-muted-foreground">Strongest Threat</div>
                      <div className="font-bold mt-1 truncate" title={brief.strongest_threat}>{brief.strongest_threat}</div>
                    </div>
                  )}
                  {brief.fastest_mover && (
                    <div>
                      <div className="mono text-[10px] uppercase text-muted-foreground">Fastest Mover</div>
                      <div className="font-bold mt-1 truncate" title={brief.fastest_mover}>{brief.fastest_mover}</div>
                    </div>
                  )}
                  {brief.emerging_challenger && (
                    <div>
                      <div className="mono text-[10px] uppercase text-muted-foreground">Emerging Challenger</div>
                      <div className="font-bold mt-1 truncate" title={brief.emerging_challenger}>{brief.emerging_challenger}</div>
                    </div>
                  )}
                  {brief.whitespace_emotion && (
                    <div>
                      <div className="mono text-[10px] uppercase text-muted-foreground">Open Territory</div>
                      <div className="font-bold mt-1">
                        {brief.whitespace_emotion}
                        {brief.whitespace_score != null && (
                          <span className="mono text-[10px] text-muted-foreground ml-2">{brief.whitespace_score}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {topThreats.length > 0 && (
          <section>
            <SectionHeader index="01" title="Competitive Threats" subtitle="Live · ra_client_threats" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {topThreats.map((r, i) => (
                <div key={i} className="card-flat p-5">
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="font-bold truncate" title={r.competitor_domain ?? ""}>{r.competitor_domain ?? "—"}</div>
                    <span className="mono text-[10px] uppercase px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">
                      Score {r.threat_score ?? "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1 text-xs">
                    <span className="mono text-muted-foreground">Creative volume</span>
                    <span className="text-right font-semibold">{r.creative_volume ?? 0}</span>
                    <span className="mono text-muted-foreground">Search demand</span>
                    <span className="text-right font-semibold">{r.demand ?? 0}</span>
                  </div>
                </div>
              ))}
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
