import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Calendar as CalendarIcon, Image as ImageIcon, Lock,
  Play, Video as VideoIcon, X,
} from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_BASE = "https://api.revenuad.com";
const SOLO_TIERS = new Set(["solo", "free", "trial", "starter"]);

type AiTags = Record<string, unknown> & {
  themes?: unknown;
  finance_offer?: unknown;
  sentiment?: unknown;
  emotion?: unknown;
  channel?: unknown;
  call_to_action?: unknown;
  industry?: unknown;
  product?: unknown;
  demographics?: unknown;
  has_people?: unknown;
  has_logo?: unknown;
};

type Ad = {
  id: number | string;
  advertiser?: string | null;
  brand?: string | null;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  ad_format?: string | null;
  ad_duration_seconds?: number | string | null;
  ai_tags?: AiTags | string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  sighting_count?: number | string | null;
  channel?: string | null;
  source?: string | null;
};

type AdvertiserSummary = {
  brand?: string | null;
  advertiser?: string | null;
  industry?: string | null;
  ad_count?: number | string | null;
  total_sightings?: number | string | null;
  first_seen?: string | null;
  last_seen?: string | null;
};

function asTags(raw: AiTags | string | null | undefined): AiTags {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as AiTags; } catch { return {}; }
  }
  return raw;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.trim()) return v.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function num(v: unknown, fb = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fb;
}

function asBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.toLowerCase().trim();
    if (s === "true" || s === "yes" || s === "1") return true;
    if (s === "false" || s === "no" || s === "0") return false;
  }
  return null;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDuration(v: number | string | null | undefined): string | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const total = Math.round(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function adChannel(ad: Ad): string {
  const tags = asTags(ad.ai_tags);
  const c = (ad.channel ?? ad.source ?? (typeof tags.channel === "string" ? tags.channel : "") ?? "").toString().toLowerCase();
  if (c.includes("google")) return "google";
  if (c.includes("meta") || c.includes("facebook") || c.includes("instagram")) return "meta";
  return c || "other";
}

function channelLabel(c: string): string {
  if (c === "google") return "Google";
  if (c === "meta") return "Meta";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

type AdFormat = "video" | "display" | "text" | "image";
function adFormat(ad: Ad): AdFormat {
  const f = (ad.ad_format ?? "").toString().toLowerCase().trim();
  if (f === "video") return "video";
  if (f === "display") return "display";
  if (f === "text") return "text";
  if (ad.video_url) return "video";
  if (ad.image_url) return "display";
  return "image";
}

function adKind(ad: Ad): "video" | "image" {
  return adFormat(ad) === "video" ? "video" : "image";
}

type Sentiment = "positive" | "urgency" | "neutral";
function classifySentiment(raw: unknown): Sentiment {
  const s = (typeof raw === "string" ? raw : "").toLowerCase();
  if (/(positive|trust|happy|joy|optimis|reassur)/.test(s)) return "positive";
  if (/(urgen|fear|pressure|scarcit|warn|alarm|risk|limited)/.test(s)) return "urgency";
  return "neutral";
}
function sentimentMeta(s: Sentiment): { label: string; dot: string; chip: string; reaction: string; icon: string } {
  if (s === "positive") return {
    label: "Positive", dot: "bg-emerald-500",
    chip: "bg-emerald-50 border-emerald-500 text-emerald-900",
    reaction: "Trust-building message", icon: "🟢",
  };
  if (s === "urgency") return {
    label: "Urgency", dot: "bg-rose-500",
    chip: "bg-rose-50 border-rose-500 text-rose-900",
    reaction: "Pressure/fear-based", icon: "🔴",
  };
  return {
    label: "Neutral", dot: "bg-zinc-400",
    chip: "bg-zinc-50 border-zinc-400 text-zinc-800",
    reaction: "Awareness play", icon: "⚪",
  };
}

function askBarbs(query: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("barbs:ask", { detail: query }));
}

type FilterKind = "all" | "image" | "video" | "display" | "text";
type FilterChannel = "all" | "google" | "meta";
type SortKey = "most_seen" | "most_recent" | "finance_first" | "urgency_first";

// ─────────────────────────────────────────────────────────────────────────────
// War Room helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function ChartCanvas({ build }: { build: (canvas: HTMLCanvasElement) => { destroy: () => void } | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const inst = build(ref.current);
    return () => { inst?.destroy(); };
  }, [build]);
  return <canvas ref={ref} />;
}

function fmtMonthYear(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function platformOf(ad: Ad): string {
  const t = asTags(ad.ai_tags);
  const p = typeof t.platform === "string" ? t.platform.toLowerCase() : "";
  if (p) return p;
  return adChannel(ad);
}

function adWarFormat(ad: Ad): "google_search" | "programmatic" | "video" | "meta" | "other" {
  const f = adFormat(ad);
  const plat = platformOf(ad);
  if (plat === "meta" || plat === "facebook" || plat === "instagram") return "meta";
  if (f === "video") return "video";
  if (f === "text") return "google_search";
  if (f === "display") return "programmatic";
  return "other";
}

const TRUST_T = ["trust","security","reliable","safe","secure","protect"];
const URGENCY_T = ["urgency","limited","act now","deadline","scarcity","hurry"];
const ASPIRATION_T = ["aspiration","success","future","growth","dream","achieve"];
const SIMPLICITY_T = ["simplicity","easy","simple","fast","quick","instant"];
const SECURITY_T = ["security","protect","safe","secure","guard","shield"];

function scoreAxis(themeCounts: Map<string, number>, keys: string[]): number {
  let s = 0;
  for (const k of keys) for (const [t, c] of themeCounts) if (t.toLowerCase().includes(k)) s += c;
  return s;
}

function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dn = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dn);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

