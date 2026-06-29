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
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { CampaignIntelligenceBlock } from "@/components/adpalette/CampaignIntelligenceBlock";
import { CampaignStoryBlock } from "@/components/adpalette/CampaignStoryBlock";
import { AdvertiserStrategistIntelBlock } from "@/components/adpalette/AdvertiserStrategistIntelBlock";
import {
  buildAdvertiserChannelMix,
  buildAdvertiserRecommendedMoves,
  buildAdvertiserSpendBand,
  buildAudiencesPersonas,
  buildCurrentMarketingRead,
  buildMeetingTalkingPoints,
  buildProductsPromoted,
  buildWhatTheyreMissing,
  buildWhatTheyreSaying,
} from "@/lib/radAdvertiserBrief";
import {
  fetchAdvertiserPlacements,
  hasPlacementIntel,
  mergeAdvertiserIntel,
  PLACEMENT_INTEL_UNAVAILABLE,
  type AdvertiserIntelWar,
  type AdvertiserPlacementRow,
} from "@/lib/advertiserPlacements";
import { buildCampaignIntelligence } from "@/lib/campaignIntelligence";
import { buildCampaignStory } from "@/lib/campaignStory";
import {
  fetchAdvertiserStrategistIntel,
  type AdvertiserStrategistIntel,
} from "@/lib/advertiserStrategistIntel";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type RecentAd = AdvertiserPlacementRow & {
  image_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  ad_format?: string | null;
  advertiser?: string | null;
  sighting_count?: number | string | null;
};

