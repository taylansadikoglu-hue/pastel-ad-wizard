import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, Play, Star, ExternalLink } from "lucide-react";
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
  advertiser?: string;
  name?: string;
  domain?: string;
  industry?: string;
  total_ads?: number;
  total_sightings?: number;
  first_seen?: string;
  last_seen?: string;
  channel_split?: Record<string, number>;
  top_themes?: { theme: string; count: number; pct: number }[];
  sentiment_breakdown?: { positive?: number; neutral?: number; urgency?: number };
  finance_offer_count?: number;
  finance_offers?: string[];
  top_ctas?: { cta: string; count: number }[];
  has_people_pct?: number;
  monthly_velocity?: { month: string; ads: number }[];
  seasonal_clusters?: Record<string, number>;
  recent_ads?: RecentAd[];
  insight?: string;
};

type Spend = {
  brand?: string;
  estimated_monthly_spend?: number;
  spend_by_channel?: { search?: number; display?: number; video?: number; social?: number; meta?: number };
  confidence?: string;
  methodology?: string;
  insight?: string;
};

type Placements = {
  brand?: string;
  total_placements?: number;
  sites?: { domain: string; count: number; pct?: number; label?: string }[];
  insight?: string;
};

type Channels = {
  channels?: Record<string, number>;
  by_channel?: Record<string, number>;
  insight?: string;
};

type NewsItem = {
  title?: string;
  url?: string;
  source?: string;
  published_at?: string;
  date?: string;
  sentiment?: string;
};

type News = { articles?: NewsItem[] };

type Sentiment = {
  trustpilot?: { rating?: number; reviews?: number };
  google?: { rating?: number; reviews?: number };
};

type AivisQuery =
  | string
  | {
      query?: string;
      text?: string;
      rank?: number | string;
      mention_count?: number;
      mentions?: number;
    };

type AivisTopBrand = string | { brand?: string; name?: string; rank?: number; mentions?: number };

type AiVisibility = {
  ai_share_of_voice?: number;
  queries?: AivisQuery[];
  top_brands?: AivisTopBrand[];
  industry?: string;
  total_responses?: number;
  mention_count?: number;
};

