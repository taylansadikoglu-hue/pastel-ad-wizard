import { createFileRoute, Link } from "@tanstack/react-router";
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
import { displayBrand, spendLevel } from "@/utils/brandDisplay";
import { formatTimeAgo } from "@/utils/timeAgo";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentAd = {
  id: number | string;
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  ad_format?: string | null;
  channel?: string | null;
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
  channel_split?: Record<string, number>;
  top_themes?: { theme: string; count: number; pct: number }[];
  sentiment_breakdown?: { positive?: number; neutral?: number; urgency?: number };
  recent_ads?: RecentAd[];
  gap?: string;
  insight?: string;
};

type Spend = { estimated_monthly_spend?: number };

type Channels = {
  channels?: Record<string, number>;
  by_channel?: Record<string, number>;
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

// ─── Channel config ───────────────────────────────────────────────────────────

const CHANNELS: { key: string; label: string; aliases: string[]; Icon: typeof SearchIcon }[] = [
  { key: "youtube", label: "YouTube", aliases: ["youtube", "video"], Icon: Youtube },
  { key: "search", label: "Search", aliases: ["search", "google_search", "google"], Icon: SearchIcon },
  { key: "display", label: "Display", aliases: ["display", "programmatic", "image"], Icon: ImageIcon },
  { key: "meta", label: "Meta", aliases: ["meta", "facebook", "instagram"], Icon: Facebook },
  { key: "tiktok", label: "TikTok", aliases: ["tiktok"], Icon: Music2 },
  { key: "linkedin", label: "LinkedIn", aliases: ["linkedin"], Icon: Linkedin },
];

function readChannelValue(src: Record<string, number> | undefined, aliases: string[]): number {
  if (!src) return 0;
  let total = 0;
  for (const a of aliases) {
    if (typeof src[a] === "number") total += src[a];
  }
  return total;
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
      const [w, s, c, n] = await Promise.all([
        safe<War>(`${API_BASE}/api/advertisers/${b}`),
        safe<Spend>(`${API_BASE}/api/spend/${b}`),
        safe<Channels>(`${API_BASE}/api/channels/${b}`),
        safe<News>(`${API_BASE}/api/news/${b}`),
      ]);
      if (!alive) return;
      setWar(w);
      setSpend(s);
      setChannels(c);
      setNews(n);
      if (w?.advertiser) setBrand(displayBrand(w.advertiser));
      setLoading(false);
      setNewsLoading(false);
    })();
    return () => { alive = false; };
  }, [domain]);

  const channelData = useMemo(() => {
    const src: Record<string, number> = {
      ...(war?.channel_split ?? {}),
      ...(channels?.channels ?? {}),
      ...(channels?.by_channel ?? {}),
    };
    const lastSeenMap = channels?.channel_last_seen ?? {};
    return CHANNELS.map((c) => {
      const value = readChannelValue(src, c.aliases);
      const lastSeen = c.aliases.map((a) => lastSeenMap[a]).find(Boolean) ?? null;
      return { ...c, active: value > 0, lastSeen };
    });
  }, [war, channels]);

  const totalAds = war?.total_ads ?? war?.recent_ads?.length ?? 0;
  const totalSight = war?.total_sightings ?? 0;
  const adsThisWeek = war?.ads_this_week ?? 0;
  const daysRunning = useMemo(() => {
    if (!war?.first_seen) return 0;
    const diff = Date.now() - new Date(war.first_seen).getTime();
    return Math.max(1, Math.floor(diff / 86_400_000));
  }, [war?.first_seen]);

  const firstAd = war?.recent_ads?.[0];
  const firstTags = asTags(firstAd?.ai_tags);
  const themes: string[] = (() => {
    const fromWar = (war?.top_themes ?? []).map((t) => t.theme).filter(Boolean);
    if (fromWar.length) return fromWar.slice(0, 6);
    const t = firstTags.themes;
    return Array.isArray(t) ? (t as string[]).slice(0, 6) : [];
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

  // Channel filter for recent ads
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const filteredAds = useMemo(() => {
    const ads = war?.recent_ads ?? [];
    if (channelFilter === "all") return ads;
    return ads.filter((ad) => {
      const ch = (ad.channel ?? "").toLowerCase();
      const tags = asTags(ad.ai_tags);
      const tagCh = String(tags.channel ?? "").toLowerCase();
      const all = `${ch} ${tagCh}`;
      if (channelFilter === "youtube") return /youtube|video/.test(all);
      if (channelFilter === "search") return /search|google/.test(all) && !/youtube/.test(all);
      if (channelFilter === "display") return /display|image|banner/.test(all);
      if (channelFilter === "programmatic") return /programmatic|dsp/.test(all);
      if (channelFilter === "meta") return /meta|facebook|instagram/.test(all);
      return true;
    });
  }, [war?.recent_ads, channelFilter]);

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

  if (loading) {
    return (
      <WorkspaceShell title={brand} subtitle={`War room · ${brand}`}>
        <div style={emptyCard}>Reading signal…</div>
      </WorkspaceShell>
    );
  }

  if (!war) {
    return (
      <WorkspaceShell title={brand} subtitle={`War room · ${brand}`}>
        <Link
          to="/app/advertisers"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6B62", marginBottom: 16, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Back to Advertisers
        </Link>
        <div style={emptyCard}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>R-AD is on it.</div>
          Reading the signal for {brand}. First results within 24 hours.
        </div>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell title={brand}>
      <style>{`@keyframes radPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
      <Link
        to="/app/advertisers"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B6B62", marginBottom: 16, textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Back to Advertisers
      </Link>

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 4 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: "#FDF6E8",
                color: "#C9963A",
                fontSize: 14,
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
              <div style={{ fontSize: 22, fontWeight: 600, color: "#1C1C1A", lineHeight: 1.2 }}>{brand}</div>
              <div style={{ fontSize: 13, color: "#9E9D94", marginTop: 2 }}>
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
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: exporting ? "not-allowed" : "pointer",
                  opacity: exporting ? 0.7 : 1,
                }}
              >
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />}
                {exporting ? "Building deck…" : "Export slides"}
              </button>
              {exportError && (
                <div style={{ color: "#C0392B", fontSize: 12 }}>{exportError}</div>
              )}
            </div>
          </div>

          {/* B — Intel strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <MetricCard
              value={totalAds.toLocaleString()}
              label="Active ads"
              trend={adsThisWeek > 0 ? `↑ ${adsThisWeek} this week` : null}
            />
            <MetricCard
              value={totalSight.toLocaleString()}
              label="Sightings"
              trend={null}
            />
            <div style={{ ...metricCardStyle, alignItems: "flex-start" }}>
              <SpendIndex spend={spend?.estimated_monthly_spend ?? 0} />
            </div>
            <MetricCard
              value={daysRunning.toLocaleString()}
              label="Days running"
              trend={war.first_seen ? `Since ${fmtDate(war.first_seen)}` : null}
            />
          </div>
          <SpendLegend />

          {/* C — Channel presence */}
          <Card title="Channel presence">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {channelData.map((c) => (
                <div key={c.key} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      background: c.active ? "#FDF6E8" : "#F7F6F3",
                      border: `1px solid ${c.active ? "#C9963A" : "#EBE9E4"}`,
                      color: c.active ? "#A07830" : "#C4C2BA",
                    }}
                  >
                    <c.Icon size={12} style={{ color: c.active ? "#C9963A" : "#C4C2BA" }} />
                    {c.label}
                  </div>
                  {c.active && c.lastSeen && (
                    <div style={{ fontSize: 10, color: "#9E9D94", paddingLeft: 4 }}>
                      ↑ since {fmtDate(c.lastSeen)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* D — Creative intelligence */}
          <Card title="What they're saying">
            <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Themes">
                  {themes.length ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {themes.map((t, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "4px 10px",
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
                  ) : (
                    <span style={{ fontSize: 13, color: "#9E9D94" }}>Signal incoming</span>
                  )}
                </Field>
                <Field label="Primary CTA">
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1C1C1A" }}>{primaryCta}</div>
                </Field>
                <Field label="Sentiment">
                  <div style={{ fontSize: 13, fontWeight: 500, color: sentimentColor, textTransform: "capitalize" }}>
                    {sentimentRaw || "Not detected"}
                  </div>
                </Field>
              </div>
              <div>
                <Field label="Audience">
                  {demographics.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {demographics.map((d) => (
                        <div key={d.label}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 11,
                              color: "#6B6B62",
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ textTransform: "capitalize" }}>{d.label}</span>
                            <span style={{ fontWeight: 600, color: "#1C1C1A" }}>{Math.round(d.value)}%</span>
                          </div>
                          <div style={{ height: 4, background: "#F0EDE8", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${d.value}%`, height: "100%", background: "#C9963A" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: "#9E9D94" }}>Signal incoming</span>
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
                        width: 12,
                        height: 12,
                        borderRadius: 3,
                        background: creativeAnalysis.colour,
                        border: "1px solid rgba(0,0,0,0.1)",
                        display: "inline-block",
                      }}
                    />
                    Primary colour
                  </CreativePill>
                )}
                {creativeAnalysis.emotion && (
                  <CreativePill>
                    <span style={{ textTransform: "capitalize" }}>{creativeAnalysis.emotion}</span>
                  </CreativePill>
                )}
                {creativeAnalysis.hasPeople !== null && (
                  <CreativePill>People: {creativeAnalysis.hasPeople ? "Yes" : "No"}</CreativePill>
                )}
                {creativeAnalysis.hasLogo !== null && (
                  <CreativePill>Logo: {creativeAnalysis.hasLogo ? "Yes" : "No"}</CreativePill>
                )}
                {creativeAnalysis.avgDuration && (
                  <CreativePill>~{creativeAnalysis.avgDuration}s avg</CreativePill>
                )}
                {!creativeAnalysis.colour && !creativeAnalysis.emotion && creativeAnalysis.hasPeople === null && (
                  <span style={{ fontSize: 12, color: "#9E9D94" }}>Signal incoming</span>
                )}
              </div>
            </div>
          </Card>

          {/* E — Gap callout */}
          {war.gap || war.insight ? (
            <div
              style={{
                background: "#FDF6E8",
                border: "1px solid #E8D5A0",
                borderLeft: "3px solid #C9963A",
                borderRadius: 8,
                padding: "16px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#A07830",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Opportunity detected
              </div>
              <div style={{ fontSize: 15, color: "#1C1C1A", lineHeight: 1.5 }}>
                {war.gap ?? war.insight}
              </div>
            </div>
          ) : null}

          {/* F — Recent ads */}
          <Card title="Recent ads">
            {/* Channel filter tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
              {[
                { k: "all", l: "All" },
                { k: "youtube", l: "YouTube" },
                { k: "search", l: "Search" },
                { k: "display", l: "Display" },
                { k: "programmatic", l: "Programmatic" },
                { k: "meta", l: "Meta" },
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
              <div style={{ fontSize: 11, color: "#C4C2BA", marginTop: 2 }}>R-AD scans daily</div>
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
  borderRadius: 8,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 4,
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
      <div style={{ fontSize: 24, fontWeight: 600, color: "#1C1C1A", lineHeight: 1 }}>{value}</div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "#9E9D94",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      {trend && (
        <div style={{ fontSize: 11, color: "#2D7D46", marginTop: 2 }}>{trend}</div>
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

function RecentAdRow({ ad, brand }: { ad: RecentAd; brand: string }) {
  const tags = asTags(ad.ai_tags);
  const themes = (() => {
    const t = tags.themes;
    return Array.isArray(t) ? (t as string[]).slice(0, 2) : [];
  })();
  const channel = (ad.channel ?? (tags.channel as string | undefined) ?? "").trim();
  const channelInitial = (channel || brand).charAt(0).toUpperCase();
  const img = ad.image_url ?? ad.thumbnail_url ?? null;
  const sightings = Number(ad.sighting_count ?? 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 0",
        borderBottom: "1px solid #F0EDE8",
      }}
    >
      {img ? (
        <img
          src={img}
          alt=""
          style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0, background: "#F0EDE8" }}
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
          display: img ? "none" : "flex",
          width: 48,
          height: 48,
          borderRadius: 6,
          background: "#F0EDE8",
          color: "#9E9D94",
          fontSize: 14,
          fontWeight: 600,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {channelInitial}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
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
          {channel && (
            <span style={{ fontSize: 11, color: "#9E9D94" }}>{channel}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6B6B62" }}>
          {ad.first_seen ? formatTimeAgo(ad.first_seen) : "—"}
          {ad.last_seen ? ` → ${formatTimeAgo(ad.last_seen)}` : ""}
          {sightings > 0 && ` · ${sightings.toLocaleString()} sightings`}
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
            fontSize: 10,
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
          fontSize: 13,
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
        <div style={{ fontSize: 11, color: "#9E9D94", marginTop: 4 }}>
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
