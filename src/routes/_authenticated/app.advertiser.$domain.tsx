import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Play } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentAd = {
  id: number | string;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  ad_format?: string | null;
  advertiser?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  sighting_count?: number | string | null;
  ai_tags?: Record<string, unknown> | string | null;
  primary_colours?: string[] | null;
};

type War = {
  name?: string;
  domain?: string;
  industry?: string;
  total_ads?: number;
  total_sightings?: number;
  first_seen?: string;
  last_seen?: string;
  channel_split?: {
    search?: number; display?: number; video?: number; image?: number; social?: number;
    search_pct?: number; display_pct?: number; video_pct?: number; image_pct?: number; social_pct?: number;
  };
  top_themes?: { theme: string; count: number; pct: number }[];
  sentiment_breakdown?: { positive?: number; neutral?: number; urgency?: number };
  finance_offer_count?: number;
  finance_offers?: string[];
  top_ctas?: { cta: string; count: number }[];
  has_people_pct?: number;
  monthly_velocity?: { month: string; ads: number }[];
  seasonal_clusters?: { eofy?: number; christmas?: number; tax?: number; back_to_school?: number };
  recent_ads?: RecentAd[];
  insight?: string;
};

type Spend = {
  brand?: string;
  estimated_monthly_spend?: number;
  spend_by_channel?: { search?: number; display?: number; video?: number; social?: number };
  confidence?: string;
  methodology?: string;
  insight?: string;
};

type Placements = {
  brand?: string;
  total_placements?: number;
  sites?: { domain: string; count: number; pct?: number; label?: string; ad_formats?: string[] }[];
  insight?: string;
};