type AdvertiserListItem = {
  name?: string;
  brand?: string;
  domain?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function fmtMoney(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtNum(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}
function fmtPct(n: number | undefined | null): string {
  if (n == null || !Number.isFinite(n)) return "0%";
  const v = Math.abs(n) <= 1 ? n * 100 : n;
  return `${v.toFixed(1)}%`;
}
function rootSlug(d: string): string {
  return d.toLowerCase().replace(/^www\./, "").split(".")[0] ?? d;
}
function titleCase(s: string): string {
  return s.split(/[\s_-]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
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

const SITE_LABELS: Record<string, string> = {
  "news.com.au": "News",
  "smh.com.au": "News",
  "theage.com.au": "News",
  "abc.net.au": "News",
  "realestate.com.au": "Real Estate",
  "domain.com.au": "Real Estate",
  "seek.com.au": "Employment",
  "nrl.com": "Sports",
  "afl.com.au": "Sports",
  "canstar.com.au": "Finance",
  "finder.com.au": "Finance",
};
function labelSite(domain: string): string {
  const d = domain.toLowerCase().replace(/^www\./, "");
  return SITE_LABELS[d] ?? "General Web";
}
const SITE_LABEL_TONE: Record<string, string> = {
  Finance: "bg-amber-50 text-amber-900 border-amber-300",
  News: "bg-sky-50 text-sky-900 border-sky-300",
  Sports: "bg-emerald-50 text-emerald-900 border-emerald-300",
  "Real Estate": "bg-violet-50 text-violet-900 border-violet-300",
  Employment: "bg-rose-50 text-rose-900 border-rose-300",
  "General Web": "bg-zinc-50 text-zinc-700 border-zinc-300",
};
const SEASONAL_LABEL: Record<string, string> = {
  eofy: "EOFY",
  christmas: "Christmas",
  tax: "Tax",
  back_to_school: "Back to School",
};

// Channel donut config — canonical 6 channels (Meta/TikTok/LinkedIn = pipeline pending)
const CHANNEL_DEFS: { key: string; label: string; colour: string; aliases: string[]; pending?: boolean }[] = [
  { key: "youtube", label: "YouTube", colour: "#ef4444", aliases: ["youtube", "video"] },
  { key: "display", label: "Programmatic Display", colour: "#3b82f6", aliases: ["display", "programmatic", "image"] },
  { key: "search", label: "Google Search", colour: "#10b981", aliases: ["search", "google_search", "google"] },
  { key: "meta", label: "Meta", colour: "#8b5cf6", aliases: ["meta", "facebook", "instagram"], pending: true },
  { key: "tiktok", label: "TikTok", colour: "#0ea5e9", aliases: ["tiktok"], pending: true },
  { key: "linkedin", label: "LinkedIn", colour: "#0a66c2", aliases: ["linkedin"], pending: true },
];

function readChannelValue(src: Record<string, number> | undefined, aliases: string[]): number {
  if (!src) return 0;
  let total = 0;
  for (const a of aliases) {
    if (typeof src[a] === "number") total += src[a];
    if (typeof src[`${a}_pct`] === "number") total += src[`${a}_pct`];
  }
  return total;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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

  const [brand, setBrand] = useState<string>(() => titleCase(rootSlug(domain)));
  const [war, setWar] = useState<War | null>(null);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [places, setPlaces] = useState<Placements | null>(null);
  const [channels, setChannels] = useState<Channels | null>(null);
  const [news, setNews] = useState<News | null>(null);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [aivis, setAivis] = useState<AiVisibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [seasonalFilter, setSeasonalFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const ChartLib = useChartJs();

  // Step 1 — resolve brand name from /api/advertisers
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const safe = async <T,>(url: string): Promise<T | null> => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          return (await r.json()) as T;
        } catch { return null; }
      };
      const root = rootSlug(domain);
      const list = await safe<AdvertiserListItem[] | { advertisers?: AdvertiserListItem[] }>(`${API_BASE}/api/advertisers`);
      const items: AdvertiserListItem[] = Array.isArray(list)
        ? list
        : (list?.advertisers ?? []);
      const match = items.find((i) => {
        const n = (i.name ?? i.brand ?? "").toLowerCase();
        const d = (i.domain ?? "").toLowerCase().replace(/^www\./, "");
        return d === domain.toLowerCase() || d.startsWith(root) || n === root || n.replace(/\s+/g, "") === root;
      });
      const resolved = match?.name ?? match?.brand ?? titleCase(root);
      if (!alive) return;
      setBrand(resolved);

      const b = encodeURIComponent(resolved);
      const [w, s, p, c, n, se, av] = await Promise.all([
        safe<War>(`${API_BASE}/api/advertisers/${b}`),
        safe<Spend>(`${API_BASE}/api/spend/${b}`),
        safe<Placements>(`${API_BASE}/api/placements/${b}`),
        safe<Channels>(`${API_BASE}/api/channels/${b}`),
        safe<News>(`${API_BASE}/api/news/${b}`),
        safe<Sentiment>(`${API_BASE}/api/sentiment/${b}`),
        safe<AiVisibility>(`${API_BASE}/api/ai-visibility/${b}`),
      ]);
      if (!alive) return;
      setWar(w); setSpend(s); setPlaces(p); setChannels(c); setNews(n); setSentiment(se); setAivis(av);
      if (w?.advertiser) setBrand(w.advertiser);
      // eslint-disable-next-line no-console
      console.log("war:", w, "channels:", c, "aivis:", av, "sentiment:", se);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [domain]);

  // Derived
  const topTheme = war?.top_themes?.[0]?.theme ?? "";
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

  const derivedIndustry = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ad of war?.recent_ads ?? []) {
      const tags = asTags(ad.ai_tags);
      const ind = typeof tags.industry === "string" ? tags.industry.trim().toLowerCase() : "";
      if (!ind) continue;
      counts[ind] = (counts[ind] ?? 0) + 1;
    }
    let best = ""; let max = 0;
    for (const [k, v] of Object.entries(counts)) if (v > max) { best = k; max = v; }
    return best || (war?.industry ?? aivis?.industry ?? "");
  }, [war, aivis]);

  // Channel donut — merge /api/channels (by_channel + channels) + war.channel_split → canonical 6
  const channelRows = useMemo(() => {
    const src: Record<string, number> = {
      ...(war?.channel_split ?? {}),
      ...(channels?.channels ?? {}),
      ...(channels?.by_channel ?? {}),
    };
    return CHANNEL_DEFS.map((def) => ({ ...def, value: readChannelValue(src, def.aliases) }));
  }, [war, channels]);

  // Site label warnings
  const ownDomainRoot = rootSlug(domain);
  const ownDomainPlacement = useMemo(() => {
    const sites = places?.sites ?? [];
    if (!sites.length) return null;
    const total = sites.reduce((s, x) => s + (x.count ?? 0), 0) || 1;
    const sorted = [...sites].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    const top = sorted[0];
    if (!top) return null;
    if (rootSlug(top.domain) === ownDomainRoot) {
      return { domain: top.domain, pct: Math.round((top.count / total) * 100) };
    }
    return null;
  }, [places, ownDomainRoot]);

  // Sentiment radar — Trust/Urgency from war.sentiment_breakdown; Aspiration/Simplicity/Security from themes
  const sentimentAxes = useMemo(() => {
    const total = war?.total_ads ?? war?.recent_ads?.length ?? 0;
    const breakdown = war?.sentiment_breakdown ?? {};
    const positive = Number(breakdown.positive ?? 0);
    const urgencyN = Number(breakdown.urgency ?? 0);
    const ASP = ["growth", "future", "opportunity", "aspirat", "achieve", "dream", "success"];
    const SIM = ["simple", "easy", "fast", "instant", "quick"];
    const SEC = ["security", "safe", "protect", "guard", "secure", "trust"];
    const matchCount = (kws: string[]) =>
      (war?.top_themes ?? []).reduce((sum, t) => {
        const name = (t.theme ?? "").toLowerCase();
        return kws.some((k) => name.includes(k)) ? sum + (t.count ?? 0) : sum;
      }, 0);
    const pct = (n: number) => {
      if (!total) return 5;
      const raw = Math.round((n / total) * 100);
      return Math.max(5, Math.min(100, raw));
    };
    return {
      Trust: pct(positive),
      Urgency: pct(urgencyN),
      Aspiration: pct(matchCount(ASP)),
      Simplicity: pct(matchCount(SIM)),
      Security: pct(matchCount(SEC)),
    };
  }, [war]);

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

  // Chart builders
  const buildChannel = useMemo(() => (canvas: HTMLCanvasElement) => {
    if (!ChartLib) return null;
    const data = channelRows.filter((d) => d.value > 0);
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    if (!data.length) {
      // Render placeholder ring
      return new ChartLib(canvas, {
        type: "doughnut",
        data: { labels: ["Pipeline active"], datasets: [{ data: [1], backgroundColor: ["#e5e7eb"], borderWidth: 0 }] },
        options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, cutout: "60%" },
      });
    }
    return new ChartLib(canvas, {
      type: "doughnut",
      data: { labels: data.map((d) => d.label), datasets: [{ data: data.map((d) => d.value), backgroundColor: data.map((d) => d.colour), borderWidth: 0 }] },
      options: {
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10 } },
          tooltip: { callbacks: { label: (ctx: { label: string; raw: number }) => `${ctx.label}: ${Math.round(ctx.raw / total * 100)}%` } },
        },
        cutout: "60%",
      },
    });
  }, [ChartLib, channelRows]);

  const buildPlaces = useMemo(() => (canvas: HTMLCanvasElement) => {
    if (!ChartLib) return null;
    const sites = (places?.sites ?? []).slice(0, 10);
    return new ChartLib(canvas, {
      type: "bar",
      data: {
        labels: sites.map((s) => s.domain),
        datasets: [{ label: "Sightings", data: sites.map((s) => s.count), backgroundColor: "#3b82f6" }],
      },
      options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
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
          label: "Ads launched", data: v.map((m) => m.ads),
          borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.15)",
          fill: true, tension: 0.35, pointRadius: 4,
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
      data: { labels, datasets: [{ label: "Sentiment mix", data, backgroundColor: "rgba(59,130,246,0.20)", borderColor: "#3b82f6", pointBackgroundColor: "#3b82f6" }] },
      options: { plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 100, ticks: { stepSize: 25 } } } },
    });
  }, [ChartLib, sentimentAxes]);

  // Export brief
  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await fetch(`${API_BASE}/api/export/prospect-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, domain }),
      });
      if (!r.ok) throw new Error("export failed");
      const blob = await r.blob();
      downloadBlob(blob, `${rootSlug(domain)}-prospect-brief.pdf`);
    } catch {
      alert("Brief export is temporarily unavailable.");
    } finally {
      setExporting(false);
    }
  };

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
  const adsPerMonth = monthly.length ? Math.round(totalAds / monthly.length) : thisMonthAds;

  const channelRowsForDisplay = channelRows; // even zeros — UI handles fallback copy

  return (
    <WorkspaceShell title={brand}>
      <div className="space-y-8">
        <Link to="/app/advertisers" className="inline-flex items-center gap-2 text-sm hover:underline text-muted-foreground">
          <ArrowLeft size={14} /> Back to Advertisers
        </Link>

        {/* HERO */}
        <section className="rounded-[12px] bg-zinc-950 text-white p-8 md:p-10">
          {derivedIndustry && (
            <div className="mono text-[11px] uppercase tracking-widest text-amber-300 mb-3">{derivedIndustry}</div>
          )}
          <div className="text-2xl md:text-3xl font-bold tracking-tight leading-snug">
            <span className="text-amber-300">{brand}</span> ran{" "}
            <span className="tabular-nums">{fmtNum(totalAds)}</span> ads since {firstSeen}.
            <br />
            Spotted <span className="tabular-nums">{fmtNum(totalSight)}</span>× across the open web.
            {topTheme && (<><br /><span className="text-emerald-300 capitalize">{topTheme}</span> is their weapon.</>)}
          </div>
          {war.insight && <p className="text-zinc-300 italic mt-4 text-base leading-relaxed">{war.insight}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <Pill>{fmtMoney(spend?.estimated_monthly_spend)}/mo</Pill>
            <Pill>{fmtNum(totalSight)} sightings</Pill>
            <Pill>Since {fmtMonth(war.first_seen)}</Pill>
            <Pill>{fmtNum(adsPerMonth)} ads/month</Pill>
          </div>
          <div className="mt-6 flex gap-3">
            <a href="#all-creatives" className="inline-flex items-center gap-2 bg-white text-zinc-900 px-4 py-2 rounded-[8px] text-sm font-semibold hover:bg-zinc-100">
              View Creatives ↓
            </a>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-2 border border-white/30 text-white px-4 py-2 rounded-[8px] text-sm font-semibold hover:bg-white/10 disabled:opacity-60"
            >
              <Download size={14} /> {exporting ? "Building…" : "Download Brief"}
            </button>
          </div>
        </section>

        {/* SECTION 1 — 3 charts */}
        <section className="grid lg:grid-cols-3 gap-4">
          <ChartCard title="Channel Split" subtitle="Where their budget lands">
            {spend?.insight && <p className="text-gray-500 italic text-sm mb-3">{spend.insight}</p>}
            <div className="h-64"><ChartCanvas build={buildChannel} className="!w-full !h-full" /></div>
            <ul className="mt-3 space-y-1 text-xs">
              {channelRowsForDisplay.map((c) => (
                <li key={c.key} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.colour }} />
                    {c.label}
                  </span>
                  <span className={`mono tabular-nums ${c.value > 0 ? "text-zinc-900" : "text-muted-foreground italic"}`}>
                    {c.value > 0 ? `${Math.round(c.value)}` : "Pipeline active — data building"}
                  </span>
                </li>
              ))}
            </ul>
          </ChartCard>

          <ChartCard title="Where They Show Up" subtitle="Top publisher sites">
            {places?.insight && <p className="text-gray-500 italic text-sm mb-3">{places.insight}</p>}
            {ownDomainPlacement && (
              <div className="mb-3 rounded-[8px] bg-amber-50 border border-amber-300 text-amber-950 text-xs px-3 py-2">
                ⚠️ {ownDomainPlacement.pct}% retargeting own audience ({ownDomainPlacement.domain}) — low prospecting.
              </div>
            )}
            <div className="h-64"><ChartCanvas build={buildPlaces} className="!w-full !h-full" /></div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(places?.sites ?? []).slice(0, 8).map((s) => {
                const label = s.label ?? labelSite(s.domain);
                return (
                  <span key={s.domain} className={`text-[10px] mono px-2 py-0.5 rounded-full border ${SITE_LABEL_TONE[label] ?? "bg-zinc-50 text-zinc-700 border-zinc-300"}`}>
                    {s.domain} · {label}
                  </span>
                );
              })}
              {(places?.sites ?? []).length === 0 && (
                <span className="text-xs italic text-muted-foreground">Placement data pending</span>
              )}
            </div>
          </ChartCard>

          <ChartCard
            title="Creative Velocity"
            subtitle={velocityDir === "ramping" ? "↑ Ramping up" : velocityDir === "retreating" ? "↓ Pulling back" : "Holding steady"}
          >
            <p className="text-gray-500 italic text-sm mb-3">
              {monthly.length
                ? `Launched ${fmtNum(thisMonthAds)} ads this month. ${velocityDir === "ramping" ? "Expect more pressure." : velocityDir === "retreating" ? "Window opening up." : "Pacing is consistent."}`
                : "Velocity data building."}
            </p>
            <div className="h-64"><ChartCanvas build={buildVelocity} className="!w-full !h-full" /></div>
          </ChartCard>
        </section>

        {/* SECTION 2 — AI Visibility */}
        <section className="card-flat p-6">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">AI Visibility</div>
          <div className="mt-2 flex items-baseline gap-4 flex-wrap">
            <div className="text-5xl font-bold tabular-nums">{fmtPct(aivis?.ai_share_of_voice)}</div>
            <div className="text-sm text-muted-foreground">
              Appears in <span className="font-semibold text-zinc-900">{fmtPct(aivis?.ai_share_of_voice)}</span> of AI responses for{" "}
              <span className="capitalize">{derivedIndustry || "their industry"}</span> queries.
            </div>
          </div>
          {(aivis?.queries ?? []).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {aivis!.queries!.slice(0, 12).map((q) => (
                <span key={q} className="text-xs px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200">
                  “{q}”
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-xs italic text-muted-foreground">Query data pending — AI visibility index still building.</div>
          )}
        </section>

        {/* SECTION 3 — Customer Rating */}
        <section className="card-flat p-6">
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Customer Rating</div>
          <RatingRow sentiment={sentiment} />
        </section>

        {/* SECTION 4 — Sentiment radar + themes */}
        <section className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Sentiment Radar" subtitle="The emotional axes they hit">
            <p className="text-gray-500 italic text-sm mb-3">
              Strongest on <span className="font-semibold capitalize">{strongestAxis(sentimentAxes)}</span>. Tells you what tone their ads lead with.
            </p>
            <div className="h-72"><ChartCanvas build={buildRadar} className="!w-full !h-full" /></div>
          </ChartCard>

          <div className="card-flat p-6">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Theme Intelligence</div>
            <h3 className="text-lg font-bold tracking-tight mt-1">What they keep saying</h3>
            <p className="text-gray-500 italic text-sm mt-2">
              {topTheme ? <><span className="capitalize">{topTheme}</span> is their weapon — every other message orbits around it.</> : "Theme data building."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(war.top_themes ?? []).slice(0, 8).map((t) => (
                <span key={t.theme} className="px-3 py-2 rounded-full border border-ink text-sm font-medium capitalize">
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
          </div>
        </section>

        {/* SECTION 5 — Spend breakdown */}
        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">Estimated Media Spend</h2>
          {spend?.insight && <p className="text-gray-500 italic mb-4">{spend.insight}</p>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Est." value={`${fmtMoney(spend?.estimated_monthly_spend)}/mo`} accent="bg-zinc-950 text-white" />
            <StatCard label="Programmatic" value={fmtMoney(spend?.spend_by_channel?.display)} />
            <StatCard label="Search" value={fmtMoney(spend?.spend_by_channel?.search)} />
            <StatCard label="Video" value={fmtMoney(spend?.spend_by_channel?.video)} />
          </div>
          {!spend?.spend_by_channel?.meta && !spend?.spend_by_channel?.social && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-[8px] bg-amber-50 border border-amber-300 text-amber-950 text-xs px-3 py-1.5">
              Meta: Pending — paid-social spend not yet attributed.
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            {spend?.methodology ?? "Estimated using Australian market rates."}{" "}
            <span className="capitalize">{spend?.confidence ?? "low"}</span> confidence.
          </p>
        </section>

        {/* SECTION 6 — In The News */}
        <section>
          <h2 className="text-xl font-bold tracking-tight mb-3">In The News</h2>
          {(news?.articles ?? []).length === 0 ? (
            <div className="card-flat p-6 text-sm text-muted-foreground italic">No recent coverage found.</div>
          ) : (
            <div className="space-y-2">
              {(news?.articles ?? []).slice(0, 5).map((a, i) => {
                const sent = classifySentiment(a.sentiment);
                const tone = sent === "positive" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : sent === "urgency" ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-zinc-50 text-zinc-700 border-zinc-200";
                return (
                  <a key={i} href={a.url ?? "#"} target="_blank" rel="noopener noreferrer"
                    className="card-flat p-4 flex items-start gap-3 hover:border-ink transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-snug">{a.title ?? "Untitled"}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {a.source ?? "Press"} · {fmtDate(a.published_at ?? a.date)}
                      </div>
                    </div>
                    <span className={`text-[10px] mono px-2 py-0.5 rounded-full border ${tone} shrink-0`}>{sent}</span>
                    <ExternalLink size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 7 — Seasonal */}
        {war.seasonal_clusters && Object.values(war.seasonal_clusters).some((v) => (v ?? 0) > 0) && (
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-3">Seasonal Push</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(war.seasonal_clusters).map(([k, v]) => {
                if (!v) return null;
                const active = seasonalFilter === k;
                return (
                  <button key={k} onClick={() => setSeasonalFilter(active ? null : k)}
                    className={`px-4 py-2 rounded-[8px] border text-sm font-semibold transition-colors ${active ? "bg-zinc-950 text-white border-zinc-950" : "bg-paper border-ink/30 hover:border-ink"}`}>
                    {SEASONAL_LABEL[k] ?? titleCase(k)} <span className="mono text-xs opacity-70 ml-1">{fmtNum(v)} ads</span>
                  </button>
                );
              })}
              {seasonalFilter && (
                <button onClick={() => setSeasonalFilter(null)} className="text-xs text-muted-foreground underline self-center ml-2">Clear filter</button>
              )}
            </div>
          </section>
        )}

        {/* SECTION 8 — Creative grid */}
        <section id="all-creatives">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-bold tracking-tight">Latest Creatives</h2>
            <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{filteredRecent.length} shown</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecent.map((ad) => <RecentCard key={ad.id} ad={ad} brand={brand} />)}
            {filteredRecent.length === 0 && (
              <div className="col-span-full card-flat p-8 text-center text-sm text-muted-foreground">No creatives match this filter.</div>
            )}
          </div>
          <div className="mt-6 text-center">
            <a href={`${API_BASE}/api/advertisers/${encodeURIComponent(brand)}/creatives`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-zinc-950 text-white px-6 py-3 rounded-[10px] text-sm font-semibold hover:bg-zinc-800">
              VIEW ALL {fmtNum(totalAds)} CREATIVES →
            </a>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function strongestAxis(axes: Record<string, number>): string {
  let best = ""; let max = -1;
  for (const [k, v] of Object.entries(axes)) if (v > max) { best = k; max = v; }
  return best;
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

function RatingRow({ sentiment }: { sentiment: Sentiment | null }) {
  const tp = sentiment?.trustpilot?.rating;
  const gg = sentiment?.google?.rating;
  const best = Math.max(tp ?? 0, gg ?? 0);
  const verdict = best >= 4 ? "Customers love them — ads ride a tailwind."
    : best >= 2 ? "Mixed reputation — message has to work harder."
    : best > 0 ? "Ads are fighting uphill against weak reviews."
    : "Customer-rating data pending.";
  return (
    <div className="flex flex-wrap gap-4 items-center">
      <RatingPill label="Trustpilot" rating={tp} reviews={sentiment?.trustpilot?.reviews} />
      <RatingPill label="Google" rating={gg} reviews={sentiment?.google?.reviews} />
      <div className="text-sm text-muted-foreground italic">{verdict}</div>
    </div>
  );
}

function RatingPill({ label, rating, reviews }: { label: string; rating?: number; reviews?: number }) {
  if (rating == null) {
    return (
      <div className="rounded-[10px] border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs italic text-muted-foreground">
        {label}: data pending
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-ink/20 bg-paper px-4 py-2 inline-flex items-center gap-2">
      <Star size={14} className="fill-amber-400 text-amber-400" />
      <span className="font-bold tabular-nums">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">{label}{reviews ? ` · ${fmtNum(reviews)} reviews` : ""}</span>
    </div>
  );
}

const SENTIMENT_COPY = {
  positive: { icon: "🟢", line: "Trust" },
  urgency: { icon: "🔴", line: "Pressure" },
  neutral: { icon: "⚪", line: "Awareness" },
};

function sourceBadge(ad: RecentAd): string {
  const tags = asTags(ad.ai_tags);
  const src = (typeof tags.source === "string" ? tags.source : "").toLowerCase();
  if (src.includes("youtube")) return "YouTube";
  if (src.includes("meta") || src.includes("facebook") || src.includes("instagram")) return "Meta";
  if (src.includes("tiktok")) return "TikTok";
  if (src.includes("linkedin")) return "LinkedIn";
  if (src.includes("google") || src.includes("search")) return "Google";
  return ad.ad_format === "video" ? "Video" : "Display";
}

function formatBadge(ad: RecentAd): string {
  const f = (ad.ad_format ?? "").toLowerCase();
  if (f.includes("video")) return "VIDEO";
  if (f.includes("search") || f.includes("text")) return "SEARCH";
  if (f.includes("social")) return "SOCIAL";
  return "DISPLAY";
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
  const sources = [ad.image_url, ad.thumbnail_url].filter((u): u is string => typeof u === "string" && u.length > 0);
  const fallbackColour = ad.primary_colours?.[0] ?? "#1f2937";
  const fmt = formatBadge(ad);
  const channel = sourceBadge(ad);

  const [srcIdx, setSrcIdx] = useState(0);
  const currentSrc = sources[srcIdx];

  return (
    <div className="card-flat overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-zinc-100 overflow-hidden">
        {currentSrc ? (
          <img key={currentSrc} src={currentSrc} alt={cta ?? brand} className="w-full h-full object-cover" loading="lazy"
            onError={() => setSrcIdx((i) => i + 1)} />
        ) : (
          <div className="w-full h-full grid place-items-center text-white text-center px-4 text-sm font-semibold"
            style={{ background: fallbackColour }}>
            {cta ?? brand}
          </div>
        )}
        {isVideo && (
          <div className="absolute inset-0 grid place-items-center bg-black/20 pointer-events-none">
            <div className="bg-white/90 rounded-full p-3"><Play size={20} className="text-zinc-900" /></div>
          </div>
        )}
        <span className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded">{fmt}</span>
        <span className="absolute top-2 right-2 bg-white/90 text-zinc-900 text-[10px] mono px-2 py-0.5 rounded">{channel}</span>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="text-xs text-muted-foreground">{copy.icon} {copy.line}</div>
        {offer && (
          <div className="bg-amber-100 border border-amber-500 text-amber-950 rounded-[6px] px-2 py-1 text-xs font-semibold">
            💰 {offer}
          </div>
        )}
        {cta && <div className="text-sm font-semibold text-zinc-900">{cta}</div>}
        <div className="text-xs text-muted-foreground">
          Spotted {fmtNum(Number(ad.sighting_count) || 0)}× since {fmtDate(ad.first_seen)}
        </div>
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {themes.map((t) => (
              <span key={t} className="text-[10px] mono px-2 py-0.5 rounded-full border border-ink/30">{t}</span>
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
