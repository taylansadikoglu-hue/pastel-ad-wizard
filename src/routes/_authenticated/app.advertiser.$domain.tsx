import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Presentation,
  Loader2,
  Newspaper,
  Search as SearchIcon,
  Youtube,
  Image as ImageIcon,
  Facebook,
  Music2,
  Linkedin,
} from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { SpendIndex, SpendLegend } from "@/components/adpalette/SpendIndex";
import { displayBrand } from "@/utils/brandDisplay";
import {
  getAgencyContext,
  domainInWatchlist,
  type AgencyContext,
} from "@/lib/agency-watchlist";
import { runMockScan } from "@/lib/mock-scan.functions";
import { DataFeedPanel } from "@/components/adpalette/DataFeedPanel";
import { formatTimeAgo } from "@/utils/timeAgo";
import {
  describeChannelConcentration,
  recommendChannelOpportunity,
  recommendNextMove,
} from "@/lib/radCreativeStory";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentAd = {
  id: number | string;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  ad_format?: string | null;
  channel?: string | null;
  channel_platform?: string | null;
  advertiser?: string | null;
  first_seen?: string | null;
  last_seen?: string | null;
  sighting_count?: number | string | null;
  ai_tags?: Record<string, unknown> | string | null;
};

type War = {
  advertiser?: string;
  name?: string;
  domain?: string;
  industry?: string;
  category?: string;
  total_ads?: number;
  total_sightings?: number;
  first_seen?: string;
  last_seen?: string;
  ads_this_week?: number;
  spend_signal?: number;
  channel_split?: Record<string, number> | string[];
  channels?: Record<string, number> | string[] | { channel?: string; name?: string; ad_count?: number; count?: number; last_seen?: string }[];

  top_themes?: { theme: string; count: number; pct: number }[];
  sentiment_breakdown?: { positive?: number; neutral?: number; urgency?: number };
  recent_ads?: RecentAd[];
  gap?: string;
  insight?: string;
  reach_frequency?: {
    totalUniqueReach?: number;
    avgFrequency?: number;
    channels?: Record<string, { reach?: number; adCount?: number } | number>;
  };
  spend_weight?: {
    total?: number;
    byChannel?: Record<string, { percentage?: number; adCount?: number; spend?: number } | number>;
  };
  creative_fatigue?: { score?: number; fatigueLabel?: string; label?: string; needsRefresh?: number; fresh?: number };
};

type Spend = { estimated_monthly_spend?: number };

type Channels = {
  channels?: Record<string, number> | string[];
  by_channel?: Record<string, number> | string[];
  channel_last_seen?: Record<string, string>;
};

type NewsItem = {
  title?: string;
  url?: string;
  source?: string;
  published_at?: string;
  date?: string;
};
type News = { articles?: NewsItem[] };

type AdvertiserListItem = { name?: string; brand?: string; domain?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rootSlug(d: string): string {
  return d.toLowerCase().replace(/^www\./, "").split(".")[0] ?? d;
}

function asTags(raw: RecentAd["ai_tags"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return raw;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] ?? "")).toUpperCase();
}

// Extract YouTube video ID from common URL shapes.
function youtubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