type Explain = {
  one_liner?: string;
  their_weakness?: string;
  opportunity_for_competitors?: string;
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveBrand(domain: string): string {
  const host = domain.toLowerCase().replace(/^www\./, "").trim();
  const root = host.split(".")[0] ?? host;
  if (root === "commbank") return "CommBank";
  if (root === "macquarie") return "Macquarie";
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMonth(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function fmtMoney(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtNum(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return "0%";
  const v = Math.abs(n) <= 1 ? n * 100 : n;
  return `${v.toFixed(1)}%`;
}


function askBarbs(query: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("barbs:ask", { detail: query }));
}

const PLATFORM_LABEL: Record<string, string> = {
  display: "Programmatic Display",
  text: "Google Search Ad",
  video: "Video Ad",
  image: "Display Image Ad",
};

const SENTIMENT_COPY = {
  positive: { icon: "🟢", line: "Building trust" },
  urgency: { icon: "🔴", line: "Pressure play" },
  neutral: { icon: "⚪", line: "Awareness play" },
};

const SITE_LABEL_TONE: Record<string, string> = {
  Finance: "bg-amber-50 text-amber-900 border-amber-300",
  News: "bg-sky-50 text-sky-900 border-sky-300",
  Sports: "bg-emerald-50 text-emerald-900 border-emerald-300",
  "Real Estate": "bg-violet-50 text-violet-900 border-violet-300",
  "General Web": "bg-zinc-50 text-zinc-700 border-zinc-300",
  "Keyword/Topic": "bg-zinc-50 text-zinc-700 border-zinc-300",
};

const SEASONAL_LABEL: Record<string, string> = {
  eofy: "EOFY",
  christmas: "Christmas",
  tax: "Tax",
  back_to_school: "Back to School",
};

// ─── Chart.js loader ──────────────────────────────────────────────────────────

type ChartJs = { new (ctx: CanvasRenderingContext2D | HTMLCanvasElement, cfg: unknown): { destroy: () => void } };
function useChartJs(): ChartJs | null {
  const [lib, setLib] = useState<ChartJs | null>(null);
  useEffect(() => {
    const w = window as unknown as { Chart?: ChartJs };
    if (w.Chart) { setLib(() => w.Chart!); return; }
    const existing = document.querySelector<HTMLScriptElement>('script[data-chartjs]');
    const onReady = () => { if (w.Chart) setLib(() => w.Chart!); };
    if (existing) { existing.addEventListener("load", onReady); return () => existing.removeEventListener("load", onReady); }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
    s.dataset.chartjs = "1";
    s.async = true;
    s.onload = onReady;
    document.head.appendChild(s);
  }, []);
  return lib;
}

function ChartCanvas({
  build,
  className,
}: {
  build: (canvas: HTMLCanvasElement) => { destroy: () => void } | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const inst = build(ref.current);
    return () => { inst?.destroy(); };
  }, [build]);
  return <canvas ref={ref} className={className} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdvertiserPage() {
  const { domain } = Route.useParams();
  const brand = useMemo(() => resolveBrand(domain), [domain]);

  const [war, setWar] = useState<War | null>(null);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [places, setPlaces] = useState<Placements | null>(null);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonalFilter, setSeasonalFilter] = useState<string | null>(null);
  const ChartLib = useChartJs();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const safe = async <T,>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        return (await r.json()) as T;
      } catch { return null; }
    };
    (async () => {
      const [w, s, p, e] = await Promise.all([
        safe<War>(`${API_BASE}/api/advertisers/${encodeURIComponent(brand)}`),
        safe<Spend>(`${API_BASE}/api/spend/${encodeURIComponent(brand)}`),
        safe<Placements>(`${API_BASE}/api/placements/${encodeURIComponent(brand)}`),
        safe<Explain>(`${API_BASE}/api/explain/${encodeURIComponent(brand)}`),
      ]);
      if (!alive) return;
      setWar(w);
      setSpend(s);
      setPlaces(p);
      setExplain(e);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [brand]);


  // Derived numbers
  const topTheme = war?.top_themes?.[0]?.theme ?? "—";
  const monthly = war?.monthly_velocity ?? [];
  const thisMonthAds = monthly.length ? monthly[monthly.length - 1].ads : 0;
  const velocityDir = useMemo(() => {
    if (monthly.length < 2) return null;
    const last = monthly[monthly.length - 1].ads;
    const prev = monthly[monthly.length - 2].ads;
    if (last > prev * 1.1) return "ramping" as const;
    if (last < prev * 0.9) return "retreating" as const;
    return "steady" as const;
  }, [monthly]);

  // Industry — derive from most common ai_tags.industry across recent_ads
  const derivedIndustry = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ad of war?.recent_ads ?? []) {
      const tags = asTags(ad.ai_tags);
      const ind = typeof tags.industry === "string" ? tags.industry.trim().toLowerCase() : "";
      if (!ind) continue;
      counts[ind] = (counts[ind] ?? 0) + 1;
    }
    let best = "";
    let max = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > max) { best = k; max = v; }
    }
    return best;
  }, [war]);

  // Sentiment radar values (0-100) — recalculated per-ad from war.recent_ads
  const sentimentAxes = useMemo(() => {
    const ads = war?.recent_ads ?? [];
    const total = ads.length;
    if (!total) return { Trust: 0, Urgency: 0, Aspiration: 0, Simplicity: 0, Security: 0 };
    let trust = 0, urgency = 0, aspiration = 0, simplicity = 0, security = 0;
    const ASP = ["growth", "future", "opportunity", "aspirat", "achieve", "dream", "success"];
    const SIM = ["simple", "easy", "fast", "instant", "quick"];
    const SEC = ["security", "safe", "protect", "guard", "secure"];
    for (const ad of ads) {
      const tags = asTags(ad.ai_tags);
      const sent = (typeof tags.sentiment === "string" ? tags.sentiment : "").toLowerCase();
      if (sent === "positive") trust++;
      if (sent === "urgency") urgency++;
      const themes = Array.isArray(tags.themes)
        ? (tags.themes as unknown[]).filter((x): x is string => typeof x === "string").map((s) => s.toLowerCase())
        : [];
      if (themes.some((t) => ASP.some((k) => t.includes(k)))) aspiration++;
      if (themes.some((t) => SIM.some((k) => t.includes(k)))) simplicity++;
      if (themes.some((t) => SEC.some((k) => t.includes(k)))) security++;
    }
    const pct = (n: number) => Math.max(0, Math.min(100, Math.round((n / total) * 100)));
    return {
      Trust: pct(trust),
      Urgency: pct(urgency),
      Aspiration: pct(aspiration),
      Simplicity: pct(simplicity),
      Security: pct(security),
    };
  }, [war]);

  const colourSwatches = useMemo(() => {
    const out: string[] = [];
    for (const ad of war?.recent_ads ?? []) {
      for (const c of ad.primary_colours ?? []) {
        if (typeof c === "string" && /^#?[0-9a-f]{3,8}$/i.test(c) && !out.includes(c)) {
          out.push(c.startsWith("#") ? c : `#${c}`);
        }
        if (out.length >= 5) break;
      }
      if (out.length >= 5) break;
    }
    return out;
  }, [war]);

  // Filter creative preview cards by seasonal cluster (simple month-based)
  const filteredRecent = useMemo(() => {
    const all = (war?.recent_ads ?? []).slice(0, 6);
    if (!seasonalFilter) return all;
    const months: Record<string, number[]> = {
      eofy: [5, 6], christmas: [11, 0], tax: [6, 7], back_to_school: [0, 1],
    };
    const ms = months[seasonalFilter];
    if (!ms) return all;
    return all.filter((a) => {
      const t = a.first_seen ? new Date(a.first_seen).getMonth() : -1;
      return ms.includes(t);
    });
  }, [war, seasonalFilter]);

  // ─── Chart builders (memoised by data) ──────────────────────────────────────

  const buildChannel = useMemo(() => (canvas: HTMLCanvasElement) => {
    if (!ChartLib) return null;
    const split = war?.channel_split ?? {};
    const data = [
      { label: "Google Search", v: split.search ?? 0, c: "#10b981" },
      { label: "Programmatic", v: split.display ?? 0, c: "#3b82f6" },
      { label: "Video/YouTube", v: split.video ?? 0, c: "#ef4444" },
      { label: "Display Image", v: split.image ?? 0, c: "#f59e0b" },
      { label: "Meta/Social", v: split.social ?? 0, c: "#8b5cf6" },
    ].filter((d) => d.v > 0);
    const total = data.reduce((s, d) => s + d.v, 0) || 1;
    return new ChartLib(canvas, {
      type: "doughnut",
      data: { labels: data.map((d) => d.label), datasets: [{ data: data.map((d) => d.v), backgroundColor: data.map((d) => d.c), borderWidth: 0 }] },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10 } },
          tooltip: { callbacks: { label: (ctx: { label: string; raw: number }) => `${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw / total * 100)}%)` } },
        },
        cutout: "60%",
      },
    });
  }, [ChartLib, war]);

  const buildPlaces = useMemo(() => (canvas: HTMLCanvasElement) => {
    if (!ChartLib) return null;
    const sites = (places?.sites ?? []).slice(0, 10);
    return new ChartLib(canvas, {
      type: "bar",
      data: {
        labels: sites.map((s) => s.domain),
        datasets: [{ label: "Sightings", data: sites.map((s) => s.count), backgroundColor: "#3b82f6" }],
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    });
  }, [ChartLib, places]);

  const buildVelocity = useMemo(() => (canvas: HTMLCanvasElement) => {
    if (!ChartLib) return null;
    const v = monthly.slice(-6);
    return new ChartLib(canvas, {
      type: "line",
      data: {
        labels: v.map((m) => fmtMonth(m.month)),
        datasets: [{
          label: "Ads launched",
          data: v.map((m) => m.ads),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 4,
        }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }, [ChartLib, monthly]);

  const buildRadar = useMemo(() => (canvas: HTMLCanvasElement) => {
    if (!ChartLib) return null;
    const labels = Object.keys(sentimentAxes);
    const data = Object.values(sentimentAxes);
    return new ChartLib(canvas, {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: "Sentiment mix",
          data,
          backgroundColor: "rgba(59,130,246,0.20)",
          borderColor: "#3b82f6",
          pointBackgroundColor: "#3b82f6",
        }],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { r: { min: 0, max: 100, ticks: { stepSize: 25 } } },
      },
    });
  }, [ChartLib, sentimentAxes]);

  if (loading) {
    return (
      <WorkspaceShell title={brand}>
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading war room…</div>
      </WorkspaceShell>
    );
  }

  if (!war) {
    return (
      <WorkspaceShell title={brand}>
        <div className="space-y-4">
          <Link to="/app/advertisers" className="inline-flex items-center gap-2 text-sm hover:underline">
            <ArrowLeft size={14} /> Back to Advertisers
          </Link>
          <div className="card-flat p-12 text-center text-sm text-muted-foreground">
            No intelligence available for {brand} yet.
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  const totalAds = war.total_ads ?? 0;
  const totalSight = war.total_sightings ?? 0;
  const firstSeen = fmtDate(war.first_seen);

  return (
    <WorkspaceShell title={brand}>
      <div className="space-y-8">
        <Link to="/app/advertisers" className="inline-flex items-center gap-2 text-sm hover:underline text-muted-foreground">
          <ArrowLeft size={14} /> Back to Advertisers
        </Link>

        {/* SECTION 1 — Dark hero header */}
        <section className="rounded-[12px] bg-zinc-950 text-white p-8 md:p-10">
          {derivedIndustry && (
            <div className="mono text-[11px] uppercase tracking-widest text-amber-300 mb-3">{derivedIndustry}</div>
          )}
          <div className="text-2xl md:text-3xl font-bold tracking-tight leading-snug">
            <span className="text-amber-300">{brand}</span> has run{" "}
            <span className="tabular-nums">{fmtNum(totalAds)}</span> ads since {firstSeen}.
            <br />
            Spotted <span className="tabular-nums">{fmtNum(totalSight)}</span>× across the open web.
            <br />
            <span className="text-emerald-300 capitalize">{topTheme}</span> is their #1 weapon.
          </div>
          {war.insight && (
            <p className="text-zinc-300 italic mt-4 text-base leading-relaxed">{war.insight}</p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Pill>{fmtMoney(spend?.estimated_monthly_spend)}/mo</Pill>
            <Pill>{fmtNum(totalSight)} sightings</Pill>
            <Pill>Since {fmtMonth(war.first_seen)}</Pill>
            <Pill>{fmtNum(thisMonthAds)} ads this month</Pill>
          </div>
          <div className="mt-6 flex gap-3">
            <a href="#all-creatives" className="inline-flex items-center gap-2 bg-white text-zinc-900 px-4 py-2 rounded-[8px] text-sm font-semibold hover:bg-zinc-100">
              View All Creatives ↓
            </a>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 border border-white/30 text-white px-4 py-2 rounded-[8px] text-sm font-semibold hover:bg-white/10"
            >
              <Download size={14} /> Export PDF
            </button>
          </div>
        </section>

        {/* Explain — weakness + opportunity */}
        {(explain?.their_weakness || explain?.opportunity_for_competitors) && (
          <section className="grid md:grid-cols-2 gap-4">
            {explain?.their_weakness && (
              <div className="rounded-[12px] border border-emerald-300 bg-emerald-50 p-5">
                <div className="mono text-[10px] uppercase tracking-widest text-emerald-800">Their weakness</div>
                <div className="mt-2 text-base text-emerald-950 leading-relaxed">
                  ⚡ {explain.their_weakness}
                </div>
              </div>
            )}
            {explain?.opportunity_for_competitors && (
              <div className="rounded-[12px] border border-amber-400 bg-amber-50 p-5">
                <div className="mono text-[10px] uppercase tracking-widest text-amber-800">Your opportunity</div>
                <div className="mt-2 text-base text-amber-950 leading-relaxed">
                  🎯 {explain.opportunity_for_competitors}
                </div>
              </div>
            )}
          </section>
        )}


        {/* SECTION 2 — 3 charts */}
        <section className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Channel Split" subtitle="Where their budget lands">
            {spend?.insight && <p className="text-gray-500 italic text-sm mb-3">{spend.insight}</p>}
            <div className="h-72"><ChartCanvas build={buildChannel} className="!w-full !h-full" /></div>
          </ChartCard>

          <ChartCard title="Where They Show Up" subtitle="Top sites your audience sees their ads">
            {places?.insight && <p className="text-gray-500 italic text-sm mb-3">{places.insight}</p>}
            <div className="h-72"><ChartCanvas build={buildPlaces} className="!w-full !h-full" /></div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(places?.sites ?? []).slice(0, 6).map((s) => (
                <span key={s.domain} className={`text-[10px] mono px-2 py-0.5 rounded-full border ${SITE_LABEL_TONE[s.label ?? ""] ?? "bg-zinc-50 text-zinc-700 border-zinc-300"}`}>
                  {s.domain} · {s.label ?? "General"}
                </span>
              ))}
            </div>
          </ChartCard>

          <ChartCard
            title="Creative Velocity"
            subtitle={
              velocityDir === "ramping" ? "↑ Ramping up"
                : velocityDir === "retreating" ? "↓ Pulling back"
                : "Holding steady"
            }
          >
            <div className="h-72"><ChartCanvas build={buildVelocity} className="!w-full !h-full" /></div>
          </ChartCard>
        </section>

        {/* SECTION 3 — Sentiment radar + Theme intelligence */}
        <section className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Sentiment Radar" subtitle="The emotional axes they hit">
            <div className="h-80"><ChartCanvas build={buildRadar} className="!w-full !h-full" /></div>
          </ChartCard>

          <div className="card-flat p-6">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Theme Intelligence</div>
            <h3 className="text-lg font-bold tracking-tight mt-1">What they keep saying</h3>
            <p className="text-gray-500 italic text-sm mt-2">
              <span className="capitalize">{topTheme}</span> is their weapon — every other message orbits around it.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(war.top_themes ?? []).slice(0, 8).map((t) => (
                <span
                  key={t.theme}
                  className="px-3 py-2 rounded-full border border-ink text-sm font-medium capitalize"
                >
                  {t.theme}
                  <span className="ml-2 mono text-[10px] text-muted-foreground">{fmtNum(t.count)} · {fmtPct(t.pct)}</span>
                </span>
              ))}
            </div>


            <div className="mt-5 space-y-2 text-sm">
              {war.finance_offers?.[0] && (
                <div className="bg-amber-100 border border-amber-500 text-amber-950 rounded-[8px] px-3 py-2">
                  💰 Top offer: <span className="font-semibold">{war.finance_offers[0]}</span>
                </div>
              )}
              {war.top_ctas?.[0] && (
                <div className="px-3 py-2 rounded-[8px] bg-zinc-50 border border-zinc-200">
                  📢 Top CTA: <span className="font-semibold">{war.top_ctas[0].cta}</span>
                </div>
              )}
              <div className="px-3 py-2 rounded-[8px] bg-zinc-50 border border-zinc-200">
                👥 <span className="font-semibold tabular-nums">{fmtPct(war.has_people_pct)}</span> of ads feature real people
              </div>
            </div>

            {colourSwatches.length > 0 && (
              <div className="mt-4">
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Brand colours in play</div>
                <div className="flex gap-2">
                  {colourSwatches.map((c) => (
                    <div key={c} className="h-8 w-8 rounded-full border border-ink/20" style={{ background: c }} title={c} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4 — Spend breakdown */}
        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">Estimated Media Spend</h2>
          {spend?.insight && <p className="text-gray-500 italic mb-4">{spend.insight}</p>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Est." value={`${fmtMoney(spend?.estimated_monthly_spend)}/mo`} accent="bg-zinc-950 text-white" />
            <StatCard label="Programmatic" value={fmtMoney(spend?.spend_by_channel?.display)} />
            <StatCard label="Search" value={fmtMoney(spend?.spend_by_channel?.search)} />
            <StatCard label="Video" value={fmtMoney(spend?.spend_by_channel?.video)} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Estimated using Australian market rates. <span className="capitalize">{spend?.confidence ?? "low"}</span> confidence.
          </p>
        </section>


        {/* SECTION 5 — Seasonal clusters */}
        {war.seasonal_clusters && Object.values(war.seasonal_clusters).some((v) => (v ?? 0) > 0) && (
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-3">Seasonal Push</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(war.seasonal_clusters).map(([k, v]) => {
                if (!v) return null;
                const active = seasonalFilter === k;
                return (
                  <button
                    key={k}
                    onClick={() => setSeasonalFilter(active ? null : k)}
                    className={`px-4 py-2 rounded-[8px] border text-sm font-semibold transition-colors ${
                      active ? "bg-zinc-950 text-white border-zinc-950" : "bg-paper border-ink/30 hover:border-ink"
                    }`}
                  >
                    {SEASONAL_LABEL[k] ?? k} <span className="mono text-xs opacity-70 ml-1">{v} ads</span>
                  </button>
                );
              })}
              {seasonalFilter && (
                <button onClick={() => setSeasonalFilter(null)} className="text-xs text-muted-foreground underline self-center ml-2">
                  Clear filter
                </button>
              )}
            </div>
          </section>
        )}

        {/* SECTION 6 — Creative preview */}
        <section id="all-creatives">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-bold tracking-tight">Latest Creatives</h2>
            <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{filteredRecent.length} shown</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecent.map((ad) => <RecentCard key={ad.id} ad={ad} brand={brand} />)}
            {filteredRecent.length === 0 && (
              <div className="col-span-full card-flat p-8 text-center text-sm text-muted-foreground">
                No creatives match this filter.
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => askBarbs(`Show me every creative from ${brand}`)}
              className="inline-flex items-center gap-2 bg-zinc-950 text-white px-6 py-3 rounded-[10px] text-sm font-semibold hover:bg-zinc-800"
            >
              VIEW ALL {fmtNum(totalAds)} CREATIVES →
            </button>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full text-xs font-medium">
      {children}
    </span>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card-flat p-5">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      {subtitle && <div className="text-sm font-semibold mt-0.5">{subtitle}</div>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={`rounded-[10px] border border-ink/15 p-4 ${accent ?? "bg-paper"}`}>
      <div className="mono text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function asTags(raw: Record<string, unknown> | string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return raw;
}

function classifySentiment(raw: unknown): "positive" | "urgency" | "neutral" {
  const s = (typeof raw === "string" ? raw : "").toLowerCase();
  if (/(positive|trust|happy|joy|optimis|reassur)/.test(s)) return "positive";
  if (/(urgen|fear|pressure|scarcit|warn|alarm|risk|limited)/.test(s)) return "urgency";
  return "neutral";
}

function sourceBadge(ad: RecentAd): string {
  const tags = asTags(ad.ai_tags);
  const src = (typeof tags.source === "string" ? tags.source : "").toLowerCase();
  if (src.includes("youtube")) return "YouTube";
  if (src.includes("meta") || src.includes("facebook") || src.includes("instagram")) return "Meta";
  if (src.includes("tiktok")) return "TikTok";
  if (src.includes("linkedin")) return "LinkedIn";
  if (src.includes("apify")) return "Apify";
  if (src.includes("dataforseo")) return "DataForSEO";
  return ad.ad_format === "video" ? "Video" : "Display";
}

function RecentCard({ ad, brand }: { ad: RecentAd; brand: string }) {
  const tags = asTags(ad.ai_tags);
  const themes = Array.isArray(tags.themes)
    ? (tags.themes as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 3)
    : [];
  const sent = classifySentiment(tags.sentiment);
  const copy = SENTIMENT_COPY[sent];
  const cta = typeof tags.call_to_action === "string" ? tags.call_to_action : null;
  const offer = typeof tags.finance_offer === "string" ? tags.finance_offer : null;
  const isVideo = (ad.ad_format ?? "").toLowerCase() === "video" || !!ad.video_url;
  const img = ad.image_url ?? ad.thumbnail_url ?? null;
  const fallbackColour = ad.primary_colours?.[0] ?? "#1f2937";

  const [imgOk, setImgOk] = useState(!!img);

  return (
    <div className="card-flat overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-zinc-100 overflow-hidden">
        {imgOk && img ? (
          <img
            src={img}
            alt={cta ?? brand}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div
            className="w-full h-full grid place-items-center text-white text-center px-4 text-sm font-semibold"
            style={{ background: fallbackColour }}
          >
            {cta ?? brand}
          </div>
        )}
        {isVideo && (
          <>
            <div className="absolute inset-0 grid place-items-center bg-black/20 pointer-events-none">
              <div className="bg-white/90 rounded-full p-3"><Play size={20} className="text-zinc-900" /></div>
            </div>
            <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">Video</span>
          </>
        )}
        <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] mono px-2 py-0.5 rounded">
          {sourceBadge(ad)}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="text-xs text-muted-foreground">
          {copy.icon} {copy.line}
          {ad.ai_tags && (
            <span className="ml-1 text-muted-foreground/70">
              · {PLATFORM_LABEL[(ad.ad_format ?? "").toLowerCase()] ?? "Ad"}
            </span>
          )}
        </div>

        {offer && (
          <div className="bg-amber-100 border border-amber-500 text-amber-950 rounded-[6px] px-2 py-1 text-xs font-semibold">
            💰 {offer}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Spotted {fmtNum(Number(ad.sighting_count) || 0)}× since {fmtDate(ad.first_seen)}
        </div>

        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {themes.map((t) => (
              <button
                key={t}
                onClick={() => askBarbs(`Show me all ${t} ads from ${brand}`)}
                className="text-[10px] mono px-2 py-0.5 rounded-full border border-ink/30 hover:bg-ink hover:text-paper"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertiser/$domain")({
  head: () => ({ meta: [{ title: "Advertiser War Room — RevenueAd" }] }),
  component: AdvertiserPage,
});