function AdvertiserPage() {
  const { domain } = Route.useParams();
  const [summary, setSummary] = useState<AdvertiserSummary | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string | null>(null);
  const [tierLoaded, setTierLoaded] = useState(false);
  const [kind, setKind] = useState<FilterKind>("all");
  const [channel, setChannel] = useState<FilterChannel>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [sort, setSort] = useState<SortKey>("most_seen");
  const [active, setActive] = useState<Ad | null>(null);
  const [resolvedBrand, setResolvedBrand] = useState<string>("");
  const [richSummary, setRichSummary] = useState<Record<string, unknown> | null>(null);
  const [signals, setSignals] = useState<Record<string, unknown> | null>(null);
  const [placements, setPlacements] = useState<Array<{ site: string; count: number }>>([]);
  const ChartLib = useChartJs();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) { if (alive) { setTier("solo"); setTierLoaded(true); } return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("stripe_status")
        .eq("id", uid)
        .maybeSingle();
      if (!alive) return;
      setTier((prof?.stripe_status ?? "").toString().toLowerCase() || null);
      setTierLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const dom = domain.toLowerCase().trim();
      const host = dom.replace(/^www\./, "");
      const root = host.split(".")[0] ?? host;

      const advList = await fetch(`${API_BASE}/api/advertisers`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const advArr: Array<Record<string, unknown>> =
        (advList?.advertisers ?? advList?.data ?? (Array.isArray(advList) ? advList : [])) as Array<Record<string, unknown>>;

      const domainMatches = advArr.filter((a) => {
        const fields = [a.domain, a.website, a.url, a.host]
          .map((v) => (typeof v === "string" ? v.toLowerCase() : ""))
          .join(" ");
        return fields.includes(host) || fields.includes(root);
      });

      const matchedSummary = (domainMatches[0] ?? null) as AdvertiserSummary | null;

      const candidates = new Set<string>();
      for (const m of domainMatches) {
        const n = (m.name ?? m.advertiser ?? m.brand) as unknown;
        if (typeof n === "string" && n.trim()) candidates.add(n.trim());
      }
      candidates.add(root);
      candidates.add(root.charAt(0).toUpperCase() + root.slice(1));
      if (root === "commbank") {
        candidates.add("CommBank");
        candidates.add("Commonwealth Bank");
      }

      const results = await Promise.all(
        [...candidates].map((brand) =>
          fetch(`${API_BASE}/api/ads?brand=${encodeURIComponent(brand)}&limit=200`)
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );

      const merged = new Map<string, Ad>();
      for (const res of results) {
        const list: Ad[] = res?.ads ?? res?.data ?? (Array.isArray(res) ? res : []);
        for (const ad of list) {
          const key = String(ad.id ?? ad.image_url ?? ad.video_url ?? Math.random());
          if (!merged.has(key)) merged.set(key, ad);
        }
      }
      const mergedAds = [...merged.values()];

      const primary =
        (matchedSummary?.brand as string | undefined) ??
        (matchedSummary?.advertiser as string | undefined) ??
        mergedAds.find((a) => a.advertiser || a.brand)?.advertiser ??
        mergedAds.find((a) => a.advertiser || a.brand)?.brand ??
        root;

      if (!alive) return;
      setSummary(matchedSummary);
      setAds(mergedAds);
      setResolvedBrand(String(primary));
      setLoading(false);

      // Side fetches — non-blocking
      if (primary) {
        fetch(`${API_BASE}/api/advertisers/${encodeURIComponent(String(primary))}`)
          .then((r) => (r.ok ? r.json() : null)).catch(() => null)
          .then((j) => { if (alive && j) setRichSummary(j); });
      }
      fetch(`${API_BASE}/api/signals/${encodeURIComponent(host)}`)
        .then((r) => (r.ok ? r.json() : null)).catch(() => null)
        .then((j) => { if (alive && j) setSignals(j); });

      // Top-5 ads → sightings → placement aggregation
      const topAds = [...mergedAds].sort((a, b) => num(b.sighting_count) - num(a.sighting_count)).slice(0, 5);
      const sightingResults = await Promise.all(
        topAds.map((a) =>
          fetch(`${API_BASE}/api/ads/${encodeURIComponent(String(a.id))}/sightings`)
            .then((r) => (r.ok ? r.json() : null)).catch(() => null),
        ),
      );
      const placeMap = new Map<string, number>();
      for (const res of sightingResults) {
        const list: Array<Record<string, unknown>> = res?.sightings ?? res?.data ?? (Array.isArray(res) ? res : []);
        for (const s of list) {
          const raw = (s.placement ?? s.site ?? s.publisher ?? s.domain) as unknown;
          const site = (typeof raw === "string" && raw.trim()) ? raw.trim() : "Google Display Network";
          placeMap.set(site, (placeMap.get(site) ?? 0) + 1);
        }
      }
      if (alive) {
        setPlacements([...placeMap.entries()]
          .map(([site, count]) => ({ site, count }))
          .sort((a, b) => b.count - a.count).slice(0, 10));
      }
    })();
    return () => { alive = false; };
  }, [domain]);

  const isBlocked = tierLoaded && tier !== null && SOLO_TIERS.has(tier);

  const filtered = useMemo(() => {
    const base = ads.filter((a) => {
      const fmt = adFormat(a);
      if (kind === "image" && !(fmt === "image" || fmt === "display")) return false;
      if (kind === "video" && fmt !== "video") return false;
      if (kind === "display" && fmt !== "display") return false;
      if (kind === "text" && fmt !== "text") return false;
      if (channel !== "all" && adChannel(a) !== channel) return false;
      if (from) {
        const t = a.first_seen ? new Date(a.first_seen).getTime() : 0;
        if (t < new Date(from).getTime()) return false;
      }
      if (to) {
        const t = a.first_seen ? new Date(a.first_seen).getTime() : 0;
        if (t > new Date(to).getTime() + 86400000) return false;
      }
      return true;
    });
    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sort === "most_seen") return num(b.sighting_count) - num(a.sighting_count);
      if (sort === "most_recent") {
        return new Date(b.last_seen ?? b.first_seen ?? 0).getTime()
          - new Date(a.last_seen ?? a.first_seen ?? 0).getTime();
      }
      if (sort === "finance_first") {
        const af = typeof asTags(a.ai_tags).finance_offer === "string" ? 1 : 0;
        const bf = typeof asTags(b.ai_tags).finance_offer === "string" ? 1 : 0;
        if (bf !== af) return bf - af;
        return num(b.sighting_count) - num(a.sighting_count);
      }
      if (sort === "urgency_first") {
        const au = classifySentiment(asTags(a.ai_tags).sentiment) === "urgency" ? 1 : 0;
        const bu = classifySentiment(asTags(b.ai_tags).sentiment) === "urgency" ? 1 : 0;
        if (bu !== au) return bu - au;
        return num(b.sighting_count) - num(a.sighting_count);
      }
      return 0;
    });
    return sorted;
  }, [ads, kind, channel, from, to, sort]);

  const derived = useMemo(() => {
    const themeCounts = new Map<string, number>();
    const offerCounts = new Map<string, number>();
    const ctaCounts = new Map<string, number>();
    const colours: string[] = [];
    const split = { google_search: 0, programmatic: 0, video: 0, meta: 0, other: 0 };
    let financeCount = 0;
    let hasPeopleCount = 0;
    let hasPeopleKnown = 0;
    let videoCount = 0;
    let totalSightings = 0;
    let earliest: string | null = null;
    const weekMap = new Map<string, number>();
    const monthAds = new Map<number, Ad[]>();

    for (const a of ads) {
      const t = asTags(a.ai_tags);
      for (const th of asStringArray(t.themes)) themeCounts.set(th, (themeCounts.get(th) ?? 0) + 1);
      const off = typeof t.finance_offer === "string" ? t.finance_offer : "";
      if (off.trim()) { financeCount += 1; offerCounts.set(off, (offerCounts.get(off) ?? 0) + 1); }
      const cta = typeof t.call_to_action === "string" ? t.call_to_action : "";
      if (cta.trim()) ctaCounts.set(cta, (ctaCounts.get(cta) ?? 0) + 1);
      const hp = asBool(t.has_people);
      if (hp !== null) { hasPeopleKnown += 1; if (hp) hasPeopleCount += 1; }
      const pc = asStringArray(t.primary_colours ?? (t as Record<string, unknown>).primary_colors);
      for (const c of pc) if (colours.length < 12) colours.push(c);
      const wf = adWarFormat(a);
      split[wf] += 1;
      if (adFormat(a) === "video") videoCount += 1;
      totalSightings += num(a.sighting_count);
      if (a.first_seen) {
        if (!earliest || new Date(a.first_seen) < new Date(earliest)) earliest = a.first_seen;
        const d = new Date(a.first_seen);
        if (Number.isFinite(d.getTime())) {
          const k = isoWeekKey(d);
          weekMap.set(k, (weekMap.get(k) ?? 0) + 1);
          const m = d.getMonth();
          const arr = monthAds.get(m) ?? [];
          arr.push(a);
          monthAds.set(m, arr);
        }
      }
    }

    const themes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]);
    const topTheme = themes[0]?.[0] ?? "their core message";
    const topOffer = [...offerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topCta = [...ctaCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const peoplePct = hasPeopleKnown > 0 ? Math.round((hasPeopleCount / hasPeopleKnown) * 100) : 0;

    // Last 12 weeks
    const now = new Date();
    const weeks: { label: string; key: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 7 * 86400000);
      const k = isoWeekKey(d);
      weeks.push({ label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), key: k, count: weekMap.get(k) ?? 0 });
    }
    const recent3 = weeks.slice(-3).reduce((s, w) => s + w.count, 0);
    const prev3 = weeks.slice(-6, -3).reduce((s, w) => s + w.count, 0);
    const trend = recent3 > prev3 ? "ramping" : recent3 < prev3 ? "retreating" : "steady";

    // Sentiment radar
    const radar = {
      Trust: scoreAxis(themeCounts, TRUST_T),
      Urgency: scoreAxis(themeCounts, URGENCY_T),
      Aspiration: scoreAxis(themeCounts, ASPIRATION_T),
      Simplicity: scoreAxis(themeCounts, SIMPLICITY_T),
      Security: scoreAxis(themeCounts, SECURITY_T),
    };
    const radarMax = Math.max(1, ...Object.values(radar));
    const radarNorm = Object.fromEntries(Object.entries(radar).map(([k, v]) => [k, Math.round((v / radarMax) * 100)])) as Record<string, number>;

    // Seasons
    const seasonAds = (months: number[]) => months.flatMap((m) => monthAds.get(m) ?? []);
    const seasonTopTheme = (list: Ad[], filterFn?: (th: string) => boolean): string | null => {
      const c = new Map<string, number>();
      for (const a of list) for (const th of asStringArray(asTags(a.ai_tags).themes)) {
        if (filterFn && !filterFn(th)) continue;
        c.set(th, (c.get(th) ?? 0) + 1);
      }
      return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    };
    const eofyList = seasonAds([4, 5]).filter((a) => typeof asTags(a.ai_tags).finance_offer === "string");
    const xmasList = seasonAds([10, 11]).filter((a) => asStringArray(asTags(a.ai_tags).themes).some((t) => /christmas|gift|family/i.test(t)));
    const taxList = seasonAds([6, 7]).filter((a) => asStringArray(asTags(a.ai_tags).themes).some((t) => /tax|savings|return/i.test(t)));
    const backList = seasonAds([0, 1]).filter((a) => asStringArray(asTags(a.ai_tags).themes).some((t) => /education|school/i.test(t)));
    const seasons = [
      { key: "EOFY", months: "May–Jun", count: eofyList.length, msg: seasonTopTheme(seasonAds([4, 5])) },
      { key: "Tax time", months: "Jul–Aug", count: taxList.length, msg: seasonTopTheme(seasonAds([6, 7])) },
      { key: "Back to school", months: "Jan–Feb", count: backList.length, msg: seasonTopTheme(seasonAds([0, 1])) },
      { key: "Christmas", months: "Nov–Dec", count: xmasList.length, msg: seasonTopTheme(seasonAds([10, 11])) },
    ];

    // This month ad count
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const adsThisMonth = ads.filter((a) => {
      if (!a.first_seen) return false;
      const d = new Date(a.first_seen);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    return {
      themeCounts, themes, topTheme, topOffer, topCta, peoplePct,
      colours: colours.slice(0, 5),
      split, financeCount, videoCount, totalSightings, earliest,
      weeks, trend, radarNorm, seasons, adsThisMonth,
    };
  }, [ads]);

  const headerBrand = resolvedBrand || summary?.brand || summary?.advertiser || domain;
  const brandLabel = String(headerBrand);
  const headerTotal = ads.length;
  const headerFirst = derived.earliest ?? summary?.first_seen ?? null;

  const recentSix = useMemo(
    () => [...ads].sort((a, b) =>
      new Date(b.first_seen ?? 0).getTime() - new Date(a.first_seen ?? 0).getTime()
    ).slice(0, 6),
    [ads],
  );

  const scrollToGrid = () => {
    document.getElementById("all-creatives")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <WorkspaceShell title={brandLabel} subtitle="War Room · competitive ad intelligence for this advertiser.">
      <div className="space-y-6">
        <Link to="/app/advertisers" className="mono text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={12} /> Back to advertisers
        </Link>

        {/* SECTION 1 — War Room Header */}
        <section className="rounded-[6px] overflow-hidden border-2 border-ink shadow-flat-md" style={{ background: "#0a0a0f" }}>
          <div className="p-8 md:p-10 text-white">
            <div className="mono text-[10px] uppercase tracking-widest text-white/50 mb-3">War Room</div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight">
              {loading ? "Gathering intel…" : (
                <>
                  <span className="text-white">{brandLabel}</span>
                  <span className="text-white/70"> has run </span>
                  <span className="text-amber-300">{headerTotal} ads</span>
                  <span className="text-white/70"> since we started watching on </span>
                  <span className="text-white">{fmtMonthYear(headerFirst)}</span>.
                  <br />
                  <span className="text-white/70">Spotted </span>
                  <span className="text-amber-300">{derived.totalSightings.toLocaleString()} times</span>
                  <span className="text-white/70"> across the open web. </span>
                  <span className="text-white capitalize">{derived.topTheme.replace(/_/g, " ")}</span>
                  <span className="text-white/70"> is their #1 weapon.</span>
                </>
              )}
            </h1>

            <div className="flex flex-wrap gap-2 mt-6">
              <Pill>Est. Spend $36k/mo</Pill>
              <Pill>{derived.totalSightings.toLocaleString()} sightings</Pill>
              <Pill>Watching since {fmtMonthYear(headerFirst)}</Pill>
              <Pill>{derived.adsThisMonth} ads this month</Pill>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <button onClick={scrollToGrid} className="px-4 py-2 rounded-[4px] bg-white text-ink font-semibold text-sm hover:bg-amber-200 transition-colors">
                View All Creatives ↓
              </button>
              <button onClick={() => window.print()} className="px-4 py-2 rounded-[4px] border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors">
                Export PDF
              </button>
              <button onClick={() => askBarbs(`Add ${brandLabel} to my brief`)} className="px-4 py-2 rounded-[4px] border border-white/30 text-white font-semibold text-sm hover:bg-white/10 transition-colors">
                Add to Brief
              </button>
            </div>
          </div>
        </section>

        {isBlocked ? (
          <PaywallCard />
        ) : (
          <>
            {/* SECTION 2 — Where They Show Up */}
            <SectionTitle eyebrow="Section 02" title="Where they show up" sub="Channel mix, placements and weekly velocity." />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <PanelCard title="Channel Split" caption="How they reach your audience">
                <div className="h-56">
                  {ChartLib && <ChartCanvas build={(c) => {
                    const data = [
                      { k: "Google Search", v: derived.split.google_search, blurb: "catching people actively looking", color: "#1a73e8" },
                      { k: "Programmatic", v: derived.split.programmatic, blurb: "following people around the web", color: "#f59e0b" },
                      { k: "Video", v: derived.split.video, blurb: "brand building on YouTube", color: "#ef4444" },
                      { k: "Meta", v: derived.split.meta, blurb: "social feed interruption", color: "#7c3aed" },
                    ].filter((d) => d.v > 0);
                    return new ChartLib(c, {
                      type: "doughnut",
                      data: { labels: data.map((d) => d.k), datasets: [{ data: data.map((d) => d.v), backgroundColor: data.map((d) => d.color), borderWidth: 2, borderColor: "#fff" }] },
                      options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } } },
                    });
                  }} />}
                </div>
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {[
                    { k: "Google Search", v: derived.split.google_search, blurb: "catching people actively looking" },
                    { k: "Programmatic", v: derived.split.programmatic, blurb: "following people around the web" },
                    { k: "Video", v: derived.split.video, blurb: "brand building on YouTube" },
                    { k: "Meta", v: derived.split.meta, blurb: "social feed interruption" },
                  ].map((row) => {
                    const total = derived.split.google_search + derived.split.programmatic + derived.split.video + derived.split.meta || 1;
                    const pct = Math.round((row.v / total) * 100);
                    return (
                      <li key={row.k}>
                        <span className="font-semibold text-ink">{row.k} {pct}%</span> — {row.blurb}
                      </li>
                    );
                  })}
                </ul>
              </PanelCard>

              <PanelCard title="Top Websites" caption="Where your audience is seeing their ads">
                <div className="h-56">
                  {ChartLib && placements.length > 0 && <ChartCanvas build={(c) => new ChartLib(c, {
                    type: "bar",
                    data: { labels: placements.map((p) => p.site), datasets: [{ data: placements.map((p) => p.count), backgroundColor: "#0a0a0f", borderRadius: 3 }] },
                    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ticks: { font: { size: 10 } } } } },
                  })} />}
                  {placements.length === 0 && (
                    <div className="h-full grid place-items-center text-xs text-muted-foreground">No placement data yet.</div>
                  )}
                </div>
              </PanelCard>

              <PanelCard title="Weekly Velocity" caption="Are they accelerating or retreating?">
                <div className="h-56">
                  {ChartLib && <ChartCanvas build={(c) => new ChartLib(c, {
                    type: "line",
                    data: { labels: derived.weeks.map((w) => w.label), datasets: [{ data: derived.weeks.map((w) => w.count), borderColor: "#0a0a0f", backgroundColor: "rgba(245,158,11,0.25)", fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: "#f59e0b" }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 } } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
                  })} />}
                </div>
                <div className="mt-2 text-xs font-semibold">
                  {derived.trend === "ramping" ? "↑ Ramping up — last 3 weeks above prior 3" :
                   derived.trend === "retreating" ? "↓ Pulling back — output is slowing" :
                   "→ Steady cadence"}
                </div>
              </PanelCard>
            </div>

            {/* SECTION 3 — What They're Saying */}
            <SectionTitle eyebrow="Section 03" title="What they're saying" sub="Emotional tone and theme intelligence across every creative." />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PanelCard title="Sentiment Radar" caption="Emotional levers being pulled">
                <div className="h-72">
                  {ChartLib && <ChartCanvas build={(c) => {
                    const labels = Object.keys(derived.radarNorm);
                    return new ChartLib(c, {
                      type: "radar",
                      data: { labels, datasets: [{ data: labels.map((l) => derived.radarNorm[l]), borderColor: "#0a0a0f", backgroundColor: "rgba(245,158,11,0.35)", pointBackgroundColor: "#0a0a0f" }] },
                      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { suggestedMin: 0, suggestedMax: 100, ticks: { display: false }, pointLabels: { font: { size: 11, weight: "bold" } } } } },
                    });
                  }} />}
                </div>
              </PanelCard>

              <PanelCard title="Theme Intelligence" caption="What our AI found in every creative">
                <div className="flex flex-wrap gap-2">
                  {derived.themes.slice(0, 10).map(([t, c]) => {
                    const pct = Math.round((c / Math.max(1, ads.length)) * 100);
                    return (
                      <button
                        key={t}
                        onClick={() => askBarbs(`Show me all ${t.replace(/_/g, " ")} ads from ${brandLabel}`)}
                        className="px-3 py-1.5 border-2 border-ink rounded-full text-xs font-semibold capitalize bg-paper hover:bg-amber-100 transition-colors"
                      >
                        {t.replace(/_/g, " ")} <span className="text-muted-foreground font-normal">· {c} · {pct}%</span>
                      </button>
                    );
                  })}
                  {derived.themes.length === 0 && <div className="text-xs text-muted-foreground">No themes detected yet.</div>}
                </div>
                <div className="mt-4 space-y-1.5 text-xs">
                  {derived.topOffer && <div><span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Top offer</span> <span className="font-semibold ml-1">{derived.topOffer}</span></div>}
                  {derived.topCta && <div><span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Top CTA</span> <span className="font-semibold ml-1">{derived.topCta}</span></div>}
                  <div><span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">People in ads</span> <span className="font-semibold ml-1">{derived.peoplePct}% show real people</span></div>
                  {derived.colours.length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Colour palette</span>
                      <div className="flex gap-1">
                        {derived.colours.map((c, i) => (
                          <span key={i} className="w-5 h-5 rounded-full border border-ink/30" style={{ background: c }} title={c} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PanelCard>
            </div>

            {/* SECTION 4 — Seasonal Intelligence */}
            <SectionTitle eyebrow="Section 04" title="Campaign patterns — what they do and when" sub="Seasonal moments and the message they push at each." />
            <div className="card-flat p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {derived.seasons.map((s) => (
                  <div key={s.key} className={`rounded-[6px] border-2 p-4 ${s.count > 0 ? "border-ink bg-amber-50" : "border-ink/15 bg-paper"}`}>
                    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.months}</div>
                    <div className="font-bold text-lg tracking-tight mt-1">{s.key}</div>
                    <div className="mt-2 text-xs">
                      {s.count > 0 ? (
                        <>
                          <span className="font-semibold">{s.count} ads</span>
                          {s.msg && <> · message: <span className="capitalize">{s.msg.replace(/_/g, " ")}</span></>}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Quiet during this window</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 5 — AI Creative Intelligence Summary */}
            <section className="rounded-[6px] border-2 border-ink shadow-flat-md text-white p-6" style={{ background: "#0a0a0f" }}>
              <div className="mono text-[10px] uppercase tracking-widest text-white/50">Section 05</div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight mt-1">What our AI read in every creative</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-5">
                <InsightCard headline="Dominant emotion" body={`Trust — ${derived.radarNorm.Trust || 0}/100 of every creative builds trust`} />
                <InsightCard headline="Finance offers" body={`${derived.financeCount} ads make a direct $ offer`} />
                <InsightCard headline="Human connection" body={`${derived.peoplePct}% feature real people`} />
                <InsightCard headline="Video investment" body={`${derived.videoCount} video ads tracked`} />
              </div>
              {richSummary && typeof richSummary.strategist_summary === "string" && (
                <p className="mt-5 text-sm text-white/80 italic border-l-2 border-amber-300 pl-4">
                  {String(richSummary.strategist_summary)}
                </p>
              )}
            </section>

            {/* SECTION 6 — Creative Library Preview */}
            <SectionTitle eyebrow="Section 06" title={`Latest creatives — ${headerTotal} ads captured`}
              sub={`Spotted ${derived.totalSightings.toLocaleString()} times since ${fmtMonthYear(headerFirst)}. Each sighting = one more time your audience saw this.`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentSix.map((ad) => <PreviewCard key={String(ad.id)} ad={ad} brand={brandLabel} onOpen={() => setActive(ad)} />)}
              {recentSix.length === 0 && !loading && (
                <div className="card-flat p-8 col-span-full text-center text-sm text-muted-foreground">No creatives yet.</div>
              )}
            </div>
            <div className="text-center">
              <button onClick={scrollToGrid} className="px-6 py-3 rounded-[4px] bg-ink text-white font-bold text-sm hover:bg-ink/85 transition-colors">
                VIEW ALL {headerTotal} CREATIVES →
              </button>
            </div>

            {/* Full grid below */}
            <div id="all-creatives" className="pt-4 border-t-2 border-ink/10">
              <SectionTitle eyebrow="Library" title="Full creative library" sub="Filter and sort every captured ad." />
            </div>

            {/* Filter bar */}
            <div className="card-flat p-3 flex flex-wrap items-center gap-2">
              <FilterGroup
                value={kind}
                onChange={setKind}
                options={[
                  { v: "all", label: "All" },
                  { v: "image", label: "Images" },
                  { v: "video", label: "Video" },
                  { v: "display", label: "Display" },
                  { v: "text", label: "Text" },
                ]}
              />
              <span className="w-px h-5 bg-ink/10 mx-1" />
              <FilterGroup
                value={channel}
                onChange={setChannel}
                options={[
                  { v: "all", label: "All channels" },
                  { v: "google", label: "Google" },
                  { v: "meta", label: "Meta" },
                ]}
              />
              <span className="w-px h-5 bg-ink/10 mx-1" />
              <div className="flex items-center gap-1.5 text-xs">
                <CalendarIcon size={13} className="text-muted-foreground" />
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-ink/20 rounded-[3px] px-2 py-1 bg-paper text-xs" aria-label="From date" />
                <span className="text-muted-foreground">→</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-ink/20 rounded-[3px] px-2 py-1 bg-paper text-xs" aria-label="To date" />
                {(from || to) && (
                  <button onClick={() => { setFrom(""); setTo(""); }} className="text-[10px] mono uppercase tracking-widest text-muted-foreground hover:text-ink ml-1">Clear</button>
                )}
              </div>
              <span className="w-px h-5 bg-ink/10 mx-1" />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Sort</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="border border-ink/20 rounded-[3px] px-2 py-1 bg-paper text-xs" aria-label="Sort ads">
                  <option value="most_seen">Most seen</option>
                  <option value="most_recent">Most recent</option>
                  <option value="finance_first">Finance offers first</option>
                  <option value="urgency_first">Urgency ads first</option>
                </select>
              </div>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground ml-auto">
                {filtered.length}/{ads.length}
              </span>
            </div>

            {loading ? (
              <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading ads…</div>
            ) : filtered.length === 0 ? (
              <div className="card-flat p-12 text-center text-sm text-muted-foreground">No ads match these filters.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((ad) => (
                  <AdCard key={ad.id} ad={ad} brand={brandLabel} onOpen={() => setActive(ad)} />
                ))}
              </div>
            )}

            {signals && Object.keys(signals).length > 0 && (
              <details className="card-flat p-4 text-xs">
                <summary className="mono uppercase tracking-widest text-muted-foreground cursor-pointer">Raw audience signals</summary>
                <pre className="mt-3 text-[10px] overflow-auto max-h-64">{JSON.stringify(signals, null, 2)}</pre>
              </details>
            )}
          </>
        )}
      </div>

      {active && <AdPanel ad={active} brand={brandLabel} onClose={() => setActive(null)} />}
    </WorkspaceShell>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/25 bg-white/5 text-white text-xs font-semibold">
      {children}
    </span>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="pt-2">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{eyebrow}</div>
      <h2 className="text-xl md:text-2xl font-bold tracking-tight mt-1">{title}</h2>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function PanelCard({ title, caption, children }: { title: string; caption?: string; children: React.ReactNode }) {
  return (
    <div className="card-flat p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div>
          <div className="font-bold tracking-tight">{title}</div>
          {caption && <div className="text-xs text-muted-foreground">{caption}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function InsightCard({ headline, body }: { headline: string; body: string }) {
  return (
    <div className="rounded-[6px] border border-white/15 bg-white/5 p-4">
      <div className="mono text-[10px] uppercase tracking-widest text-white/50">{headline}</div>
      <div className="text-sm font-semibold mt-1 leading-snug">{body}</div>
    </div>
  );
}

function PreviewCard({ ad, brand, onOpen }: { ad: Ad; brand: string; onOpen: () => void }) {
  const tags = asTags(ad.ai_tags);
  const themes = asStringArray(tags.themes).slice(0, 3);
  const finance = typeof tags.finance_offer === "string" ? tags.finance_offer : null;
  const sentiment = classifySentiment(tags.sentiment);
  const cta = typeof tags.call_to_action === "string" ? tags.call_to_action : null;
  const sightings = num(ad.sighting_count);
  const insight =
    sentiment === "urgency" ? "🔴 Pressure play" :
    sentiment === "positive" ? "🟢 Trust building" :
    "⚪ Awareness play";
  const displayBrand = ad.advertiser ?? ad.brand ?? brand;
  return (
    <button onClick={onOpen} className="card-flat overflow-hidden flex flex-col text-left hover:shadow-flat-md transition-shadow group">
      <div className="relative">
        <AdMedia ad={ad} />
        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/30 to-transparent">
          <div className="text-white text-xs font-semibold">{displayBrand}</div>
          {cta && <div className="text-white text-sm font-bold leading-snug line-clamp-2">{cta}</div>}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="text-xs font-semibold">{insight}</div>
        <div className="text-[11px] text-muted-foreground">
          Spotted {sightings > 0 ? `${sightings}×` : "—"} since {fmtMonthYear(ad.first_seen)}
        </div>
        {finance && (
          <div className="bg-amber-100 border border-amber-500 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold text-amber-950">
            {finance}
          </div>
        )}
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
            {themes.map((t) => (
              <span key={t} className="px-2 py-0.5 border border-ink/30 rounded-full text-[10px] font-medium capitalize">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function HeaderCell({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-base font-bold tracking-tight mt-1 truncate ${className}`}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="card-flat p-4">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tracking-tight mt-2 truncate ${capitalize ? "capitalize" : ""}`}>{value}</div>
    </div>
  );
}

function FilterGroup<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { v: T; label: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`text-xs px-2.5 py-1 rounded-[3px] border-2 transition-colors ${
            value === o.v ? "border-ink bg-secondary shadow-flat-sm font-semibold" : "border-transparent hover:border-ink/30"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function AdMedia({ ad }: { ad: Ad }) {
  const fmt = adFormat(ad);
  const isVideo = fmt === "video";
  const isDisplay = fmt === "display";
  const src = isVideo ? (ad.thumbnail_url ?? ad.image_url ?? null) : (ad.image_url ?? null);
  const [ok, setOk] = useState<boolean>(Boolean(src));
  const duration = fmtDuration(ad.ad_duration_seconds);

  const formatBadge = isVideo ? (
    <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-red-600 text-white text-[10px] mono uppercase tracking-widest font-semibold shadow">
      <VideoIcon size={10} /> Video
    </span>
  ) : isDisplay ? (
    <span className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-blue-600 text-white text-[10px] mono uppercase tracking-widest font-semibold shadow">
      <ImageIcon size={10} /> Display
    </span>
  ) : null;

  if (src && ok) {
    return (
      <div className="relative aspect-video bg-paper border-b border-ink/10 overflow-hidden">
        <img
          src={src}
          alt={ad.advertiser ?? ad.brand ?? "Creative"}
          loading="lazy"
          onError={() => setOk(false)}
          className="w-full h-full object-cover"
        />
        {formatBadge}
        {isVideo && duration && (
          <span className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-[3px] bg-black/75 text-white text-[10px] mono font-semibold">
            {duration}
          </span>
        )}
        {isVideo && (
          <div className="absolute inset-0 grid place-items-center bg-black/25 pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-white/95 grid place-items-center shadow">
              <Play size={20} className="text-ink ml-0.5" />
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="relative aspect-video bg-paper border-b border-ink/10 grid place-items-center text-muted-foreground">
      {formatBadge}
      {isVideo ? <VideoIcon size={26} /> : <ImageIcon size={26} />}
    </div>
  );
}

function AdCard({ ad, brand, onOpen }: { ad: Ad; brand: string; onOpen: () => void }) {
  const tags = asTags(ad.ai_tags);
  const themes = asStringArray(tags.themes).slice(0, 2);
  const finance = typeof tags.finance_offer === "string" ? tags.finance_offer : null;
  const sentiment = classifySentiment(tags.sentiment);
  const sMeta = sentimentMeta(sentiment);
  const sightings = num(ad.sighting_count);
  const ch = adChannel(ad);
  const cta = typeof tags.call_to_action === "string" ? tags.call_to_action : null;
  const displayBrand = ad.advertiser ?? ad.brand ?? brand;

  return (
    <button
      onClick={onOpen}
      className="card-flat overflow-hidden flex flex-col text-left hover:shadow-flat-md transition-shadow"
    >
      <AdMedia ad={ad} />
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Brand + sponsored label */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-bold truncate">{displayBrand}</span>
          <span className="mono text-[9px] uppercase tracking-widest text-muted-foreground border border-ink/20 px-1.5 py-0.5 rounded-[2px]">
            Sponsored
          </span>
        </div>

        {/* CTA headline */}
        {cta && (
          <div className="text-sm font-semibold leading-snug text-ink line-clamp-2">
            {cta}
          </div>
        )}

        {/* Sentiment + themes */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 text-[10px] mono uppercase tracking-widest border px-1.5 py-0.5 rounded-[3px] ${sMeta.chip}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sMeta.dot}`} />
            {sMeta.label}
          </span>
          {themes.map((t) => (
            <span key={t} className="px-2 py-0.5 border border-ink/30 rounded-full text-[10px] font-medium capitalize">
              {t.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {/* Finance offer pill */}
        {finance && (
          <div className="bg-amber-100 border border-amber-500 rounded-full px-2.5 py-1 text-[11px] font-semibold text-amber-950 self-start">
            {finance}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink/10 text-[11px] text-muted-foreground">
          <span className="mono">{sightings > 0 ? `Seen ${sightings}×` : "—"}</span>
          <span className="mono text-[10px] uppercase tracking-widest border border-ink/20 px-1.5 py-0.5 rounded-[2px]">
            {channelLabel(ch)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground mono">
          First seen {fmtDate(ad.first_seen)}
        </div>
      </div>
    </button>
  );
}

function AdPanel({ ad, brand, onClose }: { ad: Ad; brand: string; onClose: () => void }) {
  const tags = asTags(ad.ai_tags);
  const sentiment = classifySentiment(tags.sentiment);
  const sMeta = sentimentMeta(sentiment);
  const themes = asStringArray(tags.themes);
  const finance = typeof tags.finance_offer === "string" ? tags.finance_offer : null;
  const cta = typeof tags.call_to_action === "string" ? tags.call_to_action : null;
  const ch = adChannel(ad);

  const signals: Array<{ k: string; v: string }> = [];
  if (typeof tags.industry === "string") signals.push({ k: "Industry", v: tags.industry });
  if (typeof tags.product === "string") signals.push({ k: "Product", v: tags.product });
  if (typeof tags.demographics === "string") signals.push({ k: "Demographics", v: tags.demographics });
  else if (Array.isArray(tags.demographics)) signals.push({ k: "Demographics", v: (tags.demographics as unknown[]).join(", ") });
  const hp = asBool(tags.has_people);
  if (hp !== null) signals.push({ k: "Has People", v: hp ? "Yes" : "No" });
  const hl = asBool(tags.has_logo);
  if (hl !== null) signals.push({ k: "Has Logo", v: hl ? "Yes" : "No" });

  const handleChip = (theme: string) => {
    askBarbs(`Show me all ${theme.replace(/_/g, " ")} ads from ${brand}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-paper border-l border-ink h-full overflow-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-ink/10 p-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Creative detail</div>
            <div className="font-bold truncate">{ad.advertiser ?? ad.brand ?? brand}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {adFormat(ad) === "video" && ad.video_url ? (
            <video
              controls
              src={ad.video_url}
              poster={ad.thumbnail_url ?? ad.image_url ?? undefined}
              className="w-full aspect-video bg-black border border-ink/10 rounded-[4px]"
            />
          ) : (
            <AdMedia ad={ad} />
          )}

          {cta && (
            <Section label="Headline">
              <div className="text-sm font-semibold leading-snug">{cta}</div>
            </Section>
          )}

          {finance && (
            <Section label="Finance offer">
              <div className="bg-amber-100 border border-amber-500 rounded-[6px] px-3 py-2 text-sm font-semibold text-amber-950">
                {finance}
              </div>
            </Section>
          )}

          <Section label="Public Reaction">
            <div className={`flex items-center gap-2 border rounded-[6px] px-3 py-2 ${sMeta.chip}`}>
              <span className="text-base leading-none">{sMeta.icon}</span>
              <div>
                <div className="text-sm font-semibold">{sMeta.label}</div>
                <div className="text-xs">{sMeta.reaction}</div>
              </div>
            </div>
          </Section>

          <Section label="Key Signals">
            {signals.length === 0 ? (
              <div className="text-xs text-muted-foreground">No signal data.</div>
            ) : (
              <dl className="grid grid-cols-2 gap-2">
                {signals.map((s) => (
                  <div key={s.k} className="border border-ink/10 rounded-[4px] p-2">
                    <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.k}</dt>
                    <dd className="text-sm font-medium capitalize mt-0.5 break-words">{s.v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section label="Where Seen">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <KV k="Sightings" v={String(num(ad.sighting_count))} />
              <KV k="Platform" v={channelLabel(ch)} />
              <KV k="First seen" v={fmtDate(ad.first_seen)} />
              <KV k="Last seen" v={fmtDate(ad.last_seen)} />
            </div>
          </Section>

          <Section label="Keywords">
            {themes.length === 0 ? (
              <div className="text-xs text-muted-foreground">No themes.</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {themes.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleChip(t)}
                    className="px-2.5 py-1 border-2 border-ink rounded-full text-[11px] font-medium capitalize bg-paper hover:bg-secondary transition-colors"
                    title={`Ask Barbs about ${t.replace(/_/g, " ")}`}
                  >
                    {t.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section label="Raw AI tags">
            <Badge variant="outline" className="text-[10px] mono uppercase tracking-widest mb-2">debug</Badge>
            <pre className="text-[10px] bg-canvas border border-ink/10 rounded-[4px] p-2 overflow-auto max-h-48">
{JSON.stringify(tags, null, 2)}
            </pre>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      {children}
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="font-medium mt-0.5">{v}</div>
    </div>
  );
}

function PaywallCard() {
  return (
    <div className="card-flat p-10 text-center max-w-xl mx-auto">
      <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-500 grid place-items-center mx-auto mb-4">
        <Lock size={20} className="text-amber-800" />
      </div>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Agency plan required</div>
      <h2 className="text-2xl font-bold tracking-tight mt-2">Unlock the full ad library</h2>
      <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto">
        Drill into every creative, theme, finance offer and sighting history for any advertiser.
        Available on the Agency plan and above.
      </p>
      <Button asChild className="mt-5">
        <Link to="/app/settings">Upgrade plan</Link>
      </Button>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertiser/$domain")({
  head: ({ params }) => ({ meta: [{ title: `${params.domain} — Ad Library — RevenueAd` }] }),
  component: AdvertiserPage,
});
