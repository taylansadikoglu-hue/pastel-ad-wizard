import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, DollarSign, Layers, TrendingUp } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

type CampaignRow = {
  brand_name: string;
  total_creatives: number | string | null;
  total_spend: number | string | null;
  flight_start: string | null;
  flight_end: string | null;
  avg_sentiment: number | string | null;
  channel_type: string | null;
};

const CHANNEL_PALETTE = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}m`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function AdvertiserDrilldown() {
  const { brand } = Route.useParams();
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("advertiser_campaign_analytics")
        .select("*")
        .ilike("brand_name", brand);
      if (!active) return;
      setRows((data ?? []) as CampaignRow[]);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [brand]);

  const totals = useMemo(() => {
    const totalSpend = rows.reduce((s, r) => s + num(r.total_spend), 0);
    const totalCreatives = rows.reduce((s, r) => s + num(r.total_creatives), 0);
    const sentiments = rows.map((r) => num(r.avg_sentiment)).filter((n) => n > 0);
    const avgSent = sentiments.length ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : 0;
    const starts = rows.map((r) => (r.flight_start ? new Date(r.flight_start).getTime() : NaN)).filter(Number.isFinite);
    const ends = rows.map((r) => (r.flight_end ? new Date(r.flight_end).getTime() : NaN)).filter(Number.isFinite);
    const earliest = starts.length ? Math.min(...starts) : null;
    const latest = ends.length ? Math.max(...ends) : null;
    return { totalSpend, totalCreatives, avgSent, earliest, latest };
  }, [rows]);

  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = r.channel_type ?? "unknown";
      map.set(k, (map.get(k) ?? 0) + num(r.total_spend));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const timeline = useMemo(() => {
    if (!totals.earliest || !totals.latest) return [];
    const span = totals.latest - totals.earliest || 1;
    return rows
      .filter((r) => r.flight_start && r.flight_end)
      .map((r, i) => {
        const start = new Date(r.flight_start!).getTime();
        const end = new Date(r.flight_end!).getTime();
        return {
          key: `${r.channel_type ?? "ch"}-${i}`,
          channel: r.channel_type ?? "Unknown",
          start,
          end,
          leftPct: ((start - totals.earliest!) / span) * 100,
          widthPct: Math.max(2, ((end - start) / span) * 100),
          spend: num(r.total_spend),
        };
      })
      .sort((a, b) => a.start - b.start);
  }, [rows, totals.earliest, totals.latest]);

  return (
    <WorkspaceShell title={brand} subtitle="Campaign analytics — spend, channels and flight schedule.">
      <div className="space-y-6">
        <Link to="/app/advertisers" className="mono text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={12} /> Back to advertisers
        </Link>

        {loading ? (
          <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading campaign analytics…</div>
        ) : rows.length === 0 ? (
          <div className="card-flat p-12 text-center">
            <div className="text-base font-semibold tracking-tight">No campaign data for {brand}</div>
            <p className="text-sm text-muted-foreground mt-2">This brand hasn't surfaced in advertiser_campaign_analytics yet.</p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI icon={<DollarSign size={14} />} label="Total spend" value={fmtMoney(totals.totalSpend)} />
              <KPI icon={<Layers size={14} />} label="Creatives" value={String(totals.totalCreatives)} />
              <KPI icon={<TrendingUp size={14} />} label="Avg sentiment" value={totals.avgSent ? totals.avgSent.toFixed(1) : "—"} />
              <KPI icon={<Calendar size={14} />} label="Channels" value={String(channelBreakdown.length)} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Spend Breakdown Pie */}
              <div className="card-flat p-6">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                  Spend Breakdown · by channel
                </div>
                {channelBreakdown.length === 0 ? (
                  <div className="h-64 grid place-items-center text-sm text-muted-foreground">No spend recorded</div>
                ) : (
                  <div className="grid grid-cols-[1fr_auto] gap-6 items-center">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={channelBreakdown}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            stroke="#000"
                            strokeWidth={1}
                          >
                            {channelBreakdown.map((_, i) => (
                              <Cell key={i} fill={CHANNEL_PALETTE[i % CHANNEL_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => fmtMoney(value)}
                            contentStyle={{ background: "white", border: "1px solid #000", borderRadius: 4, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="space-y-2 text-sm min-w-[140px]">
                      {channelBreakdown.map((d, i) => (
                        <li key={d.name} className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-sm border border-ink"
                            style={{ background: CHANNEL_PALETTE[i % CHANNEL_PALETTE.length] }}
                          />
                          <span className="capitalize font-medium">{d.name}</span>
                          <span className="mono text-[11px] text-muted-foreground ml-auto tabular-nums">
                            {fmtMoney(d.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Campaign Timeline */}
              <div className="card-flat p-6">
                <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                  Campaign Timeline · flight duration
                </div>
                {timeline.length === 0 ? (
                  <div className="h-64 grid place-items-center text-sm text-muted-foreground">No flight data recorded</div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <span>{fmtDate(new Date(totals.earliest!).toISOString())}</span>
                      <span>{fmtDate(new Date(totals.latest!).toISOString())}</span>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-auto pr-1">
                      {timeline.map((t, i) => (
                        <div key={t.key} className="relative h-8 bg-paper border border-ink/20 rounded-[4px]">
                          <div
                            className="absolute top-1 bottom-1 rounded-[3px] border border-ink/40 flex items-center px-2 text-[10px] mono uppercase tracking-widest text-white overflow-hidden"
                            style={{
                              left: `${t.leftPct}%`,
                              width: `${t.widthPct}%`,
                              background: CHANNEL_PALETTE[i % CHANNEL_PALETTE.length],
                            }}
                            title={`${t.channel} · ${fmtDate(new Date(t.start).toISOString())} → ${fmtDate(new Date(t.end).toISOString())} · ${fmtMoney(t.spend)}`}
                          >
                            <span className="truncate">{t.channel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Detail table */}
            <div className="card-flat p-6">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-4">
                All campaigns
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-ink/20">
                      <th className="py-2 pr-3">Channel</th>
                      <th className="py-2 pr-3 text-right">Creatives</th>
                      <th className="py-2 pr-3 text-right">Spend</th>
                      <th className="py-2 pr-3">Start</th>
                      <th className="py-2 pr-3">End</th>
                      <th className="py-2 pr-3 text-right">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-b border-ink/10">
                        <td className="py-2 pr-3 capitalize font-medium">{r.channel_type ?? "—"}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{num(r.total_creatives)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(num(r.total_spend))}</td>
                        <td className="py-2 pr-3">{fmtDate(r.flight_start)}</td>
                        <td className="py-2 pr-3">{fmtDate(r.flight_end)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{num(r.avg_sentiment).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-flat p-4">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold tracking-tight mt-2 tabular-nums">{value}</div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertiser/$brand")({
  head: ({ params }) => ({ meta: [{ title: `${params.brand} — RevenueAd` }] }),
  component: AdvertiserDrilldown,
});
