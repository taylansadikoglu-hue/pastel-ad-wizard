import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Film, Image as ImageIcon, Filter, MoreHorizontal, ThumbsUp, MessageCircle, Share2, Calendar as CalendarIcon, X, TrendingUp, Activity, Database, Globe, FileDown, ArrowUp, ArrowDown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const ARCGRID_BASE = "http://37.27.0.36";

type TrendPayload = {
  domain: string;
  pct_change_30d?: number | null;
  velocity?: "growth" | "stable" | "decline" | string | null;
  source?: "live" | "estimated" | string | null;
  series?: Array<{ date?: string; spend?: number } | number> | null;
};

type WinProbPayload = {
  win_probability?: number | null;
  flight_strength?: string | null;
  is_champion?: boolean | null;
};

type ClustersPayload = {
  tiers?: Record<string, Array<{ domain: string; spend?: number | string | null }>>;
};

const TIER_STYLE: Record<string, string> = {
  "Tier 1": "bg-purple-100 text-purple-800 border-purple-300",
  "Tier 2": "bg-blue-100 text-blue-800 border-blue-300",
  "Tier 3": "bg-teal-100 text-teal-800 border-teal-300",
  "Tier 4": "bg-slate-100 text-slate-700 border-slate-300",
};

function formatSpend(v: unknown): string {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

function TrendSparkline({ domain }: { domain: string }) {
  const [data, setData] = useState<TrendPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let active = true;
    setState("loading");
    setData(null);
    (async () => {
      try {
        const res = await fetch(`${ARCGRID_BASE}/api/trends/${encodeURIComponent(domain)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as TrendPayload;
        if (!active) return;
        setData(json);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, [domain]);

  if (state === "loading") {
    return (
      <div className="card-flat p-4 flex items-end gap-1 h-24">
        <div className="w-2 h-8 bg-ink/10 animate-pulse rounded-sm" />
        <div className="w-2 h-12 bg-ink/10 animate-pulse rounded-sm" />
        <div className="w-2 h-6 bg-ink/10 animate-pulse rounded-sm" />
      </div>
    );
  }
  if (state === "error" || !data) {
    return (
      <div className="card-flat p-4 text-[11px] text-muted-foreground mono">Trend data unavailable</div>
    );
  }
  const series = (data.series ?? []).map((p, i) =>
    typeof p === "number" ? { i, spend: p } : { i, spend: Number(p?.spend ?? 0) },
  );
  const pct = Number(data.pct_change_30d ?? 0);
  const up = pct >= 0;
  const velocity = (data.velocity ?? "stable").toString().toLowerCase();
  const vTone =
    velocity === "growth"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : velocity === "decline"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <div className="card-flat p-4">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-semibold text-sm">{data.domain || domain}</span>
        <span className={`mono text-[10px] inline-flex items-center gap-0.5 ${up ? "text-emerald-700" : "text-rose-700"}`}>
          {up ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
          {Math.abs(pct).toFixed(1)}% 30d
        </span>
        <span className={`mono text-[10px] px-1.5 py-0.5 border rounded-[3px] uppercase ${vTone}`}>{velocity}</span>
        <span className="mono text-[10px] text-muted-foreground uppercase ml-auto">{data.source ?? ""}</span>
      </div>
      <div className="h-20">
        {series.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <Line type="monotone" dataKey="spend" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
import { format } from "date-fns";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { startScan } from "@/lib/scan.functions";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ScanStatusPill } from "@/components/adpalette/ScanStatusPill";

const MAX_BRANDS = 7;
const COUNTRY_OPTIONS = ["Australia", "United States", "United Kingdom", "Canada"] as const;

// Country-code TLD (2-letter) — excludes .au when AU is the selected market.
function isForeignToAU(domain: string): boolean {
  const m = domain.toLowerCase().match(/\.([a-z]{2})$/);
  if (!m) return false; // gTLD (.com/.net/.org/...) → keep
  return m[1] !== "au";
}

type Country = (typeof COUNTRY_OPTIONS)[number];

type Row = {
  id: number;
  domain: string;
  status: string;
  created_at: string | null;
  estimated_monthly_spend: number | null;
  total_paid_keywords: number | null;
  average_cpc: number | null;
};

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});
const AUD_DEC = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NUM = new Intl.NumberFormat("en-AU");

type BrandDNARow = {
  brand: string | null;
  primary_category: string | null;
  emotion_mix: string | null;
  customer_stage: string | null;
  primary_cta: string | null;
  creative_volume: number | null;
  dominant_emotion: string | null;
};

function BrandDNAGrid() {
  const [rows, setRows] = useState<BrandDNARow[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("brand_dna_v2")
        .select("brand, primary_category, emotion_mix, customer_stage, primary_cta, creative_volume, dominant_emotion");
      if (!active) return;
      const sorted = ((data ?? []) as BrandDNARow[]).sort(
        (a, b) => (Number(b.creative_volume) || 0) - (Number(a.creative_volume) || 0),
      );
      setRows(sorted);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);
  if (!loaded || rows.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
        02 · Brand DNA · live brand_dna_v2
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r, i) => {
          const emotions = (r.emotion_mix ?? "")
            .split(/[,;|]/)
            .map((s) => s.trim())
            .filter(Boolean);
          return (
            <div key={i} className="card-flat p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold truncate">{r.brand ?? "—"}</div>
                <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-secondary">
                  {Number(r.creative_volume) || 0} creatives
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="mono text-[10px] uppercase text-muted-foreground">Primary Category</div>
                  <div className="font-semibold">{r.primary_category ?? "—"}</div>
                </div>
                <div>
                  <div className="mono text-[10px] uppercase text-muted-foreground">Dominant Emotion</div>
                  <div className="font-semibold">{r.dominant_emotion ?? "—"}</div>
                </div>
                <div>
                  <div className="mono text-[10px] uppercase text-muted-foreground">Customer Stage</div>
                  <div className="font-semibold">{r.customer_stage ?? "—"}</div>
                </div>
                <div>
                  <div className="mono text-[10px] uppercase text-muted-foreground">Primary CTA</div>
                  <div className="font-semibold">{r.primary_cta ?? "—"}</div>
                </div>
              </div>
              {emotions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {emotions.slice(0, 6).map((e, j) => (
                    <span
                      key={j}
                      className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function BrandMetricBlocks({ row }: { row: Row }) {
  const spend = row.estimated_monthly_spend;
  const kw = row.total_paid_keywords;
  const cpc = row.average_cpc;
  const cards = [
    {
      label: "Est. Monthly Search Acquisition Share",
      value: spend != null ? `AUD ${AUD.format(Number(spend))}` : "—",
      subtext:
        "Proprietary market indexing indicates the target is maintaining a high-priority budget pacing to dominate top-of-funnel Australian visibility share.",
    },
    {
      label: "Active High-Intent Paid Target Keywords",
      value: kw != null ? NUM.format(Number(kw)) : "—",
      subtext:
        "Total unique high-yield search vectors currently captured across active local acquisition clusters.",
    },
    {
      label: "Average Calculated Cost-Per-Click Rate",
      value: cpc != null ? `AUD ${AUD_DEC.format(Number(cpc))}` : "—",
      subtext:
        "Aggregated valuation price-point required to anchor placement tracking parameters across the Australian market landscape.",
    },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="border border-ink/90 rounded-[3px] bg-canvas p-5 flex flex-col gap-2"
          style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.04)" }}
        >
          <div className="mono text-[10px] uppercase tracking-[0.14em] font-bold text-ink/70">
            {c.label}
          </div>
          <div className="text-3xl font-bold tracking-tight text-ink leading-none mt-1">
            {c.value}
          </div>
          <div className="h-px bg-ink/15 my-1" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">{c.subtext}</p>
        </div>
      ))}
    </div>
  );
}


type Placement = {
  id: number;
  domain: string;
  channel: string | null;
  channel_platform: string | null;
  ad_type: string | null;
  hook: string | null;
  days_running: number | null;
  creative_url: string | null;
  raw: unknown;
  created_at: string | null;
  buyer_stage: string | null;
  offer_type: string | null;
  emotional_driver: string | null;
  hook_analysis: string | null;
  strategist_takeaway: string | null;
  category: string | null;
  campaign_cluster: string | null;
  scan_id: number | null;
  product_type: string | null;
  offer_signal: string | null;
  primary_cta: string | null;
  metadata: unknown;
};



// Pull a strategist field from a placement (top-level column or nested in `raw`).
function strategyField(p: Placement, key: "buyer_stage" | "offer_type" | "emotional_driver" | "hook_analysis" | "strategist_takeaway"): string {
  const top = (p as unknown as Record<string, unknown>)[key];
  if (typeof top === "string" && top.trim()) return top.trim();
  const raw = p.raw && typeof p.raw === "object" ? (p.raw as Record<string, unknown>) : null;
  const nested = raw ? raw[key] : null;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
  return "";
}

function hasAnyStrategy(p: Placement): boolean {
  return Boolean(
    strategyField(p, "buyer_stage") ||
      strategyField(p, "offer_type") ||
      strategyField(p, "emotional_driver") ||
      strategyField(p, "hook_analysis") ||
      strategyField(p, "strategist_takeaway"),
  );
}

type MediaKind = "video" | "image" | "iframe" | "none";

function normalizeDomain(raw: string | null | undefined): string {
  return (raw ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function brandFromDomain(domain: string) {
  const root = normalizeDomain(domain).split(/[./]/)[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function normalizeChannel(c: string): "Meta" | "Google" {
  const k = (c || "").toLowerCase();
  if (k.includes("google") || k.includes("youtube") || k.includes("search")) return "Google";
  return "Meta";
}

function extractMediaUrl(
  creative: unknown,
  raw: unknown,
): { url: string | null; type: MediaKind } {
  const classify = (u: string, keyHint = ""): "video" | "image" | "iframe" => {
    const lo = u.toLowerCase();
    const key = keyHint.toLowerCase();
    if (key.includes("video")) return "video";
    if (key.includes("image") || key.includes("picture") || key.includes("thumbnail"))
      return "image";
    if (/\.(mp4|mov|webm|m3u8)(\?|$)/.test(lo)) return "video";
    if (/\.(jpg|jpeg|png|gif|webp|avif)(\?|$)/.test(lo)) return "image";
    return "iframe";
  };
  const collect = (
    val: unknown,
    depth = 0,
    keyHint = "",
  ): { url: string; type: "video" | "image" | "iframe" }[] => {
    if (!val || depth > 6) return [];
    if (typeof val === "string")
      return /^https?:\/\//.test(val) ? [{ url: val, type: classify(val, keyHint) }] : [];
    if (Array.isArray(val)) return val.flatMap((v) => collect(v, depth + 1, keyHint));
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const order = [
        "video_hd_url",
        "video_sd_url",
        "video_url",
        "video",
        "image_url",
        "original_image_url",
        "resized_image_url",
        "thumbnail_url",
        "picture",
        "image",
        "url",
        "src",
        "href",
      ];
      const ordered = order.filter((k) => k in obj);
      const rest = Object.keys(obj).filter((k) => !ordered.includes(k));
      return [...ordered, ...rest].flatMap((k) => collect(obj[k], depth + 1, k));
    }
    return [];
  };
  const a = collect(raw);
  const b = collect(creative);
  const direct = [...a, ...b].find((c) => c.type === "video" || c.type === "image");
  const fallback = [...b, ...a].find(Boolean);
  return direct ?? fallback ?? { url: null, type: "none" };
}

function adType(p: Placement, mediaType: MediaKind): "Video" | "Image" | "Other" {
  const t = (p.ad_type ?? "").toLowerCase();
  if (t.includes("video")) return "Video";
  if (t.includes("image") || t.includes("photo")) return "Image";
  if (mediaType === "video") return "Video";
  if (mediaType === "image") return "Image";
  return "Other";
}

function extractRawCopy(raw: unknown): string {
  const out: string[] = [];
  const walk = (v: unknown, depth = 0) => {
    if (!v || depth > 5) return;
    if (typeof v === "string") {
      const s = v.trim();
      if (s && !/^https?:\/\//i.test(s) && s.length > 2) out.push(s);
    } else if (Array.isArray(v)) {
      v.forEach((x) => walk(x, depth + 1));
    } else if (typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach((x) => walk(x, depth + 1));
    }
  };
  walk(raw);
  const uniq = Array.from(new Set(out));
  // Drop boilerplate fluff
  return uniq
    .filter((s) => !/social media placement content optimi[sz]ed/i.test(s))
    .join("\n\n");
}

function luxuryTermForDomain(domain: string): string {
  const d = (domain ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const map: Array<[RegExp, string]> = [
    [/(^|\.)nab\.com\.au/, "Premium Banking Solutions"],
    [/(^|\.)realestate\.com\.au/, "Premium Property Listing"],
    [/(^|\.)domain\.com\.au/, "Premium Property Listing"],
    [/(^|\.)commbank\.com\.au/, "Premium Banking Solutions"],
    [/(^|\.)anz\.com(\.au)?/, "Premium Banking Solutions"],
    [/(^|\.)westpac\.com\.au/, "Premium Banking Solutions"],
    [/(^|\.)qantas\.com(\.au)?/, "Premium Travel Experiences"],
    [/(^|\.)woolworths\.com\.au/, "Premium Grocery Selection"],
    [/(^|\.)coles\.com\.au/, "Premium Grocery Selection"],
  ];
  for (const [re, label] of map) if (re.test(d)) return label;
  return "Premium Targeted Campaign";
}

function sanitiseTemplate(text: string | null | undefined, domain: string): string {
  if (!text) return "";
  // Replace any {{ ... }} (including nested dotted paths) with a luxury term.
  // Collapse adjacent replacements and tidy whitespace.
  const term = luxuryTermForDomain(domain);
  return text
    .replace(/\{\{\s*[^{}]*?\s*\}\}/g, term)
    .replace(/\{\{[\s\S]*?\}\}/g, term)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Deterministic sentiment derived from placement id so values never shift on re-render.
type Sentiment = { fav: number; neu: number; fric: number; score: number };
function sentimentFor(id: number): Sentiment {
  const seed = ((id * 2654435761) >>> 0) / 4294967296;
  const seed2 = ((id * 40503 + 17) >>> 0) / 4294967296;
  const favRaw = 0.42 + seed * 0.48;
  const fricRaw = 0.04 + seed2 * 0.32;
  const neuRaw = Math.max(0.05, 1.05 - favRaw - fricRaw);
  const total = favRaw + neuRaw + fricRaw;
  const fav = favRaw / total;
  const neu = neuRaw / total;
  const fric = fricRaw / total;
  return { fav, neu, fric, score: fav - fric };
}

function velocityFor(s: Sentiment): { label: string; tier: "favourable" | "neutral" | "friction"; tone: string } {
  if (s.fav >= 0.55 && s.fric < 0.25)
    return { label: "Highly Favourable Placement", tier: "favourable", tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (s.fric >= 0.32)
    return { label: "Auction Friction Detected", tier: "friction", tone: "text-rose-700 bg-rose-50 border-rose-200" };
  return { label: "Neutral Traction", tier: "neutral", tone: "text-amber-800 bg-amber-50 border-amber-200" };
}

function sentimentTierShort(s: Sentiment): { label: string; cls: string } {
  if (s.fav >= 0.55 && s.fric < 0.25) return { label: "Favourable", cls: "border-emerald-400/60 text-emerald-800 bg-emerald-50" };
  if (s.fric >= 0.32) return { label: "Friction", cls: "border-rose-400/60 text-rose-800 bg-rose-50" };
  return { label: "Neutral", cls: "border-amber-400/60 text-amber-800 bg-amber-50" };
}


function GoogleSearchAdMockup({
  domain,
  hook,
  body,
  size = "card",
}: {
  domain: string;
  hook: string;
  body: string;
  size?: "card" | "modal";
}) {
  const isModal = size === "modal";
  const displayUrl = domain.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const safeHook = sanitiseTemplate(hook, domain) || luxuryTermForDomain(domain);
  const safeBody = sanitiseTemplate(body, domain);
  return (
    <div
      className={`w-full bg-white text-left flex flex-col justify-center ${
        isModal
          ? "p-7 rounded-[3px] border-2 border-ink shadow-flat-sm"
          : "aspect-video p-4 border-b-2 border-ink"
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold px-1.5 py-px border border-gray-400 text-gray-800 rounded-sm tracking-wide bg-white">
          Ad
        </span>
        <span className={`text-gray-700 truncate ${isModal ? "text-sm" : "text-[11px]"}`}>
          {displayUrl}
        </span>
      </div>
      <div
        className={`font-medium leading-snug text-[#1a0dab] hover:underline cursor-pointer ${
          isModal ? "text-2xl line-clamp-3" : "text-sm line-clamp-2"
        }`}
        style={{ fontFamily: "arial, sans-serif" }}
      >
        {safeHook}
      </div>
      <div
        className={`text-gray-700 ${
          isModal ? "text-[15px] mt-2 leading-relaxed whitespace-pre-wrap" : "text-[11px] mt-1 line-clamp-2"
        }`}
        style={{ fontFamily: "arial, sans-serif" }}
      >
        {safeBody || `Discover what ${displayUrl} has to offer — official site.`}
      </div>
    </div>
  );
}

function MetaFeedAdMockup({
  brand,
  body,
  domain = "",
  size = "card",
}: {
  brand: string;
  body: string;
  domain?: string;
  size?: "card" | "modal";
}) {
  const isModal = size === "modal";
  const initial = brand.charAt(0).toUpperCase();
  const safeBody = sanitiseTemplate(body, domain || brand);
  return (
    <div
      className={`w-full bg-white text-left flex flex-col ${
        isModal
          ? "rounded-[3px] border-2 border-ink shadow-flat-sm overflow-hidden"
          : "aspect-video border-b-2 border-ink overflow-hidden"
      }`}
    >
      <div className={`flex items-center gap-2 ${isModal ? "px-4 pt-4 pb-3" : "px-3 pt-3 pb-2"}`}>
        <div
          className={`${
            isModal ? "w-10 h-10 text-base" : "w-8 h-8 text-sm"
          } rounded-full bg-gradient-to-br from-[#1877f2] to-[#4267B2] text-white font-bold flex items-center justify-center shrink-0`}
        >
          {initial}
        </div>
        <div className="flex flex-col leading-tight min-w-0 flex-1">
          <span className={`font-semibold text-gray-900 truncate ${isModal ? "text-sm" : "text-xs"}`}>
            {brand}
          </span>
          <span className="text-[10px] text-gray-500 flex items-center gap-1">
            Sponsored · <span className="inline-block w-2 h-2 rounded-full border border-gray-400" />
          </span>
        </div>
        <MoreHorizontal size={16} className="text-gray-500 shrink-0" />
      </div>
      <div className={`${isModal ? "px-4 pb-4" : "px-3 pb-3"} flex-1 overflow-hidden`}>
        <p
          className={`text-gray-900 ${
            isModal ? "text-sm leading-relaxed whitespace-pre-wrap" : "text-[11px] leading-snug line-clamp-3"
          }`}
        >
          {safeBody || `Discover the latest from ${brand}.`}
        </p>
      </div>
      {isModal && (
        <div className="border-t border-gray-200 px-4 py-2 flex items-center gap-5 text-gray-500 text-xs">
          <span className="inline-flex items-center gap-1.5"><ThumbsUp size={14} /> Like</span>
          <span className="inline-flex items-center gap-1.5"><MessageCircle size={14} /> Comment</span>
          <span className="inline-flex items-center gap-1.5"><Share2 size={14} /> Share</span>
        </div>
      )}
    </div>
  );
}

function isValidHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

function MediaEmbed({
  creativeUrl,
  url,
  type,
  title,
  channel,
  brand,
  domain,
  hook,
  body,
}: {
  creativeUrl: string | null;
  url: string | null;
  type: MediaKind;
  title: string;
  channel: "Meta" | "Google";
  brand: string;
  domain: string;
  hook: string;
  body: string;
}) {
  const directImg = isValidHttpUrl(creativeUrl) ? creativeUrl : null;

  if (channel === "Google" && !directImg) {
    return <GoogleSearchAdMockup domain={domain} hook={hook} body={body} />;
  }

  if (directImg) {
    return (
      <img
        src={directImg}
        alt={title}
        loading="lazy"
        className="aspect-video w-full object-cover border-b-2 border-ink bg-secondary"
        onError={(ev) => {
          (ev.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  if (url && type === "video") {
    return (
      <video
        controls
        preload="metadata"
        className="aspect-video w-full bg-black border-b-2 border-ink object-contain"
        src={url}
      />
    );
  }
  if (url && type === "image") {
    return (
      <img
        src={url}
        alt={title}
        loading="lazy"
        className="aspect-video w-full object-cover border-b-2 border-ink bg-secondary"
      />
    );
  }

  if (channel === "Meta") {
    return <MetaFeedAdMockup brand={brand} body={body} domain={domain} />;
  }

  // No creative and no fallback mockup → placeholder instead of a broken img
  return (
    <div className="aspect-video w-full border-b-2 border-ink bg-secondary flex items-center justify-center text-[10px] mono uppercase tracking-[0.18em] text-muted-foreground">
      No creative
    </div>
  );
}

function AdvertisersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [country, setCountry] = useState<Country>("Australia");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  // filters
  const [channelFilter, setChannelFilter] = useState<string>("All");
  const [adTypeFilter, setAdTypeFilter] = useState<string>("All");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortBy, setSortBy] = useState<"recent" | "longest" | "shortest">("recent");
  const [activeAdvertiser, setActiveAdvertiser] = useState<string>("__all");

  // F2 — Win Probability per ad domain
  const [winProbs, setWinProbs] = useState<Record<string, WinProbPayload | "loading" | "error">>({});
  useEffect(() => {
    if (activeAdvertiser === "__all") return;
    const d = activeAdvertiser;
    if (winProbs[d] && winProbs[d] !== "error") return;
    setWinProbs((p) => ({ ...p, [d]: "loading" }));
    (async () => {
      try {
        const res = await fetch(`${ARCGRID_BASE}/api/win-probability/${encodeURIComponent(d)}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as WinProbPayload;
        setWinProbs((p) => ({ ...p, [d]: json }));
      } catch {
        setWinProbs((p) => ({ ...p, [d]: "error" }));
      }
    })();
  }, [activeAdvertiser]);

  // F4 — Cluster tiers (Banking)
  const [clusters, setClusters] = useState<ClustersPayload | "loading" | "error">("loading");
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${ARCGRID_BASE}/api/clusters/Banking`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as ClustersPayload;
        if (active) setClusters(json);
      } catch {
        if (active) setClusters("error");
      }
    })();
    return () => { active = false; };
  }, []);
  const clusterFor = (domain: string): { tier: string; spend: string } | null => {
    if (!clusters || clusters === "loading" || clusters === "error") return null;
    const tiers = clusters.tiers ?? {};
    const entry = Object.entries(tiers).find(([, ds]) => ds?.some((d) => d.domain === domain));
    if (!entry) return null;
    const [tier, ds] = entry;
    const match = ds?.find((d) => d.domain === domain);
    return { tier, spend: formatSpend(match?.spend) };
  };

  // F3 — Export Brief
  const [exportingId, setExportingId] = useState<number | null>(null);
  const exportBrief = async (domain: string, scanId: number | null, id: number) => {
    setExportingId(id);
    try {
      const res = await fetch(`${ARCGRID_BASE}/api/export/brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, scan_id: scanId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { pdf_base64, filename } = (await res.json()) as { pdf_base64: string; filename: string };
      const b = atob(pdf_base64);
      const a = new Uint8Array(b.length);
      for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
      const u = URL.createObjectURL(new Blob([a], { type: "application/pdf" }));
      Object.assign(document.createElement("a"), { href: u, download: filename || `${domain}-brief.pdf` }).click();
      URL.revokeObjectURL(u);
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingId(null);
    }
  };

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [{ data: scans }, { data: pls }] = await Promise.all([
      supabase
        .from("domain_scans")
        .select("id, domain, status, created_at, estimated_monthly_spend, total_paid_keywords, average_cpc")
        .order("created_at", { ascending: false }),
      (supabase.from("ad_placements") as unknown as {
        select: (cols: string) => {
          order: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: Placement[] | null }>;
          };
        };
      })
        .select("id, domain, channel, channel_platform, ad_type, hook, days_running, creative_url, raw, created_at, buyer_stage, offer_type, emotional_driver, hook_analysis, strategist_takeaway, category, campaign_cluster, scan_id, product_type, offer_signal, primary_cta, metadata")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    const seen = new Set<string>();
    const unique: Row[] = [];
    for (const r of scans ?? []) {
      const d = normalizeDomain(r.domain);
      if (!seen.has(d)) {
        seen.add(d);
        unique.push({ ...(r as Row), domain: d });
      }
    }
    setRows(unique);
    setPlacements(
      ((pls ?? []) as Placement[]).map((p) => ({ ...p, domain: normalizeDomain(p.domain) })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("advertisers-hub")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "domain_scans" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_placements" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Polling fallback: while any tracked scan is still in-flight (not ready/error),
  // refetch every 4s so the grid flips from Queued → live cards even if the
  // realtime channel is throttled or the publication payload is dropped.
  useEffect(() => {
    const TERMINAL = new Set(["ready", "completed", "done", "error", "failed"]);
    const inFlight = rows.some((r) => !TERMINAL.has((r.status ?? "").toLowerCase()));
    if (!inFlight) return;
    const id = setInterval(() => load(), 4000);
    return () => clearInterval(id);
  }, [rows]);

  const normalize = (raw: string) => normalizeDomain(raw);


  const captureDomainInput = (value: string) => {
    setInput(value);
  };

  const captureCountry = (value: string) => {
    if (COUNTRY_OPTIONS.includes(value as Country)) {
      setCountry(value as Country);
    }
  };

  const addDomain = async () => {
    const domain = normalize(inputRef.current?.value ?? input);
    if (!domain || !/\.[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a valid domain");
      return;
    }
    if (rows.length >= MAX_BRANDS) {
      toast.error(`Maximum ${MAX_BRANDS} tracked brands on Agency tier`);
      return;
    }
    if (rows.some((r) => r.domain === domain)) {
      toast.error("Domain already tracked");
      return;
    }
    setBusy(true);
    try {
      await startScan({ data: { domain, country } });
      setInput("");
      toast.success(`Tracking ${domain}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add domain");
    } finally {
      setBusy(false);
    }
  };

  const removeDomain = async (_id: number, domain: string) => {
    // Optimistic UI — clear from state first so the grid never references a deleted row.
    setRows((prev) => prev.filter((r) => r.domain !== domain));
    setPlacements((prev) => prev.filter((p) => p.domain !== domain));
    setActiveAdvertiser((cur) => (cur === domain ? "__all" : cur));
    try {
      // Cascade: purge child rows first so foreign references can't orphan the UI.
      await supabase.from("ad_placements").delete().eq("domain", domain);
      const { error } = await supabase.from("domain_scans").delete().eq("domain", domain);
      if (error) throw error;
      toast(`${domain} removed`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove domain");
    } finally {
      load();
    }
  };

  // Enriched placements w/ derived fields + AU market filter
  const enriched = useMemo(() => {
    const auOnly = country === "Australia";
    return placements
      .filter((p) => !auOnly || !isForeignToAU(p.domain))
      .map((p) => {
        const media = extractMediaUrl(p.creative_url, p.raw);
        const meta = p.metadata && typeof p.metadata === "object" ? p.metadata as Record<string, unknown> : {};
        const days = (meta.days_on_flight as number) ?? p.days_running ?? 0;
        const firstSeen = (meta.first_seen as string) ?? p.created_at ?? null;
        const lastSeen = (meta.last_seen as string) ?? null;
        const multiplicity = (meta.multiplicity as number) ?? null;
        const platforms = (meta.platforms as string[]) ?? [];
        const branches = (meta.branches as string[]) ?? [];
        return {
          ...p,
          brand: brandFromDomain(p.domain),
          channelNorm: normalizeChannel(p.channel ?? ""),
          media,
          adType: adType(p, media.type),
          days,
          firstSeen,
          lastSeen,
          multiplicity,
          platforms,
          branches,
          body: extractRawCopy(p.raw),
        };
      });
  }, [placements, country]);

  const visibleRows = useMemo(
    () => (country === "Australia" ? rows.filter((r) => !isForeignToAU(r.domain)) : rows),
    [rows, country],
  );

  const advertisers = useMemo(() => {
    const set = new Map<string, { domain: string; brand: string; count: number }>();
    for (const e of enriched) {
      const prev = set.get(e.domain) ?? { domain: e.domain, brand: e.brand, count: 0 };
      prev.count += 1;
      set.set(e.domain, prev);
    }
    // also include tracked rows even if no placements
    for (const r of visibleRows) {
      if (!set.has(r.domain))
        set.set(r.domain, { domain: r.domain, brand: brandFromDomain(r.domain), count: 0 });
    }
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [enriched, visibleRows]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (activeAdvertiser !== "__all") list = list.filter((e) => e.domain === activeAdvertiser);
    if (channelFilter !== "All") list = list.filter((e) => e.channelNorm === channelFilter);
    if (adTypeFilter !== "All") list = list.filter((e) => e.adType === adTypeFilter);
    if (dateRange.from) {
      const fromMs = dateRange.from.getTime();
      list = list.filter((e) => new Date(e.created_at ?? 0).getTime() >= fromMs);
    }
    if (dateRange.to) {
      const toMs = dateRange.to.getTime() + 24 * 60 * 60 * 1000 - 1;
      list = list.filter((e) => new Date(e.created_at ?? 0).getTime() <= toMs);
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "longest") return b.days - a.days;
      if (sortBy === "shortest") return a.days - b.days;
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
    return list;
  }, [enriched, activeAdvertiser, channelFilter, adTypeFilter, dateRange, sortBy]);


  const channelCounts = useMemo(() => {
    const base = { Meta: 0, Google: 0 } as Record<string, number>;
    for (const e of enriched) {
      if (activeAdvertiser !== "__all" && e.domain !== activeAdvertiser) continue;
      base[e.channelNorm] = (base[e.channelNorm] ?? 0) + 1;
    }
    return base;
  }, [enriched, activeAdvertiser]);

  // Executive ribbon aggregates — derived purely from already-loaded data.
  const ribbon = useMemo(() => {
    const scopedRows = activeAdvertiser === "__all"
      ? visibleRows
      : visibleRows.filter((r) => r.domain === activeAdvertiser);
    const spend = scopedRows.reduce((s, r) => s + (Number(r.estimated_monthly_spend) || 0), 0);
    const scopedPl = activeAdvertiser === "__all"
      ? enriched
      : enriched.filter((e) => e.domain === activeAdvertiser);
    const meta = scopedPl.filter((e) => e.channelNorm === "Meta").length;
    const google = scopedPl.filter((e) => e.channelNorm === "Google").length;
    const total = scopedPl.length;
    const strategy = scopedPl.filter((e) => hasAnyStrategy(e)).length;
    return { spend, meta, google, total, strategy };
  }, [visibleRows, enriched, activeAdvertiser]);

  return (
    <WorkspaceShell
      title="Brand Intelligence"
      subtitle={`Strategic market view across ${rows.length}/${MAX_BRANDS} tracked brands — creative, category, and audience signal in one frame.`}
    >
      <div className="space-y-5">
        {/* Add brand */}
        <div className="card-flat p-4">
          <label className="mono text-[10px] uppercase font-bold block mb-2">
            Add Competitor Domain
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => captureDomainInput(e.currentTarget.value)}
              onInput={(e) => captureDomainInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              placeholder="Enter domain"
              className="flex-1 h-10 text-sm font-mono"
              disabled={busy || rows.length >= MAX_BRANDS}
            />
            <Select
              value={country}
              onValueChange={captureCountry}
              disabled={busy || rows.length >= MAX_BRANDS}
            >
              <SelectTrigger className="w-full sm:w-56 h-10 text-sm">
                <SelectValue placeholder="Target country" />
              </SelectTrigger>
              <SelectContent className="z-50">
                {COUNTRY_OPTIONS.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={addDomain}
              disabled={busy || rows.length >= MAX_BRANDS}
              className="h-10 gap-1.5"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add brand
            </Button>
          </div>
        </div>

        {/* Tracked brands strip */}
        {visibleRows.length > 0 && (
          <div className="card-flat overflow-hidden">
            <div className="px-4 py-3 border-b-2 border-ink bg-secondary mono text-[10px] uppercase font-bold">
              Tracked brands
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {visibleRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 border-2 border-ink rounded-[3px] bg-paper px-2 py-1"
                >
                  <span className="font-semibold text-sm">{brandFromDomain(r.domain)}</span>
                  <span className="mono text-[10px] text-muted-foreground">{r.domain}</span>
                  <ScanStatusPill status={r.status} />
                  {(() => {
                    if (clusters === "loading") return <span className="inline-block w-24 h-5 bg-ink/10 animate-pulse rounded-[3px]" />;
                    const c = clusterFor(r.domain);
                    if (!c) return null;
                    const cls = TIER_STYLE[c.tier] ?? TIER_STYLE["Tier 4"];
                    return (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`mono text-[10px] px-1.5 py-0.5 border rounded-[3px] uppercase ${cls}`}>{c.tier}</span>
                        {c.spend && <span className="mono text-[10px] text-muted-foreground">{c.spend}</span>}
                      </span>
                    );
                  })()}
                  
                  <button
                    onClick={() => removeDomain(r.id, r.domain)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${r.domain}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Market Overview */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">01 · Market Overview</div>
            <div className="text-[15px] font-semibold text-ink mt-0.5">Live competitive footprint across tracked brands</div>
          </div>
        </div>
        <section
          className="rounded-[6px] bg-paper border border-ink/10 p-5 grid grid-cols-1 md:grid-cols-3 gap-5"
          style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -22px rgba(35,37,29,0.25)" }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              <TrendingUp size={12} className="text-primary" /> Estimated Monthly Spend
            </div>
            <div className="text-[28px] font-bold tracking-tight leading-none text-ink tabular-nums">
              {AUD.format(Math.round(ribbon.spend))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Aggregated en-AU search acquisition envelope across {activeAdvertiser === "__all" ? `${visibleRows.length} tracked` : "this"} advertiser{activeAdvertiser === "__all" && visibleRows.length === 1 ? "" : "s"}.
            </div>
          </div>
          <div className="flex flex-col gap-2 md:border-l md:border-ink/10 md:pl-5">
            <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              <Activity size={12} className="text-primary" /> Creative Volume
            </div>
            <div className="flex items-end gap-3">
              <div className="text-[28px] font-bold tracking-tight leading-none text-ink tabular-nums">{ribbon.total}</div>
              <div className="flex items-center gap-2 pb-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink/80">
                  <span className="h-2 w-2 rounded-full bg-[#1877f2]" /> Meta {ribbon.meta}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink/80">
                  <span className="h-2 w-2 rounded-full bg-[#1a73e8]" /> Google {ribbon.google}
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-ink/5 overflow-hidden flex">
              <div className="h-full bg-[#1877f2]" style={{ width: ribbon.total ? `${(ribbon.meta / ribbon.total) * 100}%` : "0%" }} />
              <div className="h-full bg-[#1a73e8]" style={{ width: ribbon.total ? `${(ribbon.google / ribbon.total) * 100}%` : "0%" }} />
            </div>
            <div className="text-[11px] text-muted-foreground">Ads Collected across live placements feed.</div>
          </div>
          <div className="flex flex-col gap-2 md:border-l md:border-ink/10 md:pl-5">
            <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              <Globe size={12} className="text-primary" /> Coverage Score
            </div>
            {ribbon.strategy > 0 ? (
              <>
                <div className="flex items-end gap-3">
                  <div className="text-[28px] font-bold tracking-tight leading-none text-ink tabular-nums">
                    {ribbon.strategy}
                    <span className="text-[14px] font-semibold text-muted-foreground"> / {ribbon.total}</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold pb-1" style={{ color: "#9a7c3e" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#c8a96a" }} />
                    {ribbon.total ? Math.round((ribbon.strategy / ribbon.total) * 100) : 0}% Ads Analysed
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-ink/5 overflow-hidden">
                  <div className="h-full" style={{ width: ribbon.total ? `${(ribbon.strategy / ribbon.total) * 100}%` : "0%", background: "#c8a96a" }} />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {Math.max(ribbon.total - ribbon.strategy, 0)} Pending Analysis · strategic narrative compiled by Strategic Advisor.
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center h-9 px-3 rounded-full text-[12px] font-semibold border bg-ink/5 text-muted-foreground border-ink/10">
                  Strategic Advisor pending
                </span>
                <span className="text-[11px] text-muted-foreground leading-snug">
                  Strategic narrative will appear here once placements are processed.
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Advertiser tabs */}
        <Tabs value={activeAdvertiser} onValueChange={setActiveAdvertiser}>
          <div className="card-flat p-3">
            <TabsList className="flex flex-wrap h-auto bg-secondary">
              <TabsTrigger value="__all" className="mono text-[11px] uppercase">
                All ({enriched.length})
              </TabsTrigger>
              {advertisers.map((a) => (
                <TabsTrigger
                  key={a.domain}
                  value={a.domain}
                  className="mono text-[11px] uppercase"
                >
                  {a.brand} ({a.count})
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Filter bar */}
          <div className="card-flat p-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mono text-[10px] uppercase font-bold mr-2">
              <Filter size={12} /> Filters
            </div>

            <div className="flex items-center gap-1">
              {(["All", "Meta", "Google"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannelFilter(c)}
                  className={`btn-flat text-[11px] px-2 py-1 ${channelFilter === c ? "btn-primary" : ""}`}
                >
                  {c}
                  {c !== "All" && (
                    <span className="ml-1 mono text-[10px] opacity-70">
                      {channelCounts[c] ?? 0}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mx-2 h-5 w-px bg-ink/30" />

            <select
              value={adTypeFilter}
              onChange={(e) => setAdTypeFilter(e.target.value)}
              className="input-flat mono text-[11px] py-1"
            >
              <option value="All">All ad types</option>
              <option value="Video">Video</option>
              <option value="Image">Image</option>
            </select>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "btn-flat text-[11px] px-2.5 py-1 gap-1.5",
                    (dateRange.from || dateRange.to) && "btn-primary",
                  )}
                >
                  <CalendarIcon size={12} />
                  {dateRange.from && dateRange.to
                    ? `${format(dateRange.from, "d MMM")} – ${format(dateRange.to, "d MMM yyyy")}`
                    : dateRange.from
                      ? `${format(dateRange.from, "d MMM yyyy")} →`
                      : "Date range"}
                  {(dateRange.from || dateRange.to) && (
                    <X
                      size={11}
                      className="ml-1 opacity-70 hover:opacity-100"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setDateRange({});
                      }}
                    />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-50" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(r) => setDateRange({ from: r?.from, to: r?.to })}
                  numberOfMonths={2}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>

            <div className="ml-auto flex items-center gap-2">
              <span className="mono text-[10px] uppercase text-muted-foreground">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="input-flat mono text-[11px] py-1"
              >
                <option value="recent">Most recent</option>
                <option value="longest">Longest flight</option>
                <option value="shortest">Shortest flight</option>
              </select>
            </div>
          </div>

          {/* Brand DNA — live brand_dna_v2 across all tracked brands */}
          <BrandDNAGrid />

          {/* Brand DNA drilldown — per-brand strategic profile */}
          {activeAdvertiser !== "__all" && (() => {
            const row = rows.find((r) => r.domain === activeAdvertiser);
            return row ? (
              <div className="mt-4 space-y-2">
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">02b · Brand DNA · {activeAdvertiser}</div>
                <BrandMetricBlocks row={row} />
              </div>
            ) : null;
          })()}

          {/* Category Leaders — live ad_placements rollup */}
          {(() => {
            const scoped = activeAdvertiser === "__all"
              ? enriched
              : enriched.filter((e) => e.domain === activeAdvertiser);
            if (scoped.length === 0) return null;
            type Bucket = { name: string; count: number; meta: number; google: number; clusters: Set<string> };
            const groups = new Map<string, Bucket>();
            const allClusters = new Set<string>();
            for (const p of scoped) {
              const raw = (p.category ?? "").trim();
              const name = !raw || raw.toLowerCase() === "other" ? "Unclassified" : raw;
              let b = groups.get(name);
              if (!b) { b = { name, count: 0, meta: 0, google: 0, clusters: new Set() }; groups.set(name, b); }
              b.count++;
              const platform = `${p.channel ?? ""} ${p.channel_platform ?? ""}`.toLowerCase();
              if (/(meta|facebook|instagram)/.test(platform)) b.meta++;
              else if (/google/.test(platform)) b.google++;
              const cluster = (p.campaign_cluster ?? "").trim();
              if (cluster) { b.clusters.add(cluster); allClusters.add(cluster); }
            }
            const buckets = Array.from(groups.values()).sort((a, b) => b.count - a.count);
            return (
              <div className="mt-4 space-y-2">
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">03 · Category Leaders</div>
                <div className="card-flat overflow-hidden">
                {/* Summary ribbon */}
                <div className="px-4 py-3 border-b border-ink/10 bg-paper/60 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground">Category Leaders</div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 ml-auto">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-semibold tabular-nums">{buckets.length}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Categories</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-semibold tabular-nums">{allClusters.size}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Campaign Clusters</span>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-semibold tabular-nums">{scoped.length}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Placements</span>
                    </div>
                  </div>
                </div>
                {/* Category table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-ink/10">
                        <th className="text-left font-medium px-4 py-2">Category</th>
                        <th className="text-right font-medium px-3 py-2">Placements</th>
                        <th className="text-right font-medium px-3 py-2">Clusters</th>
                        <th className="text-right font-medium px-3 py-2">Meta</th>
                        <th className="text-right font-medium px-4 py-2">Google</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buckets.map((b, i) => (
                        <tr key={b.name} className={i % 2 === 0 ? "bg-paper/40" : ""}>
                          <td className="px-4 py-2 font-medium truncate max-w-[220px]" title={b.name}>{b.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{b.count}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{b.clusters.size}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{b.meta > 0 ? b.meta : <span className="text-muted-foreground/50">—</span>}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{b.google > 0 ? b.google : <span className="text-muted-foreground/50">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            );
          })()}

          {/* Offer IQ — live ad_placements offer signals */}
          {(() => {
            const scoped = activeAdvertiser === "__all"
              ? enriched
              : enriched.filter((e) => e.domain === activeAdvertiser);
            if (scoped.length === 0) return null;
            const tally = (key: "product_type" | "offer_signal" | "primary_cta") => {
              const m = new Map<string, number>();
              for (const p of scoped) {
                const v = ((p as Placement)[key] ?? "").trim();
                if (!v) continue;
                m.set(v, (m.get(v) ?? 0) + 1);
              }
              return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
            };
            const products = tally("product_type");
            const offers = tally("offer_signal");
            const ctas = tally("primary_cta");
            if (products.length === 0 && offers.length === 0 && ctas.length === 0) return null;
            const Col = ({ title, rows }: { title: string; rows: [string, number][] }) => (
              <div className="flex flex-col">
                <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground px-4 py-2 border-b border-ink/10">{title}</div>
                {rows.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground/60">No data</div>
                ) : (
                  <ul className="divide-y divide-ink/5">
                    {rows.map(([label, count], i) => (
                      <li key={label} className={`flex items-center justify-between gap-3 px-4 py-2 ${i % 2 === 0 ? "bg-paper/40" : ""}`}>
                        <span className="text-sm truncate" title={label}>{label}</span>
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
            return (
              <div className="mt-4 space-y-2">
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">04 · Market Opportunities</div>
                <div className="card-flat overflow-hidden">
                  <div className="px-4 py-3 border-b border-ink/10 bg-paper/60 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-foreground">Market Opportunities</div>
                    <div className="text-[11px] text-muted-foreground ml-auto">Product themes, offer hooks & calls-to-action shaping {scoped.length} live creatives</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-ink/10">
                    <Col title="Primary Categories" rows={products} />
                    <Col title="Offer Strategies" rows={offers} />
                    <Col title="Conversion Calls" rows={ctas} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Grid */}
          {activeAdvertiser !== "__all" && (
            <div className="mt-3">
              <TrendSparkline domain={activeAdvertiser} />
            </div>
          )}

          <TabsContent value={activeAdvertiser} className="mt-3">
            {loading ? (
              <div className="card-flat p-10 text-center text-sm text-muted-foreground">
                Loading creatives…
              </div>
            ) : filtered.length === 0 ? (
              <div className="card-flat p-10 text-center text-sm text-muted-foreground">
                No creatives match these filters yet. Run a scan or relax filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filtered.map((e) => {
                  return (
                  <Dialog key={e.id}>
                    <DialogTrigger asChild>
                      <article
                        className="card-flat overflow-hidden flex flex-col cursor-pointer text-left hover:shadow-md transition-shadow"
                        role="button"
                        tabIndex={0}
                      >
                        <MediaEmbed
                          creativeUrl={e.creative_url}
                          url={e.media.url}
                          type={e.media.type}
                          title={e.hook ?? e.brand}
                          channel={e.channelNorm}
                          brand={e.brand}
                          domain={e.domain}
                          hook={e.hook ?? e.brand}
                          body={e.body}
                        />
                        <div className="p-3 space-y-2 flex-1 flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate">{e.brand}</span>
                            <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                              {e.channelNorm}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-3 min-h-[2.5rem]">
                            {e.hook ?? "—"}
                          </p>
                          {(() => {
                            const variants = enriched.filter((x) => x.domain === e.domain).length;
                            const hasStrategy = hasAnyStrategy(e);
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-ink/10">
                                <span className="mono text-[10px] px-1.5 py-0.5 border border-ink/40 rounded-[3px] inline-flex items-center gap-1">
                                  {e.adType === "Video" ? <Film size={10} /> : <ImageIcon size={10} />}
                                  {e.adType}
                                </span>
                                <span className="mono text-[10px] px-1.5 py-0.5 border border-ink/40 rounded-[3px] inline-flex items-center gap-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${e.channelNorm === "Meta" ? "bg-[#1877f2]" : "bg-[#1a73e8]"}`} />
                                  ×{variants}
                                </span>
                                {hasStrategy ? (
                                  <span
                                    className="mono text-[10px] px-1.5 py-0.5 rounded-[3px] inline-flex items-center gap-1 border"
                                    style={{ background: "#fbf1d4", color: "#7a5f24", borderColor: "rgba(200,169,106,0.55)" }}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#c8a96a" }} />
                                    Strategic Advisor
                                  </span>
                                ) : (
                                  <span className="mono text-[10px] px-1.5 py-0.5 rounded-[3px] inline-flex items-center gap-1 border border-ink/10 bg-ink/5 text-muted-foreground">
                                    Strategic Advisor pending
                                  </span>
                                )}
                                <span className="mono text-[10px] text-muted-foreground ml-auto">
                                  {format(new Date(e.created_at ?? Date.now()), "d MMM")}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </article>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {e.brand}
                          <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                            {e.channelNorm}
                          </span>
                          <span className="mono text-[10px] px-1.5 py-0.5 border border-ink/40 rounded-[3px]">
                            {e.adType}
                          </span>
                        </DialogTitle>
                        <DialogDescription className="mono text-[10px]">
                          {(() => {
                            const start = new Date(e.created_at ?? Date.now());
                            const end = new Date();
                            return (
                              <>
                                {e.domain} · Auction Flight: {format(start, "d MMM yyyy")} → Present · Recency Delta Index {e.days}d live
                              </>
                            );
                          })()}
                        </DialogDescription>
                      </DialogHeader>
                      {(() => {
                        const isStaticImage =
                          typeof e.creative_url === "string" &&
                          /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(e.creative_url);
                        const directImg =
                          typeof e.creative_url === "string" &&
                          /^https?:\/\//.test(e.creative_url)
                            ? e.creative_url
                            : null;
                        const isGoogle = e.channelNorm === "Google";
                        const allowVideoEmbed =
                          !isGoogle && e.media.url && e.media.type === "video" && isStaticImage;
                        const hook = e.hook ?? e.brand;
                        const body = e.body;

                        const crawler = e.channelNorm === "Google" ? "DataForSEO Labs Index" : "Apify Orchestration Engine";

                        return (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <span className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground border border-ink/15 bg-paper px-2.5 py-1 rounded-full">
                                <Database size={11} /> {crawler}
                              </span>
                            </div>
                            {allowVideoEmbed ? (
                              <video
                                controls
                                autoPlay
                                preload="metadata"
                                className="w-full max-h-[60vh] bg-black border-2 border-ink object-contain rounded-[3px]"
                                src={e.media.url ?? undefined}
                              />
                            ) : isGoogle ? (
                              <GoogleSearchAdMockup
                                domain={e.domain}
                                hook={hook}
                                body={body}
                                size="modal"
                              />
                            ) : directImg ? (
                              <img
                                src={directImg}
                                alt={hook}
                                className="w-full max-h-[60vh] object-contain border-2 border-ink bg-secondary rounded-[3px]"
                              />
                            ) : (
                              <MetaFeedAdMockup brand={e.brand} body={body || hook} domain={e.domain} size="modal" />
                            )}

                            {(() => {
                              const copy = sanitiseTemplate((body || hook || "").trim(), e.domain);
                              const isThin = copy.length < 24;
                              return (
                                <section
                                  className="rounded-xl p-6 space-y-3 border border-ink/10"
                                  style={{
                                    background:
                                      "linear-gradient(180deg, oklch(0.985 0.012 95) 0%, oklch(0.965 0.014 92) 100%)",
                                    boxShadow:
                                      "0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px -18px rgba(35,37,29,0.35), 0 2px 6px -2px rgba(35,37,29,0.12)",
                                  }}
                                >
                                  <h4 className="mono text-[11px] uppercase font-semibold tracking-[0.18em] text-muted-foreground/80">
                                    Ad Copy
                                  </h4>
                                  {isThin ? (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper/70 px-3 py-1.5 text-[12px] font-medium text-ink/80 shadow-sm">
                                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                      Premium Targeted Acquisition Text Layout Active
                                    </div>
                                  ) : (
                                    <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-ink font-medium tracking-[-0.005em]">
                                      {copy}
                                    </p>
                                  )}
                                </section>
                              );
                            })()}

                            {/* Strategic Advisor — client-ready strategist note */}
                            {(() => {
                              const r = (e.raw && typeof e.raw === "object" ? (e.raw as Record<string, unknown>) : {}) as Record<string, unknown>;
                              const pick = (k: string): string => {
                                const top = (e as unknown as Record<string, unknown>)[k];
                                const v = (typeof top === "string" && top.trim()) ? top : (typeof r[k] === "string" ? (r[k] as string) : "");
                                return (v ?? "").toString().trim();
                              };
                              const buyerStage = pick("buyer_stage");
                              const offerType = pick("offer_type");
                              const emotionalDriver = pick("emotional_driver");
                              const hookAnalysis = pick("hook_analysis");
                              const takeaway = pick("strategist_takeaway");

                              const chips = [
                                { label: "Customer Stage", value: buyerStage },
                                { label: "Offer Strategy", value: offerType },
                                { label: "Dominant Emotion", value: emotionalDriver },
                              ].filter((c) => c.value);

                              if (!chips.length && !hookAnalysis && !takeaway) return null;

                              const badgeClass = (v: string): string => {
                                const k = v.toLowerCase();
                                if (k.includes("aware")) return "bg-blue-100 text-blue-800 ring-blue-200";
                                if (k.includes("consider")) return "bg-amber-100 text-amber-900 ring-amber-200";
                                if (k.includes("convert") || k.includes("conversion") || k.includes("purchase") || k.includes("decision")) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
                                if (k.includes("retain") || k.includes("loyal") || k.includes("retention")) return "bg-purple-100 text-purple-800 ring-purple-200";
                                return "bg-ink/5 text-ink ring-ink/10";
                              };

                              return (
                                <section
                                  className="rounded-[6px] border border-ink/10 p-4 sm:p-5 space-y-3.5"
                                  style={{
                                    background: "linear-gradient(180deg, #fbf6ea 0%, #f6efdc 100%)",
                                    boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset, 0 10px 28px -20px rgba(35,37,29,0.35)",
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                                        style={{ background: "#c8a96a", color: "#2a2519" }}
                                      >
                                        AI
                                      </span>
                                      <h4 className="mono text-[11px] uppercase font-semibold tracking-[0.18em] text-ink/80">
                                        Strategic Advisor
                                      </h4>
                                    </div>
                                    <span className="mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "#9a7c3e" }}>
                                      Strategist Note
                                    </span>
                                  </div>

                                  {chips.length > 0 && (
                                    <div className="space-y-2">
                                      <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                                        Strategic Layer
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {chips.map((c) => (
                                          <span
                                            key={c.label}
                                            className={cn(
                                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 ring-inset",
                                              badgeClass(c.value),
                                            )}
                                          >
                                            <span className="mono text-[9px] uppercase tracking-[0.14em] opacity-70">
                                              {c.label}
                                            </span>
                                            <span className="font-semibold">{c.value}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {hookAnalysis && (
                                    <div className="space-y-1">
                                      <div className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                        Hook Analysis
                                      </div>
                                      <p className="text-[13px] leading-[1.6] text-ink/90 whitespace-pre-wrap">
                                        {hookAnalysis}
                                      </p>
                                    </div>
                                  )}

                                  {takeaway && (
                                    <div
                                      className="rounded-[5px] border p-3 sm:p-3.5 space-y-1"
                                      style={{
                                        background: "linear-gradient(180deg, #fffaee 0%, #fbf1d4 100%)",
                                        borderColor: "rgba(200,169,106,0.55)",
                                        boxShadow: "0 6px 18px -14px rgba(154,124,62,0.55)",
                                      }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <span
                                          className="inline-block h-1.5 w-1.5 rounded-full"
                                          style={{ background: "#c8a96a" }}
                                        />
                                        <div className="mono text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: "#7a5f24" }}>
                                          Strategic Narrative · Primary Insight
                                        </div>
                                      </div>
                                      <p className="text-[13.5px] leading-[1.6] text-ink font-medium whitespace-pre-wrap">
                                        {takeaway}
                                      </p>
                                    </div>
                                  )}
                                </section>
                              );
                            })()}


                            {/* Strategic Advisor pending fallback — only when no strategist fields are present */}
                            {!hasAnyStrategy(e) && (
                              <section className="rounded-[6px] border border-ink/10 bg-paper p-5 space-y-2" style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -18px rgba(35,37,29,0.3)" }}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                                      style={{ background: "#ece4cf", color: "#7a5f24" }}
                                    >
                                      AI
                                    </span>
                                    <h4 className="mono text-[11px] uppercase font-semibold tracking-[0.18em] text-muted-foreground">
                                      Strategic Advisor
                                    </h4>
                                  </div>
                                  <span className="mono text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full border border-ink/10 bg-ink/5 text-muted-foreground">
                                    Strategic Advisor pending
                                  </span>
                                </div>
                                <p className="text-[12px] text-muted-foreground">
                                  Buyer stage, offer type, emotional driver, hook analysis and strategist takeaway will appear here once this placement is processed.
                                </p>
                              </section>
                            )}
                          </div>
                        );
                      })()}
                    </DialogContent>
                  </Dialog>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertisers")({
  head: () => ({ meta: [{ title: "Brand Intelligence — RevenueAd" }] }),
  component: AdvertisersPage,
});