// Proxy CDN images that browsers can't load directly.
function proxyImage(url: string): string {
  if (/(?:fbcdn\.net|googlesyndication\.com|doubleclick\.net)/.test(url)) {
    return `https://api.revenuad.com/api/proxy/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Format reach numbers per spec.
function fmtReach(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${Math.round(n)}`;
}

// Channel mix — all 7 always.
const CHANNEL_MIX: { key: string; label: string; aliases: string[]; colour: string; Icon: typeof SearchIcon }[] = [
  { key: "youtube", label: "YouTube", aliases: ["youtube"], colour: "#FF0000", Icon: Youtube },
  { key: "search", label: "Search", aliases: ["search", "google search", "google_search"], colour: "#4285F4", Icon: SearchIcon },
  { key: "display", label: "Display", aliases: ["display", "google display", "google_display"], colour: "#C9963A", Icon: ImageIcon },
  { key: "meta", label: "Meta", aliases: ["meta", "facebook", "instagram"], colour: "#1877F2", Icon: Facebook },
  { key: "tiktok", label: "TikTok", aliases: ["tiktok"], colour: "#25F4EE", Icon: Music2 },
  { key: "linkedin", label: "LinkedIn", aliases: ["linkedin"], colour: "#0A66C2", Icon: Linkedin },
  { key: "programmatic", label: "Programmatic", aliases: ["programmatic", "dco"], colour: "#6B6B62", Icon: ImageIcon },
];

// Recent-ads tab filter map (spec).
const CHANNEL_TAB_MAP: Record<string, string[]> = {
  YouTube: ["YouTube", "youtube"],
  Search: ["Google Search", "search"],
  Display: ["Google Display", "Programmatic", "DCO", "display", "programmatic"],
  Meta: ["Meta", "Facebook", "Instagram", "meta", "facebook"],
  TikTok: ["TikTok", "tiktok"],
};

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNELS: { key: string; label: string; aliases: string[]; Icon: typeof SearchIcon }[] = [
  { key: "youtube", label: "YouTube", aliases: ["youtube", "video"], Icon: Youtube },
  { key: "search", label: "Search", aliases: ["search", "google search", "google_search", "google"], Icon: SearchIcon },
  { key: "display", label: "Display", aliases: ["display", "google display", "google_display", "programmatic", "image"], Icon: ImageIcon },
  { key: "meta", label: "Meta", aliases: ["meta", "facebook", "instagram"], Icon: Facebook },
  { key: "tiktok", label: "TikTok", aliases: ["tiktok"], Icon: Music2 },
  { key: "linkedin", label: "LinkedIn", aliases: ["linkedin"], Icon: Linkedin },
];

// Normalize any channel source (array of strings OR object of counts) into a counts map.
function toChannelCounts(src: Record<string, number> | string[] | undefined): Record<string, number> {
  if (!src) return {};
  if (Array.isArray(src)) {
    const out: Record<string, number> = {};
    for (const raw of src) {
      const k = String(raw ?? "").toLowerCase().trim();
      if (!k || k === "null") continue;
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(src)) {
    const key = String(k ?? "").toLowerCase().trim();
    const n = Number(v);
    if (!key || key === "null" || !Number.isFinite(n)) continue;
    out[key] = (out[key] ?? 0) + n;
  }
  return out;
}

function readChannelValue(src: Record<string, number> | undefined, aliases: string[]): number {
  if (!src) return 0;
  let total = 0;
  for (const a of aliases) {
    const v = src[a];
    if (typeof v === "number") total += v;
  }
  return total;
}

// Normalise any raw channel label (from war.channels[].channel) → badge name.
function normaliseToBadge(ch: unknown): string | null {
  const r = String(ch ?? "").toLowerCase();
  if (!r) return null;
  if (r.includes("youtube")) return "YouTube";
  if (r.includes("search")) return "Search";
  if (r.includes("display") || r.includes("programmatic")) return "Display";
  if (r.includes("meta") || r.includes("facebook") || r.includes("instagram")) return "Meta";
  if (r.includes("tiktok")) return "TikTok";
  if (r.includes("linkedin")) return "LinkedIn";
  return null;
}

type WarChannelEntry = { channel?: string; name?: string; ad_count?: number; count?: number; pct?: number; last_seen?: string };
function warChannelList(war: { channels?: unknown } | null | undefined): WarChannelEntry[] {
  const c = war?.channels;
  if (Array.isArray(c) && c.length && typeof c[0] === "object") return c as WarChannelEntry[];
  return [];
}

function channelByBadgeFromWar(war: { channels?: unknown } | null | undefined): Record<string, { pct: number; ads: number }> {
  const channelByBadge: Record<string, { pct: number; ads: number }> = {};
  for (const entry of warChannelList(war)) {
    const badge = normaliseToBadge(entry.channel ?? entry.name);
    if (!badge) continue;
    const ads = Number(entry.ad_count ?? entry.count ?? 0);
    const pct = Number(entry.pct ?? 0);
    const existing = channelByBadge[badge];
    if (existing) {
      existing.ads += ads;
      if (entry.pct != null) existing.pct = pct;
    } else {
      channelByBadge[badge] = { pct, ads };
    }
  }
  return channelByBadge;
}


function missingChannelsFromWar(war: War): string[] {
  const ALL_BADGES = ["YouTube", "Search", "Display", "Meta", "TikTok", "LinkedIn"];
  const activeBadges = warChannelList(war)
    .map((c) => normaliseToBadge(c.channel ?? c.name))
    .filter((b): b is string => Boolean(b));
  return ALL_BADGES.filter((ch) => !activeBadges.includes(ch));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AdvertiserPage() {
  const { domain } = Route.useParams();

  const [brand, setBrand] = useState<string>(() => displayBrand(domain));
  const [war, setWar] = useState<War | null>(null);
  const [spend, setSpend] = useState<Spend | null>(null);
  const [channels, setChannels] = useState<Channels | null>(null);
  const [news, setNews] = useState<News | null>(null);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [agencyCtx, setAgencyCtx] = useState<AgencyContext | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [outOfScope, setOutOfScope] = useState(false);

  useEffect(() => {
    let alive = true;
    getAgencyContext().then((ctx) => {
      if (alive) setAgencyCtx(ctx);
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!agencyCtx) return;
    const scoped = domainInWatchlist(domain, agencyCtx.domains);
    setOutOfScope(agencyCtx.domains.size > 0 && !scoped);
  }, [agencyCtx, domain]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setNewsLoading(true);
      const safe = async <T,>(url: string): Promise<T | null> => {
        try {
          const r = await fetch(url);
          if (!r.ok) return null;
          return (await r.json()) as T;
        } catch { return null; }
      };
      const root = rootSlug(domain);
      const list = await safe<AdvertiserListItem[] | { advertisers?: AdvertiserListItem[] }>(`${API_BASE}/api/advertisers`);
      const items: AdvertiserListItem[] = Array.isArray(list) ? list : (list?.advertisers ?? []);
      const match = items.find((i) => {
        const n = (i.name ?? i.brand ?? "").toLowerCase();
        const d = (i.domain ?? "").toLowerCase().replace(/^www\./, "");
        return d === domain.toLowerCase() || d.startsWith(root) || n === root || n.replace(/\s+/g, "") === root;
      });
      const resolved = match?.name ?? match?.brand ?? displayBrand(domain);
      if (!alive) return;
      setBrand(resolved);

      const b = encodeURIComponent(resolved);
      let w = await safe<War & { news?: News["articles"] | News }>(
        `${API_BASE}/api/advertisers/${b}/warroom`
      );
      if (!w) {
        w = await safe<War & { news?: News["articles"] | News }>(
          `${API_BASE}/api/advertisers/${encodeURIComponent(domain)}/warroom`
        );
      }

      if (!w) {
        const { data: placements } = await supabase
          .from("ad_placements")
          .select("id, domain, channel, channel_platform, ad_type, hook, headline, first_seen, last_seen, times_seen, ai_tags")
          .ilike("domain", `%${root}%`)
          .order("created_at", { ascending: false })
          .limit(12);
        if (placements?.length) {
          w = {
            domain,
            advertiser: resolved,
            total_ads: placements.length,
            recent_ads: placements.map((p) => ({
              id: p.id,
              channel: p.channel,
              channel_platform: p.channel_platform,
              first_seen: p.first_seen,
              last_seen: p.last_seen,
              sighting_count: p.times_seen,
              ai_tags: p.ai_tags,
            })),
            spend_signal: 3,
            first_seen: placements[placements.length - 1]?.first_seen ?? undefined,
            last_seen: placements[0]?.last_seen ?? undefined,
          };
        }
      }

      if (!alive) return;
      setWar(w);
      setSpend(null);
      setChannels(null);
      const newsField = (w as { news?: unknown } | null)?.news;
      const newsValue: News | null = Array.isArray(newsField)
        ? ({ articles: newsField } as News)
        : (newsField as News | undefined) ?? null;
      setNews(newsValue);
      if (w?.advertiser) setBrand(displayBrand(w.advertiser));
      setLoading(false);
      setNewsLoading(false);
    })();
    return () => { alive = false; };
  }, [domain]);

  const channelData = useMemo(() => {
    const list = warChannelList(war);
    // Fallback for older shapes (string[] / count map)
    const fallback: Record<string, number> = {};
    if (!list.length) {
      for (const part of [war?.channels as unknown, war?.channel_split as unknown, channels?.channels as unknown, channels?.by_channel as unknown]) {
        const counts = toChannelCounts(part as Record<string, number> | string[] | undefined);
        for (const [k, v] of Object.entries(counts)) fallback[k] = (fallback[k] ?? 0) + v;
      }
    }
    const lastSeenMap = channels?.channel_last_seen ?? {};
    return CHANNELS.map((c) => {
      let count = 0;
      let lastSeen: string | null = null;
      if (list.length) {
        for (const entry of list) {
          if (normaliseToBadge(entry.channel ?? entry.name) === c.label) {
            count += Number(entry.ad_count ?? entry.count ?? 0);
            if (entry.last_seen && !lastSeen) lastSeen = entry.last_seen;
          }
        }
      } else {
        count = readChannelValue(fallback, c.aliases);
      }
      if (!lastSeen) lastSeen = c.aliases.map((a) => lastSeenMap[a]).find(Boolean) ?? null;
      return { ...c, active: count > 0, count, lastSeen };
    });
  }, [war, channels]);


  // Channel mix narrative for meeting-ready copy
  const channelNarrative = useMemo(() => {
    const channelByBadge = channelByBadgeFromWar(war);
    const rows = CHANNEL_MIX.map((c) => ({
      label: c.label,
      pct: channelByBadge[c.label]?.pct ?? 0,
    })).filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
    const heavy = rows.filter((r) => r.pct >= 25);
    const light = CHANNEL_MIX.map((c) => c.label).filter((l) => !rows.some((r) => r.label === l && r.pct >= 10));
    if (heavy.length === 0) {
      return `${brand} has limited channel data so far. As more ads are indexed, you'll see where they're putting attention.`;
    }
    const lead = heavy.map((r) => `${r.label} (${Math.round(r.pct)}%)`).join(" and ");
    const lightNote = light.length ? ` ${light.slice(0, 2).join(" and ")} appear light.` : "";
    const strategy =
      heavy.some((r) => r.label === "YouTube" || r.label === "Display") && !heavy.some((r) => r.label === "Search" || r.label === "Meta")
        ? " That suggests broad awareness is being prioritised over direct response right now."
        : heavy.some((r) => r.label === "Search" || r.label === "Meta")
          ? " That mix points to a balance of demand capture and brand reach."
          : "";
    return `${brand} is leaning heavily on ${lead}.${lightNote}${strategy}`;
  }, [war, brand]);

  const totalAds = war?.total_ads ?? war?.recent_ads?.length ?? 0;
  void (war?.total_sightings ?? 0);
  const adsThisWeek = war?.ads_this_week ?? 0;
  const daysRunning = useMemo(() => {
    if (!war?.first_seen) return 0;
    const diff = Date.now() - new Date(war.first_seen).getTime();
    return Math.max(1, Math.floor(diff / 86_400_000));
  }, [war?.first_seen]);

  const firstAd = war?.recent_ads?.[0];
  const firstTags = asTags(firstAd?.ai_tags);
  const themes: string[] = (() => {
    // FIX 3: war.top_themes is up to 40 items — surface first 8.
    const fromWar = (war?.top_themes ?? []).map((t) => t.theme).filter(Boolean);
    if (fromWar.length) return fromWar.slice(0, 8);
    const t = firstTags.themes;
    return Array.isArray(t) ? (t as string[]).slice(0, 8) : [];
  })();

  const primaryCta = (firstTags.call_to_action as string | undefined) ?? "—";
  const sentimentRaw = (firstTags.sentiment as string | undefined) ?? "";
  const sentimentColor =
    /positive|trust|happy/i.test(sentimentRaw) ? "#2D7D46"
      : /negative|fear|urgen/i.test(sentimentRaw) ? "#C0392B"
      : "#9E9D94";

  // Aggregate demographics across all recent_ads (fallback when firstAd is empty)
  const demographics: { label: string; value: number }[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ad of war?.recent_ads ?? []) {
      const t = asTags(ad.ai_tags);
      const raw = t.demographics;
      if (Array.isArray(raw)) {
        for (const tag of raw) {
          if (typeof tag === "string" && tag.trim()) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
          }
        }
      } else if (raw && typeof raw === "object") {
        for (const [k, v] of Object.entries(raw)) {
          const num = typeof v === "number" ? v : Number(v);
          if (Number.isFinite(num) && num > 0) {
            counts.set(k, (counts.get(k) ?? 0) + num);
          }
        }
      } else if (typeof raw === "string" && raw.trim()) {
        counts.set(raw, (counts.get(raw) ?? 0) + 1);
      }
    }
    const max = Math.max(1, ...counts.values());
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, value]) => ({ label, value: (value / max) * 100 }));
  }, [war?.recent_ads]);

  // Creative analysis (AI read)
  const creativeAnalysis = useMemo(() => {
    const ads = war?.recent_ads ?? [];
    const colours = new Map<string, number>();
    const emotions = new Map<string, number>();
    let hasPeople = 0, hasLogo = 0, peopleCounted = 0, logoCounted = 0;
    const durations: number[] = [];
    for (const ad of ads) {
      const t = asTags(ad.ai_tags);
      const pc = t.primary_colours;
      if (Array.isArray(pc) && typeof pc[0] === "string") {
        colours.set(pc[0], (colours.get(pc[0]) ?? 0) + 1);
      }
      const s = t.sentiment ?? t.dominant_emotion;
      if (typeof s === "string" && s.trim()) emotions.set(s, (emotions.get(s) ?? 0) + 1);
      if (typeof t.has_people === "boolean") { peopleCounted++; if (t.has_people) hasPeople++; }
      if (typeof t.has_logo === "boolean") { logoCounted++; if (t.has_logo) hasLogo++; }
      const d = Number(t.ad_duration_seconds);
      if (Number.isFinite(d) && d > 0) durations.push(d);
    }
    const topColour = [...colours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topEmotion = [...emotions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const avgDur = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    return {
      colour: topColour,
      emotion: topEmotion,
      hasPeople: peopleCounted > 0 ? hasPeople / peopleCounted >= 0.5 : null,
      hasLogo: logoCounted > 0 ? hasLogo / logoCounted >= 0.5 : null,
      avgDuration: avgDur,
    };
  }, [war?.recent_ads]);

  // Channel filter for recent ads — uses ad.channel_platform per spec.
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const filteredAds = useMemo(() => {
    const ads = war?.recent_ads ?? [];
    if (channelFilter === "all") return ads;
    const aliases = CHANNEL_TAB_MAP[channelFilter] ?? [];
    return ads.filter((ad) => {
      const platform = String(ad.channel_platform ?? ad.channel ?? "").toLowerCase();
      const tagCh = String(asTags(ad.ai_tags).channel ?? "").toLowerCase();
      const hay = `${platform} ${tagCh}`;
      return aliases.some((v) => hay.includes(v.toLowerCase()));
    });
  }, [war?.recent_ads, channelFilter]);

  // Mount flag for spend-bar animation.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 50); return () => clearTimeout(t); }, [war]);

  // Debug: log API responses to see what's coming back
  useEffect(() => {
    if (war) console.log("[WarRoom]", { war, channels, spend, news });
  }, [war, channels, spend, news]);

  const category = war?.category ?? war?.industry ?? "—";
  const updatedAgo = formatTimeAgo(war?.last_seen ?? null);

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`${API_BASE}/api/export/slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, domain }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${rootSlug(domain)}-signal-${new Date().toISOString().split("T")[0]}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Try again.");
      setTimeout(() => setExportError(null), 3000);
    } finally {
      setExporting(false);
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      await runMockScan({ data: { domain } });
      window.location.reload();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <WorkspaceShell title={brand} subtitle={`Ad library · ${brand}`}>
        <div style={emptyCard}>Loading ad intelligence…</div>
      </WorkspaceShell>
    );
  }

  if (outOfScope) {
    return (
      <WorkspaceShell title={brand} subtitle={`Ad library · ${brand}`}>
        <Link
          to="/app/clients"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6B62", marginBottom: 16, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Back to clients
        </Link>
        <div style={emptyCard}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>Not on your watchlist</div>
          Add {brand} to a client workspace to see their full ad intelligence here.
        </div>
      </WorkspaceShell>
    );
  }

  if (!war) {
    return (
      <WorkspaceShell title={brand} subtitle={`Ad library · ${brand}`}>
        <Link
          to="/app/advertisers"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6B62", marginBottom: 16, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Back to Ad Library
        </Link>
        <div style={emptyCard}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>No ads indexed yet</div>
          <p style={{ marginBottom: 16 }}>
            We haven&apos;t picked up live ads for {brand} yet. Run a scan to index their placements and unlock channel mix, messaging, and recommendations.
          </p>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{
              display: "block",
              margin: "20px auto 0",
              background: "#C9963A",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 7,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: scanning ? "not-allowed" : "pointer",
              opacity: scanning ? 0.7 : 1,
            }}
          >
            {scanning ? "Running scan…" : "Run Scan"}
          </button>
          {scanError && (
            <div style={{ color: "#C0392B", fontSize: 12, marginTop: 12 }}>{scanError}</div>
          )}
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title={brand} subtitle={`Ad library · ${brand}`}>
      <style>{`@keyframes radPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
      <Link
        to="/app/advertisers"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6B62", marginBottom: 16, textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Back to Ad Library
      </Link>

      {totalAds < 5 && (
        <div
          style={{
            background: "#FDF6E8",
            border: "1px solid #E8D5A0",
            borderLeft: "3px solid #C9963A",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            fontSize: 13,
            color: "#6B6B62",
            lineHeight: 1.5,
          }}
        >
          Limited signal — treat these findings as directional only.
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <DataFeedPanel domain={domain} brandLabel={brand} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.4fr) minmax(280px, 1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* LEFT — main intel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          {/* A — Brand header */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, paddingBottom: 4 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "#FDF6E8",
                color: "#C9963A",
                fontSize: 16,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {initialsOf(brand)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: "#1C1C1A", lineHeight: 1.2 }}>{brand}</div>
              <div style={{ fontSize: 13, color: "#9E9D94", marginTop: 3 }}>
                {category} · {totalAds} ads
                {updatedAgo && ` · Updated ${updatedAgo}`}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <button
                onClick={handleExport}
                disabled={exporting}
                style={{
                  background: "#1C1C1A",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 7,
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.7 : 1,
                }}
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Presentation size={16} />}
                {exporting ? "Building deck…" : "Export slides"}
              </button>
              {exportError && (
                <div style={{ color: "#C0392B", fontSize: 12 }}>{exportError}</div>
              )}
            </div>
          </div>


          {/* What they're doing — summary */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderLeft: "3px solid #C9963A",
              borderRadius: 8,
              padding: "16px 20px",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              What they&apos;re doing
            </div>
            <p style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.6, margin: 0 }}>{channelNarrative}</p>
          </div>

          {/* Activity metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            <MetricCard
              value={totalAds.toLocaleString()}
              label="Active ads"
              trend={adsThisWeek > 0 ? `↑ ${adsThisWeek} this week` : null}
            />
            <MetricCard
              value={fmtReach(Number(war.reach_frequency?.totalUniqueReach ?? 0))}
              label="Est. reach"
              trend="Unique Australians · est."
            />
            <MetricCard
              value={
                war.reach_frequency?.avgFrequency != null && Number(war.reach_frequency.avgFrequency) > 0
                  ? Number(war.reach_frequency.avgFrequency).toFixed(1) + "x"
                  : "—"
              }
              label="Avg. frequency"
              trend="Times seen per person · est."
            />
            <div style={{ ...metricCardStyle, alignItems: "flex-start", padding: 18 }}>
              <SpendIndex
                level={typeof war.spend_signal === "number" && war.spend_signal > 0 ? war.spend_signal : undefined}
                spend={spend?.estimated_monthly_spend ?? 0}
              />
            </div>
            <MetricCard
              value={daysRunning.toLocaleString()}
              label="Days running"
              trend={war.first_seen ? `Since ${fmtDate(war.first_seen)}` : null}
            />
          </div>
          <SpendLegend />

          {/* B2 — Channel mix */}
          {(() => {
            const channelByBadge = channelByBadgeFromWar(war);
            const rows = CHANNEL_MIX.map((c) => {
              const fromServer = channelByBadge[c.label];
              return { ...c, pct: fromServer?.pct ?? 0, ads: fromServer?.ads ?? 0 };
            });
            const dominant = rows.find((r) => r.pct > 60);

            return (
              <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>Where they&apos;re spending attention</div>
                <div style={{ fontSize: 12, color: "#9E9D94", marginBottom: 14 }}>Channel mix by share of observed activity</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {rows.map((r) => {
                    const pct = Math.max(0, Math.min(100, r.pct));
                    const empty = pct <= 0 && r.ads <= 0;
                    return (
                      <div key={r.key} style={{ display: "grid", gridTemplateColumns: "150px 1fr 56px 70px", alignItems: "center", gap: 12, opacity: empty ? 0.5 : 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500, color: "#1C1C1A" }}>
                          <r.Icon size={16} style={{ color: empty ? "#C4C2BA" : r.colour }} />
                          {r.label}
                        </div>
                        <div style={{ height: 8, background: "#F0EDE8", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: mounted ? `${pct}%` : "0%", height: "100%", background: "#C9963A", transition: "width 600ms ease-out" }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: empty ? "#C4C2BA" : "#1C1C1A", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
                        </div>
                        <div style={{ fontSize: 11, color: empty ? "#C4C2BA" : "#9E9D94", textAlign: "right" }}>
                          {empty ? "No activity yet" : `${r.ads} ad${r.ads === 1 ? "" : "s"}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {dominant && (
                  <div style={{ marginTop: 14, background: "#FDF6E8", borderLeft: "2px solid #C9963A", padding: "8px 12px", borderRadius: 4, fontSize: 12, color: "#6B6B62" }}>
                    {describeChannelConcentration(brand, dominant.label, dominant.ads, dominant.pct)}
                  </div>
                )}
              </div>
            );
          })()}

          {/* B3 — Creative health (fatigue) */}
          {(() => {
            const cf = war.creative_fatigue ?? {};
            const score = Math.max(0, Math.min(100, Number(cf.score ?? 0)));
            const tier = score <= 30 ? "fresh" : score <= 60 ? "maturing" : "fatigued";
            const tierColour = tier === "fresh" ? "#2D7D46" : tier === "maturing" ? "#C9963A" : "#C0392B";
            const label = cf.fatigueLabel ?? cf.label ?? (tier === "fresh" ? "Fresh" : tier === "maturing" ? "Maturing" : "Fatigued");
            const needsRefresh = Number(cf.needsRefresh ?? 0);
            const fresh = Number(cf.fresh ?? 0);
            const callout =
              tier === "fatigued"
                ? { bg: "#FFF0EE", border: "#C0392B", title: "⚡ Attack window", titleColour: "#C0392B", body: "Their creative is showing fatigue signals. Audiences are tuning out. Now is the time to outspend them with fresh messaging." }
                : tier === "maturing"
                  ? { bg: "#FDF6E8", border: "#C9963A", title: "⏱ Watch this space", titleColour: "#A07830", body: "Portfolio is maturing. They'll need a refresh within 60–90 days. Plan your counter-move now." }
                  : { bg: "#F0F9F4", border: "#2D7D46", title: "✓ Actively investing", titleColour: "#2D7D46", body: "Fresh creative signals active investment. They're in growth mode. Match their energy or find the gaps they're missing." };
            return (
              <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>Creative health</div>
                <div style={{ fontSize: 12, color: "#9E9D94", marginBottom: 16 }}>How fresh is their ad portfolio?</div>
                <div style={{ display: "grid", gridTemplateColumns: "40fr 60fr", gap: 24, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", border: `4px solid ${tierColour}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 600, color: "#1C1C1A" }}>
                      {score}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: tierColour }}>{label}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                      <div style={{ fontSize: 12, color: "#6B6B62" }}>{needsRefresh} ad{needsRefresh === 1 ? "" : "s"} need refresh</div>
                      <div style={{ fontSize: 12, color: "#2D7D46" }}>{fresh} fresh creative{fresh === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <div style={{ background: callout.bg, borderLeft: `2px solid ${callout.border}`, padding: 12, borderRadius: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: callout.titleColour, marginBottom: 6 }}>{callout.title}</div>
                    <div style={{ fontSize: 12, color: "#6B6B62", lineHeight: 1.5 }}>{callout.body}</div>
                  </div>
                </div>
              </div>
            );
          })()}



          {/* C — Channel presence */}
          <Card title="Channel presence">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {channelData.map((c) => (
                <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 16px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      background: c.active ? "#FDF6E8" : "#F7F6F3",
                      border: `1px solid ${c.active ? "#C9963A" : "#EBE9E4"}`,
                      color: c.active ? "#A07830" : "#C4C2BA",
                    }}
                  >
                    <c.Icon size={14} style={{ color: c.active ? "#C9963A" : "#C4C2BA" }} />
                    {c.label}
                  </div>
                  {c.active && (
                    <div style={{ fontSize: 10, color: "#9E9D94", paddingLeft: 4 }}>
                      {c.count > 0 ? `${c.count} ad${c.count === 1 ? "" : "s"}` : ""}
                      {c.lastSeen ? `${c.count > 0 ? " · " : ""}Active since ${fmtDate(c.lastSeen)}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>


          {/* D — Creative intelligence */}
          <Card title="What they're saying">
            <div style={{ display: "grid", gridTemplateColumns: "55fr 45fr", gap: 28 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Themes">
                  {themes.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {themes.slice(0, 8).map((t, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "6px 14px",
                            borderRadius: 5,
                            background: "#FDF6E8",
                            border: "1px solid #E8D5A0",
                            color: "#A07830",
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "#9E9D94" }}>Themes will appear as more creatives are indexed.</span>
                  )}
                </Field>
                <Field label="Primary CTA">
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#1C1C1A" }}>{primaryCta}</div>
                </Field>
                <Field label="Sentiment">
                  <div style={{ fontSize: 14, fontWeight: 500, color: sentimentColor, textTransform: "capitalize" }}>
                    {sentimentRaw || "Not enough creatives to read tone yet"}
                  </div>
                </Field>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Audience">
                  {demographics.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {demographics.map((d) => (
                        <div key={d.label}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              color: "#6B6B62",
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ textTransform: "capitalize" }}>{d.label}</span>
                            <span style={{ fontWeight: 600, color: "#1C1C1A" }}>{Math.round(d.value)}%</span>
                          </div>
                          <div style={{ height: 6, background: "#F0EDE8", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${d.value}%`, height: "100%", background: "#C9963A" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : themes.length ? (
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {themes.slice(0, 4).map((t, i) => (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B6B62", marginBottom: 5 }}>
                              <span style={{ textTransform: "capitalize" }}>{t}</span>
                            </div>
                            <div style={{ height: 6, background: "#F0EDE8", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ width: `${100 - i * 18}%`, height: "100%", background: "#C9963A" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#C4C2BA", marginTop: 8, fontStyle: "italic" }}>
                        Based on creative analysis
                      </div>
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "#9E9D94" }}>Themes will appear as more creatives are indexed.</span>
                  )}
                </Field>
              </div>
            </div>


            {/* Creative analysis */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F0EDE8" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#9E9D94",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                AI creative read
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {creativeAnalysis.colour && (
                  <CreativePill>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: creativeAnalysis.colour,
                        border: "1px solid rgba(0,0,0,0.1)",
                        display: "inline-block",
                      }}
                    />
                    <span style={{ textTransform: "capitalize" }}>{creativeAnalysis.colour}</span>
                  </CreativePill>
                )}
                {creativeAnalysis.emotion && (
                  <CreativePill>
                    <span style={{ textTransform: "capitalize" }}>{creativeAnalysis.emotion}</span>
                  </CreativePill>
                )}
                {(() => {
                  const fmt = (firstAd?.ad_format ?? "").trim();
                  return fmt ? <CreativePill><span style={{ textTransform: "capitalize" }}>{fmt}</span></CreativePill> : null;
                })()}
                {creativeAnalysis.avgDuration && (
                  <CreativePill>~{creativeAnalysis.avgDuration}s avg</CreativePill>
                )}
                {!creativeAnalysis.colour && !creativeAnalysis.emotion && !firstAd?.ad_format && (
                  <span style={{ fontSize: 12, color: "#9E9D94" }}>Creative tags will populate after the next scan.</span>
                )}
              </div>
            </div>
          </Card>

          {/* What they're missing */}
          {(() => {
            const missingChannels = missingChannelsFromWar(war);
            const activeBadges = warChannelList(war)
              .map((c) => normaliseToBadge(c.channel ?? c.name))
              .filter((b): b is string => Boolean(b));
            const top = themes[0];
            const second = themes[1];
            const audienceLabel = demographics[0]?.label ?? "Their core audience";
            let body: string;
            if (missingChannels.length > 0) {
              body = recommendChannelOpportunity(missingChannels[0], 0);
            } else if (activeBadges.length > 0) {
              body = `${brand} is active across all major channels. The gap is in messaging — not distribution.`;
            } else if (top && second) {
              body = `${brand} owns ${top} in ${category}. The gap is ${second} — only a handful of competitors use it.`;
            } else if (top) {
              body = `${brand} owns ${top} in ${category}. Find the second theme nobody else has claimed and run it.`;
            } else {
              body = war.gap ?? war.insight ?? `${brand}'s positioning is still forming. Watch for the first repeated theme to set the angle.`;
            }

            return (
              <div
                style={{
                  background: "#FDF6E8",
                  border: "1px solid #E8D5A0",
                  borderLeft: "3px solid #C9963A",
                  borderRadius: 8,
                  padding: "18px 22px",
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "#A07830",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginBottom: 8,
                  }}
                >
                  What they&apos;re missing
                </div>
                <div style={{ fontSize: 16, color: "#1C1C1A", lineHeight: 1.6, fontWeight: 400 }}>
                  {body}
                </div>
              </div>
            );
          })()}

          {/* What we'd recommend next */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderLeft: "3px solid #1C1C1A",
              borderRadius: 8,
              padding: "18px 22px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#6B6B62",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                marginBottom: 8,
              }}
            >
              What we&apos;d recommend next
            </div>
            <div style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.6 }}>
              {recommendNextMove({
                brand,
                totalAds,
                missingChannel: missingChannelsFromWar(war)[0] ?? null,
                missingChannelAds: 0,
                primaryTheme: themes[0] ?? null,
              })}
            </div>
            <Link
              to="/app/categories"
              style={{ fontSize: 13, color: "#C9963A", fontWeight: 500, textDecoration: "none", display: "inline-block", marginTop: 10 }}
            >
              Compare with category benchmarks →
            </Link>
          </div>

          <Card title="Recent ads">
            {/* Channel filter tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { k: "all", l: "All" },
                { k: "YouTube", l: "YouTube" },
                { k: "Search", l: "Search" },
                { k: "Display", l: "Display" },
                { k: "Meta", l: "Meta" },
                { k: "TikTok", l: "TikTok" },
              ].map((t) => {
                const active = channelFilter === t.k;
                return (
                  <button
                    key={t.k}
                    onClick={() => setChannelFilter(t.k)}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      border: "none",
                      cursor: "pointer",
                      background: active ? "#1C1C1A" : "transparent",
                      color: active ? "#FFFFFF" : "#6B6B62",
                    }}
                  >
                    {t.l}
                  </button>
                );
              })}
            </div>
            {filteredAds.length ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {filteredAds.slice(0, 8).map((ad, i) => (
                  <RecentAdRow key={ad.id ?? i} ad={ad} brand={brand} />
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#9E9D94" }}>No ads match this filter.</div>
            )}
          </Card>
        </div>

        {/* RIGHT — News panel */}
        <aside
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBE9E4",
            borderRadius: 10,
            padding: "16px 18px",
            position: "sticky",
            top: 20,
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#9E9D94",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              In the news
            </div>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#C9963A",
                animation: "radPulse 2s infinite",
              }}
            />
          </div>

          {newsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 8, width: 60, background: "#F0EDE8", borderRadius: 2, animation: "radPulse 1.5s infinite" }} />
                  <div style={{ height: 12, width: "100%", background: "#F0EDE8", borderRadius: 2, animation: "radPulse 1.5s infinite" }} />
                  <div style={{ height: 12, width: "70%", background: "#F0EDE8", borderRadius: 2, animation: "radPulse 1.5s infinite" }} />
                </div>
              ))}
            </div>
          ) : !news?.articles?.length ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Newspaper size={16} style={{ color: "#C4C2BA", margin: "0 auto 6px" }} />
              <div style={{ fontSize: 12, color: "#9E9D94" }}>No recent coverage</div>
              <div style={{ fontSize: 11, color: "#C4C2BA", marginTop: 2 }}>Checked daily</div>
            </div>
          ) : (
            <div>
              {news.articles.slice(0, 8).map((a, i) => (
                <NewsRow key={i} item={a} />
              ))}
            </div>
          )}

          <div
            style={{
              fontSize: 10,
              color: "#C4C2BA",
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid #F0EDE8",
            }}
          >
            Updated daily via Google News
          </div>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const metricCardStyle: React.CSSProperties = {
  background: "#F0EDE8",
  borderRadius: 10,
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

const emptyCard: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 10,
  padding: 48,
  textAlign: "center",
  color: "#6B6B62",
  fontSize: 13,
};