type War = AdvertiserIntelWar & {
  total_sightings?: number;
  channel_split?: Record<string, number> | string[];
  sentiment_breakdown?: { positive?: number; neutral?: number; urgency?: number };
  gap?: string;
  insight?: string;
  reach_frequency?: {
    totalUniqueReach?: number;
    avgFrequency?: number;
    channels?: Record<string, { reach?: number; adCount?: number } | number>;
  };
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

function isUsableCopy(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  if (/creative detected for/i.test(value)) return false;
  if (/copy unavailable from source feed/i.test(value)) return false;
  return true;
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
  Search: ["Google Search", "search", "google"],
  Display: ["Google Display", "Programmatic", "DCO", "display", "programmatic"],
  Meta: ["Meta", "Facebook", "Instagram", "meta", "facebook"],
  TikTok: ["TikTok", "tiktok"],
};

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
  const [placementRowCount, setPlacementRowCount] = useState(0);
  const [strategistIntel, setStrategistIntel] = useState<AdvertiserStrategistIntel | null>(null);

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

      const placementFetch = await fetchAdvertiserPlacements(supabase, domain, 100);
      const strategistFetch = await fetchAdvertiserStrategistIntel(supabase, domain);
      const merged = mergeAdvertiserIntel(w, placementFetch.rows, resolved, domain);

      if (!alive) return;
      setPlacementRowCount(placementFetch.rows.length);
      setStrategistIntel(strategistFetch);
      setWar(merged as War | null);
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

  const placementIntelUnavailable = placementRowCount === 0;

  const advertiserBrief = useMemo(() => {
    if (!war) return null;
    return {
      marketingRead: buildCurrentMarketingRead(brand, war),
      channelMix: buildAdvertiserChannelMix(war),
      spend: buildAdvertiserSpendBand(war),
      products: buildProductsPromoted(war),
      audiences: buildAudiencesPersonas(war),
      saying: buildWhatTheyreSaying(war),
      missing: buildWhatTheyreMissing(brand, war),
      moves: buildAdvertiserRecommendedMoves(brand, war),
      talkingPoints: buildMeetingTalkingPoints(brand, war),
    };
  }, [war, brand]);

  const campaignIntel = useMemo(() => {
    if (!war) return null;
    return buildCampaignIntelligence(brand, war);
  }, [war, brand]);

  const campaignStory = useMemo(() => {
    if (!war) return null;
    return buildCampaignStory(brand, war);
  }, [war, brand]);

  const totalAds = war?.total_ads ?? war?.recent_ads?.length ?? 0;
  void (war?.total_sightings ?? 0);
  const adsThisWeek = war?.ads_this_week ?? 0;
  const daysRunning = useMemo(() => {
    if (!war?.first_seen) return 0;
    const diff = Date.now() - new Date(war.first_seen).getTime();
    return Math.max(1, Math.floor(diff / 86_400_000));
  }, [war?.first_seen]);

  const firstAd = war?.placements?.[0] ?? war?.recent_ads?.[0];
  const sentimentRaw = firstAd?.emotional_driver ?? "";
  const sentimentColor =
    /security|trust|positive/i.test(sentimentRaw) ? "#2D7D46"
      : /fear|urgency|negative/i.test(sentimentRaw) ? "#C0392B"
      : "#9E9D94";

  // Creative analysis from placement intel columns
  const creativeAnalysis = useMemo(() => {
    const ads = war?.placements ?? war?.recent_ads ?? [];
    const emotions = new Map<string, number>();
    const stages = new Map<string, number>();
    const offerTypes = new Map<string, number>();
    for (const ad of ads) {
      if (isUsableCopy(ad.emotional_driver)) {
        emotions.set(ad.emotional_driver!, (emotions.get(ad.emotional_driver!) ?? 0) + 1);
      }
      if (isUsableCopy(ad.buyer_stage)) {
        stages.set(ad.buyer_stage!, (stages.get(ad.buyer_stage!) ?? 0) + 1);
      }
      if (isUsableCopy(ad.offer_type)) {
        offerTypes.set(ad.offer_type!, (offerTypes.get(ad.offer_type!) ?? 0) + 1);
      }
    }
    const topEmotion = [...emotions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topStage = [...stages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const topOfferType = [...offerTypes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const hook = ads.map((a) => a.hook_analysis).find(isUsableCopy) ?? null;
    return {
      emotion: topEmotion,
      stage: topStage,
      offerType: topOfferType,
      hook,
    };
  }, [war?.placements, war?.recent_ads]);

  // Channel filter for recent ads — uses ad.channel_platform per spec.
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const filteredAds = useMemo(() => {
    const ads = war?.placements ?? war?.recent_ads ?? [];
    if (channelFilter === "all") return ads;
    const aliases = CHANNEL_TAB_MAP[channelFilter] ?? [];
    return ads.filter((ad) => {
      const platform = String(ad.channel_platform ?? ad.channel ?? "").toLowerCase();
      return aliases.some((v) => platform.includes(v.toLowerCase()));
    });
  }, [war?.placements, war?.recent_ads, channelFilter]);

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

  if (!war || !hasPlacementIntel(war)) {
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


          <CampaignStoryBlock
            brand={brand}
            loading={loading}
            placementIntelUnavailable={placementIntelUnavailable}
            story={campaignStory}
          />

          <AdvertiserStrategistIntelBlock
            brand={brand}
            loading={loading}
            intel={strategistIntel}
          />

          {advertiserBrief && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div
                style={{
                  paddingTop: 8,
                  borderTop: "1px solid #EBE9E4",
                  marginTop: 4,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Supporting evidence
                </div>
                <p style={{ fontSize: 13, color: "#6B6B62", margin: "6px 0 0", lineHeight: 1.5 }}>
                  Channel mix, spend estimates, products, and campaign detail for deeper prep.
                </p>
              </div>

              <InsightSection title="Current marketing read" accent>
                <p style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.65, margin: 0 }}>
                  {advertiserBrief.marketingRead}
                </p>
              </InsightSection>

              <InsightSection title="Channel mix">
                <ChannelMixBars
                  rows={advertiserBrief.channelMix.rows}
                  overallConfidence={advertiserBrief.channelMix.overallConfidence}
                  sourceLabel={advertiserBrief.channelMix.sourceLabel}
                  estimationTooltip={advertiserBrief.channelMix.estimationTooltip}
                  available={advertiserBrief.channelMix.available}
                  variant="light"
                  emptyMessage="Channel mix unavailable for this advertiser."
                />
              </InsightSection>

              <InsightSection title="Estimated spend range">
                {advertiserBrief.spend.label ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.02em" }}>
                      {advertiserBrief.spend.label}
                    </div>
                    <p style={{ fontSize: 12, color: "#9E9D94", margin: "8px 0 0", lineHeight: 1.5 }}>
                      {advertiserBrief.spend.disclaimer}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "#6B6B62", margin: 0 }}>Spend estimate unavailable for this advertiser.</p>
                )}
              </InsightSection>

              <InsightSection title="Products being promoted">
                {advertiserBrief.products.length ? (
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {advertiserBrief.products.map((product) => (
                      <li
                        key={product}
                        style={{
                          fontSize: 13,
                          color: "#1C1C1A",
                          background: "#F7F6F3",
                          border: "1px solid #EBE9E4",
                          borderRadius: 6,
                          padding: "6px 10px",
                        }}
                      >
                        {product}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 13, color: "#9E9D94", margin: 0 }}>
                    {placementIntelUnavailable
                      ? PLACEMENT_INTEL_UNAVAILABLE
                      : "No product fields on indexed placements."}
                  </p>
                )}
              </InsightSection>

              <InsightSection title="What they're saying">
                {placementIntelUnavailable ? (
                  <p style={{ fontSize: 13, color: "#9E9D94", margin: 0 }}>{PLACEMENT_INTEL_UNAVAILABLE}</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                    <BriefList label="Emotional driver" items={advertiserBrief.saying.emotionalDrivers} />
                    <BriefList label="Buyer stage" items={advertiserBrief.saying.buyerStages} />
                    <BriefList label="Offer type" items={advertiserBrief.saying.offerTypes} />
                    <BriefList label="CTAs" items={advertiserBrief.saying.ctas} />
                    <BriefList label="Hooks" items={advertiserBrief.saying.hooks} />
                    <BriefList label="Offer themes" items={advertiserBrief.saying.offerThemes} />
                  </div>
                )}
                {!placementIntelUnavailable && advertiserBrief.saying.copySnippets.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <BriefList label="Ad copy" items={advertiserBrief.saying.copySnippets} />
                  </div>
                )}
              </InsightSection>

              <InsightSection title="Audiences / personas">
                {advertiserBrief.audiences.length ? (
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                    {advertiserBrief.audiences.map((audience) => (
                      <li
                        key={audience.label}
                        style={{
                          fontSize: 13,
                          color: "#1C1C1A",
                          background: "#F7F6F3",
                          border: "1px solid #EBE9E4",
                          borderRadius: 6,
                          padding: "8px 10px",
                          lineHeight: 1.45,
                        }}
                      >
                        {audience.label}
                        {audience.inferred && (
                          <span style={{ display: "block", fontSize: 11, color: "#9E9D94", marginTop: 2 }}>
                            Inferred from page copy
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 13, color: "#9E9D94", margin: 0 }}>
                    {placementIntelUnavailable
                      ? PLACEMENT_INTEL_UNAVAILABLE
                      : "No audience signals inferred from indexed placements."}
                  </p>
                )}
              </InsightSection>

              <InsightSection title="What they're missing">
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                  {advertiserBrief.missing.map((item) => (
                    <li key={item} style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.55 }}>{item}</li>
                  ))}
                </ul>
              </InsightSection>

              <InsightSection title="Recommended next moves" accentDark>
                <ol style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
                  {advertiserBrief.moves.map((move, i) => (
                    <li key={move} style={{ display: "flex", gap: 12, fontSize: 14, color: "#1C1C1A", lineHeight: 1.55 }}>
                      <span style={{
                        flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
                        background: "#FDF6E8", border: "1px solid #E8D5A0",
                        color: "#A07830", fontSize: 12, fontWeight: 600,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {i + 1}
                      </span>
                      <span>{move}</span>
                    </li>
                  ))}
                </ol>
              </InsightSection>

              <InsightSection title="Meeting talking points">
                <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  {advertiserBrief.talkingPoints.map((point) => (
                    <li key={point} style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.55 }}>{point}</li>
                  ))}
                </ul>
              </InsightSection>
            </div>
          )}

          <CampaignIntelligenceBlock
            brand={brand}
            loading={loading}
            placementIntelUnavailable={placementIntelUnavailable}
            intel={campaignIntel}
          />

          <div style={{ marginBottom: 4 }}>
            <DataFeedPanel domain={domain} brandLabel={brand} />
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



          {/* Creative tags — supporting detail */}
          <Card title="Creative analysis">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {creativeAnalysis.emotion && (
                <CreativePill>
                  <span style={{ textTransform: "capitalize" }}>{creativeAnalysis.emotion}</span>
                </CreativePill>
              )}
              {creativeAnalysis.stage && (
                <CreativePill>{creativeAnalysis.stage} stage</CreativePill>
              )}
              {creativeAnalysis.offerType && (
                <CreativePill>{creativeAnalysis.offerType} offer</CreativePill>
              )}
              {(() => {
                const fmt = (firstAd?.ad_type ?? "").trim();
                return fmt ? <CreativePill><span style={{ textTransform: "capitalize" }}>{fmt}</span></CreativePill> : null;
              })()}
              {!creativeAnalysis.emotion && !creativeAnalysis.stage && !creativeAnalysis.offerType && !firstAd?.ad_type && (
                <span style={{ fontSize: 12, color: "#9E9D94" }}>
                  {placementIntelUnavailable
                    ? PLACEMENT_INTEL_UNAVAILABLE
                    : "No strategist fields on indexed placements."}
                </span>
              )}
            </div>
            {creativeAnalysis.hook && (
              <p style={{ marginTop: 12, fontSize: 13, color: "#6B6B62", lineHeight: 1.5 }}>
                {creativeAnalysis.hook}
              </p>
            )}
            {sentimentRaw && (
              <div style={{ marginTop: 12, fontSize: 13, color: sentimentColor }}>
                Emotional driver: {sentimentRaw}
              </div>
            )}
          </Card>

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

function InsightSection({
  title,
  meta,
  accent,
  accentDark,
  children,
}: {
  title: string;
  meta?: string;
  accent?: boolean;
  accentDark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #EBE9E4",
        borderLeft: accent ? "3px solid #C9963A" : accentDark ? "3px solid #1C1C1A" : "1px solid #EBE9E4",
        borderRadius: 8,
        padding: "18px 22px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6B6B62", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {title}
        </div>
        {meta && <div style={{ fontSize: 11, color: "#9E9D94" }}>{meta}</div>}
      </div>
      {children}
    </div>
  );
}

function BriefList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {label}
      </div>
      {items.length ? (
        <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <li key={item} style={{ fontSize: 13, color: "#1C1C1A", lineHeight: 1.45 }}>{item}</li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 13, color: "#9E9D94" }}>—</div>
      )}
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
  const channel = (ad.channel_platform ?? ad.channel ?? "").trim();
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

  // Thumbnail fallback hierarchy: media_url → creative_url → thumbnail_url
  let imgSrc: string | null = ad.thumbnail_url ?? null;
  if (!imgSrc && ad.media_url) imgSrc = proxyImage(ad.media_url);
  if (!imgSrc && ad.creative_url) imgSrc = proxyImage(ad.creative_url);
  if (!imgSrc && ad.video_url) {
    const id = youtubeId(ad.video_url);
    if (id) imgSrc = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
  }
  if (!imgSrc && ad.image_url) imgSrc = proxyImage(ad.image_url);

  const sightings = Number(ad.times_seen ?? ad.sighting_count ?? 0);
  const pills = [ad.emotional_driver, ad.offer_type, ad.buyer_stage].filter(isUsableCopy);
  const title = isUsableCopy(ad.ad_title)
    ? ad.ad_title
    : isUsableCopy(ad.headline)
      ? ad.headline
      : isUsableCopy(ad.page_title)
        ? ad.page_title
        : null;
  const archiveUrl = ad.source_archive_url?.trim() || null;
  const takeaway = isUsableCopy(ad.strategist_takeaway) ? ad.strategist_takeaway : null;
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
          {ad.ad_type && (
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
              {ad.ad_type}
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
        {title && (
          <div style={{ fontSize: 13, color: "#1C1C1A", marginBottom: 4, lineHeight: 1.4 }}>{title}</div>
        )}
        {takeaway && (
          <div style={{ fontSize: 12, color: "#6B6B62", lineHeight: 1.45, marginBottom: 4 }}>{takeaway}</div>
        )}
        <div style={{ fontSize: 12, color: "#6B6B62" }}>
          {ad.first_seen ? formatTimeAgo(ad.first_seen) : "—"}
          {ad.last_seen ? ` → ${formatTimeAgo(ad.last_seen)}` : ""}
          {sightings > 0 && ` · ${sightings.toLocaleString()} impressions`}
          {archiveUrl && (
            <>
              {" · "}
              <a
                href={archiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#A07830", textDecoration: "none" }}
                onClick={(e) => e.stopPropagation()}
              >
                View in ad library
              </a>
            </>
          )}
        </div>
      </div>
      {pills.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", maxWidth: 180 }}>
          {pills.map((t) => (
            <span
              key={t}
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
