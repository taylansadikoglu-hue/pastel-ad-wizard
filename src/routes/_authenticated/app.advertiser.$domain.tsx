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
      if (!total) return 15;
      const raw = Math.round((n / total) * 100);
      return Math.max(15, Math.min(100, raw));
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
    // Seasonal pills are display-only highlights — do not filter creatives.
    return (war?.recent_ads ?? []).slice(0, 6);
  }, [war]);

  // Chart builders


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

        {/* SECTION 1 — Channel split table (full width) */}
        <section>
          <ChannelSplitTable
            brand={brand}
            channelRows={channelRows}
            spendByChannel={spend?.spend_by_channel}
            insight={spend?.insight}
          />
        </section>

        {/* SECTION 1b — Publisher sites + Velocity */}
        <section className="grid lg:grid-cols-2 gap-4">
          <ChartCard title="Where They Show Up" subtitle="Top publisher sites">
            {places?.insight && <p className="text-gray-500 italic text-sm mb-3">{places.insight}</p>}
            {ownDomainPlacement && (
              <div className="mb-3 rounded-[8px] bg-amber-50 border border-amber-300 text-amber-950 text-xs px-3 py-2">
                ⚠️ {ownDomainPlacement.pct}% retargeting own audience ({ownDomainPlacement.domain}) — low prospecting.
              </div>
            )}
            <PublisherBars sites={places?.sites ?? []} />
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
        <AiVisibilitySection aivis={aivis} brand={brand} industry={derivedIndustry} />

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
            <SpendCard label="Programmatic" raw={spend?.spend_by_channel?.display} />
            <SpendCard label="Search" raw={spend?.spend_by_channel?.search} />
            <SpendCard label="Video" raw={spend?.spend_by_channel?.video} />
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            Low = few tracked placements, not zero spend.
          </p>
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