function MetricCard({ value, label, trend }: { value: string; label: string; trend: string | null }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: 28, fontWeight: 600, color: "#1C1C1A", lineHeight: 1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "#9E9D94",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      {trend && (
        <div style={{ fontSize: 12, color: "#2D7D46", marginTop: 2 }}>{trend}</div>
      )}
    </div>
  );
}


function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderRadius: 10,
        padding: 20,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#9E9D94",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function CreativePill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        fontWeight: 500,
        padding: "4px 10px",
        borderRadius: 4,
        background: "#F0EDE8",
        color: "#6B6B62",
      }}
    >
      {children}
    </span>
  );
}


function RecentAdRow({ ad, brand }: { ad: RecentAd; brand: string }) {
  const tags = asTags(ad.ai_tags);
  const themes = (() => {
    const t = tags.themes;
    return Array.isArray(t) ? (t as string[]).slice(0, 2) : [];
  })();
  const channel = (ad.channel_platform ?? ad.channel ?? (tags.channel as string | undefined) ?? "").trim();
  const channelLow = channel.toLowerCase();
  const isYouTube = /youtube|video/.test(channelLow);
  const isDisplay = /display|programmatic|banner/.test(channelLow);
  const channelInitial = (channel || brand).charAt(0).toUpperCase();
  // Channel-coloured placeholder (never grey, never black) — match Channel mix palette.
  const placeholderColour = (() => {
    if (/youtube/.test(channelLow)) return "#FF0000";
    if (/search/.test(channelLow)) return "#4285F4";
    if (/display/.test(channelLow)) return "#C9963A";
    if (/meta|facebook|instagram/.test(channelLow)) return "#1877F2";
    if (/tiktok/.test(channelLow)) return "#25F4EE";
    if (/linkedin/.test(channelLow)) return "#0A66C2";
    if (/programmatic/.test(channelLow)) return "#6B6B62";
    return "#C9963A";
  })();

  // Thumbnail fallback hierarchy: thumbnail_url → YouTube derived → image_url (proxied)
  let imgSrc: string | null = ad.thumbnail_url ?? null;
  if (!imgSrc && ad.video_url) {
    const id = youtubeId(ad.video_url);
    if (id) imgSrc = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }
  if (!imgSrc && ad.image_url) imgSrc = proxyImage(ad.image_url);

  const sightings = Number(ad.sighting_count ?? 0);
  const openVideo = () => {
    if (ad.video_url) window.open(ad.video_url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "16px 0",
        borderBottom: "1px solid #F0EDE8",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 56,
          height: 56,
          borderRadius: 8,
          flexShrink: 0,
          cursor: isYouTube && ad.video_url ? "pointer" : "default",
        }}
        onClick={isYouTube ? openVideo : undefined}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt=""
            style={{ width: "100%", height: "100%", borderRadius: 6, objectFit: "cover", background: "#F0EDE8", display: "block" }}
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = "none";
              const fb = t.nextSibling as HTMLElement | null;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <div
          style={{
            display: imgSrc ? "none" : "flex",
            position: "absolute",
            inset: 0,
            borderRadius: 6,
            background: placeholderColour,
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {channelInitial}
        </div>
        {isYouTube && ad.video_url && imgSrc && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFF",
                fontSize: 10,
              }}
            >
              ▶
            </div>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2, flexWrap: "wrap" }}>
          {ad.ad_format && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#6B6B62",
                background: "#F0EDE8",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              {ad.ad_format}
            </span>
          )}
          {isDisplay && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#A07830",
                background: "#FDF6E8",
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              Display
            </span>
          )}
          {channel && (
            <span style={{ fontSize: 11, color: "#9E9D94" }}>{channel}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6B6B62" }}>
          {ad.first_seen ? formatTimeAgo(ad.first_seen) : "—"}
          {ad.last_seen ? ` → ${formatTimeAgo(ad.last_seen)}` : ""}
          {sightings > 0 && ` · ${sightings.toLocaleString()} impressions`}
        </div>
      </div>
      {themes.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {themes.map((t, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 8px",
                borderRadius: 999,
                background: "#FDF6E8",
                border: "1px solid #E8D5A0",
                color: "#A07830",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const ts = item.published_at ?? item.date ?? null;
  const open = () => {
    if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
  };
  return (
    <div
      onClick={open}
      style={{
        padding: "12px 0",
        borderBottom: "1px solid #F0EDE8",
        cursor: item.url ? "pointer" : "default",
      }}
    >
      {item.source && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#C9963A",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 4,
          }}
        >
          {item.source}
        </div>
      )}
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "#1C1C1A",
          lineHeight: 1.35,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#C9963A"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#1C1C1A"; }}
      >
        {item.title ?? "Untitled"}
      </div>
      {ts && (
        <div style={{ fontSize: 12, color: "#9E9D94", marginTop: 4 }}>
          {formatTimeAgo(ts)}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertiser/$domain")({
  head: () => ({ meta: [{ title: "War room — RevenuAD Signal" }] }),
  component: AdvertiserPage,
});