function SpendCard({ label, raw }: { label: string; raw: number | undefined | null }) {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  const display = n >= 1000 ? fmtMoney(n) : n > 0 ? `$${Math.round(n)} tracked` : "Pipeline";
  const muted = n < 1000;
  return (
    <div className="rounded-[10px] border border-ink/15 p-4 bg-paper">
      <div className="mono text-[10px] uppercase tracking-widest opacity-70">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${muted ? "text-muted-foreground" : ""}`}>{display}</div>
    </div>
  );
}

const CHANNEL_SPEND_MAP: Record<string, "search" | "display" | "video" | "social" | "meta" | null> = {
  youtube: "video",
  display: "display",
  search: "search",
  meta: "meta",
  tiktok: null,
  linkedin: null,
};

function ChannelSplitTable({
  brand,
  channelRows,
  spendByChannel,
  insight,
}: {
  brand: string;
  channelRows: { key: string; label: string; colour: string; value: number; pending?: boolean }[];
  spendByChannel?: { search?: number; display?: number; video?: number; social?: number; meta?: number };
  insight?: string;
}) {
  const rowsWithSpend = channelRows.map((c) => {
    const map = CHANNEL_SPEND_MAP[c.key];
    const spend =
      map === "meta"
        ? (spendByChannel?.meta ?? spendByChannel?.social ?? 0)
        : map
          ? (spendByChannel?.[map] ?? 0)
          : 0;
    return { ...c, spend };
  });
  const totalSpend = rowsWithSpend.reduce((s, r) => s + (r.spend || 0), 0);
  const active = rowsWithSpend.filter((r) => !r.pending && r.value > 0);
  const pending = rowsWithSpend.filter((r) => r.pending || r.value === 0);
  const top = [...active].sort((a, b) => b.spend - a.spend)[0];
  const topPct = totalSpend > 0 && top ? Math.round((top.spend / totalSpend) * 100) : 0;

  return (
    <div className="card-flat p-5">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Channel Split</div>
      <div className="text-sm font-semibold mt-0.5">Where their budget actually lands</div>
      {insight && <p className="text-gray-500 italic text-sm mt-2">{insight}</p>}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left mono text-[10px] uppercase tracking-widest text-muted-foreground border-b border-ink/10">
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3 text-right">Ads</th>
              <th className="py-2 pr-3 text-right">Est. Spend</th>
              <th className="py-2 pl-3 w-[40%]">Share of tracked spend</th>
            </tr>
          </thead>
          <tbody>
            {active.map((r) => {
              const pct = totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0;
              return (
                <tr key={r.key} className="border-b border-ink/5">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.colour }} />
                      <span className="font-medium">{r.label}</span>
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(r.value)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">{r.spend > 0 ? fmtMoney(r.spend) : "—"}</td>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: r.colour }} />
                      </div>
                      <span className="mono text-[11px] tabular-nums text-muted-foreground w-12 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {active.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-sm italic text-muted-foreground">Channel data still building.</td></tr>
            )}
            {pending.length > 0 && (
              <tr><td colSpan={4} className="pt-3"><div className="border-t border-dashed border-ink/20" /></td></tr>
            )}
            {pending.map((r) => (
              <tr key={r.key}>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-zinc-400" />
                    <span className="font-medium">{r.label}</span>
                  </span>
                </td>
                <td colSpan={3} className="py-2 text-xs italic text-muted-foreground">Pipeline active — hourly updates</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {top && topPct >= 60 && (
        <div className="mt-4 rounded-[8px] bg-amber-50 border border-amber-300 text-amber-950 px-4 py-3 text-sm">
          <span className="font-semibold tabular-nums">{topPct}%</span> of {brand}'s tracked spend is{" "}
          <span className="font-semibold">{top.label}</span>. They are a {top.label.toLowerCase()}-first brand.
          {pending.length > 0 && <> Zero social spend detected yet.</>}
        </div>
      )}
    </div>
  );
}

function PublisherBars({ sites }: { sites: { domain: string; count: number; pct?: number; label?: string }[] }) {
  const top = [...sites].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 10);
  const max = Math.max(1, ...top.map((s) => s.count ?? 0));
  if (top.length === 0) {
    return <div className="text-xs italic text-muted-foreground py-6">Placement data pending</div>;
  }
  return (
    <div className="space-y-2">
      {top.map((s) => {
        const pct = ((s.count ?? 0) / max) * 100;
        const label = s.label ?? labelSite(s.domain);
        const tone = SITE_LABEL_TONE[label] ?? "bg-zinc-50 text-zinc-700 border-zinc-300";
        return (
          <div key={s.domain} className="border border-ink/10 rounded-[8px] p-2.5 bg-paper">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold truncate">{s.domain}</span>
                <span className={`text-[10px] mono px-1.5 py-0.5 rounded-full border ${tone}`}>{label}</span>
              </div>
              <span className="mono tabular-nums text-sm font-bold shrink-0">{fmtNum(s.count ?? 0)}</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full overflow-hidden" style={{ height: 10 }}>
              <div style={{ width: `${Math.max(pct, 4)}%`, height: 10, background: "#6366f1", borderRadius: 999 }} />
            </div>
          </div>
        );
      })}
    </div>
  );

function normalizeQuery(q: AivisQuery): { text: string; rank?: number; mentions?: number } {
  if (typeof q === "string") return { text: q };
  const text = q.query ?? q.text ?? "";
  const rankNum = q.rank != null ? Number(q.rank) : undefined;
  return {
    text,
    rank: Number.isFinite(rankNum) ? rankNum : undefined,
    mentions: q.mention_count ?? q.mentions,
  };
}

function normalizeBrand(b: AivisTopBrand): { name: string; rank?: number; mentions?: number } {
  if (typeof b === "string") return { name: b };
  return { name: b.brand ?? b.name ?? "", rank: b.rank, mentions: b.mentions };
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function AiVisibilitySection({ aivis, brand, industry }: { aivis: AiVisibility | null; brand: string; industry: string }) {
  const queries = (aivis?.queries ?? []).map(normalizeQuery).filter((q) => q.text);
  const topBrands = (aivis?.top_brands ?? []).map(normalizeBrand).filter((b) => b.name);
  const totalResponses = aivis?.total_responses ?? queries.length;
  const mentioned = aivis?.mention_count
    ?? queries.filter((q) => (q.mentions ?? 0) > 0 || (q.rank ?? 0) > 0).length;
  const ind = industry || aivis?.industry || "their category";
  const me = topBrands.find((b) => b.name.toLowerCase() === brand.toLowerCase());
  const myRank = me?.rank;
  const beat = topBrands.filter((b) => myRank != null && b.rank != null && b.rank > myRank).slice(0, 3);

  if (!queries.length && !topBrands.length) {
    return (
      <section className="card-flat p-6">
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">AI Visibility</div>
        <div className="mt-3 text-sm italic text-muted-foreground">
          AI visibility data pending for {brand}. Index still building.
        </div>
      </section>
    );
  }

  return (
    <section className="card-flat p-6 space-y-5">
      <div>
        <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">AI Visibility</div>
        <div className="mt-2 text-lg md:text-xl font-semibold leading-snug">
          When Australians ask AI about <span className="capitalize">{ind}</span>,{" "}
          <span className="text-amber-700">{brand}</span> appears in{" "}
          <span className="tabular-nums">{fmtNum(mentioned)}</span> of{" "}
          <span className="tabular-nums">{fmtNum(totalResponses)}</span> responses.
        </div>
      </div>

      {queries.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {queries.slice(0, 9).map((q, i) => (
            <div key={`${q.text}-${i}`} className="rounded-[10px] border border-ink/15 bg-paper p-3 flex flex-col gap-2">
              <div className="text-sm font-medium leading-snug">“{q.text}”</div>
              <div className="flex items-center gap-2 mt-auto">
                {q.rank != null ? (
                  <span className="text-[10px] mono px-2 py-0.5 rounded-full bg-zinc-950 text-white">Rank {ordinal(q.rank)}</span>
                ) : (
                  <span className="text-[10px] mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">Not ranked</span>
                )}
                {q.mentions != null && (
                  <span className="text-[10px] mono text-muted-foreground">{fmtNum(q.mentions)} mentions</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {beat.length > 0 && (
        <div className="rounded-[10px] bg-emerald-50 border border-emerald-300 text-emerald-950 px-3 py-2 text-sm">
          Ahead of: <span className="font-semibold">{beat.map((b) => b.name).join(", ")}</span>
        </div>
      )}

      <div className="rounded-[10px] bg-zinc-950 text-white px-4 py-3 text-sm">
        When customers ask ChatGPT for <span className="capitalize">{ind}</span>,{" "}
        <span className="text-amber-300 font-semibold">{brand}</span>{" "}
        {myRank != null
          ? <>gets recommended <span className="font-semibold">{ordinal(myRank)}</span>.</>
          : <>is not yet in the recommended set.</>}
      </div>
    </section>
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
  const fmt = formatBadge(ad);
  const channel = sourceBadge(ad);

  const primarySrc = ad.image_url || ad.thumbnail_url || "";
  const fallbackText =
    (typeof (asTags(ad.ai_tags) as { call_to_action?: unknown }).call_to_action === "string"
      ? ((asTags(ad.ai_tags) as { call_to_action?: string }).call_to_action as string)
      : "") || ad.advertiser || brand;
  const primaryColour =
    (asTags(ad.ai_tags) as { primary_colours?: string[] }).primary_colours?.[0]
    ?? ad.primary_colours?.[0]
    ?? "#1a1a2e";

  return (
    <div className="card-flat overflow-hidden flex flex-col">
      <div className="relative overflow-hidden">
        {primarySrc ? (
          <img
            src={primarySrc}
            alt={cta ?? brand}
            style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
            onError={(e) => {
              const img = e.currentTarget;
              img.style.display = "none";
              const next = img.nextSibling as HTMLElement | null;
              if (next) next.style.display = "flex";
            }}
          />
        ) : null}
        <div
          style={{
            display: primarySrc ? "none" : "flex",
            width: "100%",
            height: "200px",
            background: primaryColour,
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: "bold",
            padding: "20px",
            textAlign: "center",
          }}
        >
          {fallbackText}
        </div>
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
