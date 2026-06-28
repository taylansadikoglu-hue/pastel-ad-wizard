import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Activity, Users, Sparkles, Trophy, ExternalLink, X } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = "https://api.revenuad.com";

type Health = {
  db?: { total_ads?: number; total_sightings?: number; latest_ad?: string };
};
type Advertiser = {
  brand: string;
  advertiser: string;
  industry: string | null;
  ad_count: string | number;
  total_sightings: string | number;
  last_seen: string | null;
  first_seen: string | null;
};
type Ad = {
  id: number;
  image_url: string | null;
  ai_tags: Record<string, unknown> | null;
  advertiser: string | null;
  ad_format: string | null;
  country: string | null;
  first_seen: string | null;
  last_seen: string | null;
  sighting_count: number | null;
};
type CategoryRow = {
  category: string;
  domain: string;
  share_of_voice: number | null;
  spend_volume: number | null;
  keyword_coverage: number | null;
};

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function fmt(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? Number(n) : n ?? 0;
  if (!Number.isFinite(v)) return "0";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(Math.round(v));
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "now";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sourceFromAd(ad: Ad): "Apify" | "DataForSEO" {
  const platform = String((ad.ai_tags?.platform as string) ?? "").toLowerCase();
  if (platform.includes("google")) return "DataForSEO";
  return "Apify";
}

function aiTagsOf(ad: Ad): Record<string, unknown> {
  const raw = ad.ai_tags as unknown;
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function themesFromAd(ad: Ad): string[] {
  const themes = aiTagsOf(ad).themes;
  if (Array.isArray(themes)) return themes.filter((t): t is string => typeof t === "string").slice(0, 3);
  return [];
}

function industryFromAd(ad: Ad): string | null {
  const v = aiTagsOf(ad).industry;
  return typeof v === "string" ? v : null;
}

function financeOfferFromAd(ad: Ad): string | null {
  const v = aiTagsOf(ad).finance_offer;
  if (typeof v === "string" && v.trim()) return v;
  return null;
}

function StatCard({ label, value, hint, icon: Icon }: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="card-flat p-5">
      <div className="flex items-center gap-2 mono text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
        <Icon size={12} className="text-primary" /> {label}
      </div>
      <div className="text-[28px] font-bold tracking-tight leading-none text-ink tabular-nums mt-3">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

function SourceBadge({ source }: { source: "Apify" | "DataForSEO" }) {
  const meta = source === "Apify"
    ? { bg: "bg-[#1877f2]/10", text: "text-[#1877f2]", label: "Creative evidence" }
    : { bg: "bg-[#1a73e8]/10", text: "text-[#1a73e8]", label: "Channel evidence" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] mono font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

export function AdMap() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<Health | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [recentAds, setRecentAds] = useState<Ad[]>([]);
  const [leaderboard, setLeaderboard] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAd, setOpenAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [h, advRes, adsRes, weekRes] = await Promise.all([
        safeJson<Health>(`${API_BASE}/health`),
        safeJson<{ advertisers: Advertiser[] }>(`${API_BASE}/api/advertisers?limit=100`),
        safeJson<{ ads: Ad[] }>(`${API_BASE}/api/ads?limit=12`),
        safeJson<{ ads: Ad[] }>(`${API_BASE}/api/ads?limit=200`),
      ]);
      const { data: catRows } = await supabase
        .from("category_leaderboard")
        .select("category, domain, share_of_voice, spend_volume, keyword_coverage")
        .order("share_of_voice", { ascending: false })
        .limit(10);
      if (cancelled) return;
      setHealth(h);
      setAdvertisers(advRes?.advertisers ?? []);
      setAds(adsRes?.ads ?? []);
      setRecentAds(weekRes?.ads ?? []);
      setLeaderboard((catRows ?? []) as CategoryRow[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalAds = health?.db?.total_ads ?? null;
  const brandCount = advertisers.length;

  const adsThisWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return recentAds.filter((a) => {
      const t = a.first_seen ? new Date(a.first_seen).getTime() : 0;
      return Number.isFinite(t) && t >= cutoff;
    }).length;
  }, [recentAds]);

  const mostActive = useMemo(() => {
    if (!advertisers.length) return null;
    return [...advertisers].sort(
      (a, b) => Number(b.total_sightings ?? 0) - Number(a.total_sightings ?? 0),
    )[0];
  }, [advertisers]);

  const spendingNow = useMemo(
    () =>
      [...advertisers]
        .sort((a, b) => Number(b.ad_count ?? 0) - Number(a.ad_count ?? 0))
        .slice(0, 10),
    [advertisers],
  );

  const goToBrand = (brand: string) => {
    navigate({ to: "/app/advertiser/$domain", params: { domain: brand } });
  };

  return (
    <WorkspaceShell
      title="Ad Map"
      subtitle="Live competitive spend signal — total ads tracked, who's pushing creatives this week, and the latest captures from Meta and Google."
    >
      <div className="space-y-6">
        {/* Section 1 — Stat cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Ads"
            value={totalAds == null ? "—" : fmt(totalAds)}
            hint="Across all tracked brands"
            icon={Activity}
          />
          <StatCard
            label="Brands Tracked"
            value={loading ? "—" : String(brandCount)}
            hint="Active advertisers in feed"
            icon={Users}
          />
          <StatCard
            label="Ads This Week"
            value={loading ? "—" : String(adsThisWeek)}
            hint="First seen in last 7 days"
            icon={Sparkles}
          />
          <StatCard
            label="Most Active Brand"
            value={mostActive?.brand ?? (loading ? "—" : "n/a")}
            hint={mostActive ? `${fmt(mostActive.total_sightings)} impressions` : undefined}
            icon={Trophy}
          />
        </section>

        {/* Section 2 — Who's Spending Right Now */}
        <section className="card-flat p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink/10 flex items-baseline justify-between gap-3">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">02 · Live</div>
              <div className="text-[15px] font-semibold text-ink mt-0.5">Who's Spending Right Now</div>
            </div>
            <div className="text-[11px] text-muted-foreground">Sorted by active creatives</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="text-left mono text-[10px] uppercase tracking-[0.14em]">
                  <th className="px-5 py-2 font-medium">Brand</th>
                  <th className="px-3 py-2 font-medium">Industry</th>
                  <th className="px-3 py-2 font-medium text-right">Creatives</th>
                  <th className="px-3 py-2 font-medium">Last Active</th>
                  <th className="px-5 py-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {spendingNow.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-[12px]">
                      No advertisers yet.
                    </td>
                  </tr>
                )}
                {spendingNow.map((a) => (
                  <tr
                    key={a.brand}
                    onClick={() => goToBrand(a.brand)}
                    className="border-t border-ink/5 hover:bg-secondary/40 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 font-semibold text-ink">{a.brand}</td>
                    <td className="px-3 py-3 text-muted-foreground capitalize">{a.industry ?? "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium text-ink">{a.ad_count}</td>
                    <td className="px-3 py-3 text-muted-foreground">{timeAgo(a.last_seen)}</td>
                    <td className="px-5 py-3">
                      <SourceBadge source="Apify" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3 — Latest Ads Captured */}
        <section>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">03 · Feed</div>
              <div className="text-[15px] font-semibold text-ink mt-0.5">Latest Ads Captured</div>
            </div>
            <div className="text-[11px] text-muted-foreground">Tap a card for the full tag set</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ads.length === 0 && !loading && (
              <div className="card-flat p-8 text-center text-muted-foreground text-[12px] md:col-span-2 lg:col-span-3">
                No ads captured yet.
              </div>
            )}
            {[...ads]
              .filter((ad) => themesFromAd(ad).length > 0)
              .sort((a, b) => {
                const ta = a.last_seen ? new Date(a.last_seen).getTime() : 0;
                const tb = b.last_seen ? new Date(b.last_seen).getTime() : 0;
                return tb - ta;
              })
              .map((ad) => {
              const themes = themesFromAd(ad);
              const industry = industryFromAd(ad);
              const financeOffer = financeOfferFromAd(ad);
              const source = sourceFromAd(ad);
              return (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  themes={themes}
                  industry={industry}
                  financeOffer={financeOffer}
                  source={source}
                  onOpen={() => setOpenAd(ad)}
                />
              );
            })}
          </div>
        </section>

        {/* Section 4 — Category Leaderboard */}
        {leaderboard.length > 0 && (
          <section className="card-flat p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink/10">
              <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">04 · Categories</div>
              <div className="text-[15px] font-semibold text-ink mt-0.5">Category Leaderboard</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground">
                  <tr className="text-left mono text-[10px] uppercase tracking-[0.14em]">
                    <th className="px-5 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Domain</th>
                    <th className="px-3 py-2 font-medium text-right">Share of Voice</th>
                    <th className="px-3 py-2 font-medium text-right">Spend</th>
                    <th className="px-5 py-2 font-medium text-right">Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((row, i) => (
                    <tr key={`${row.category}-${row.domain}-${i}`} className="border-t border-ink/5">
                      <td className="px-5 py-3 font-semibold text-ink capitalize">{row.category}</td>
                      <td className="px-3 py-3 mono text-[12px] text-muted-foreground">{row.domain}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.share_of_voice != null ? `${Number(row.share_of_voice).toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {row.spend_volume != null ? `$${fmt(row.spend_volume)}` : "—"}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{row.keyword_coverage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {openAd && <AdDetail ad={openAd} onClose={() => setOpenAd(null)} />}
    </WorkspaceShell>
  );
}

function AdCard({
  ad,
  themes,
  industry,
  financeOffer,
  source,
  onOpen,
}: {
  ad: Ad;
  themes: string[];
  industry: string | null;
  financeOffer: string | null;
  source: "Apify" | "DataForSEO";
  onOpen: () => void;
}) {
  const [imgOk, setImgOk] = useState<boolean>(Boolean(ad.image_url));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-flat p-4 text-left hover:shadow-flat-md transition-shadow flex flex-col gap-3"
    >
      {ad.image_url && imgOk && (
        <div className="rounded-md overflow-hidden border border-ink/10 bg-secondary/40">
          <img
            src={ad.image_url}
            alt={ad.advertiser ?? "ad"}
            loading="lazy"
            onError={() => setImgOk(false)}
            className="w-full h-40 object-cover"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-ink truncate">{ad.advertiser ?? "Unknown brand"}</div>
        <SourceBadge source={source} />
      </div>
      {industry && (
        <span className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-[10px] mono font-semibold bg-secondary text-ink capitalize">
          {industry}
        </span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {themes.map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-medium">
            {t}
          </span>
        ))}
        {financeOffer && (
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800 font-semibold border border-amber-300">
            {financeOffer}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-ink/5">
        <span className="text-[10px] mono uppercase tracking-wide text-muted-foreground">Tagged by ChatGPT</span>
        <span className="text-[10px] text-muted-foreground">{timeAgo(ad.last_seen ?? ad.first_seen)}</span>
      </div>
    </button>
  );
}

function AdDetail({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const entries = ad.ai_tags ? Object.entries(ad.ai_tags) : [];
  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-paper border-l border-ink overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-ink/10 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Ad detail</div>
            <div className="font-bold text-ink truncate">{ad.advertiser ?? "Unknown brand"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {timeAgo(ad.last_seen ?? ad.first_seen)} · {ad.country ?? ""}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full grid place-items-center hover:bg-secondary"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {ad.image_url && (
            <a
              href={ad.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border border-ink/10 rounded-md overflow-hidden hover:opacity-90"
            >
              <img src={ad.image_url} alt={ad.advertiser ?? "ad"} className="w-full" loading="lazy" />
            </a>
          )}
          {entries.length === 0 && (
            <div className="text-[12px] text-muted-foreground italic">No AI tags recorded.</div>
          )}
          {entries.map(([key, value]) => (
            <div key={key} className="border-b border-ink/5 pb-3">
              <div className="mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{key}</div>
              <div className="text-[13px] text-ink mt-1 break-words">
                {Array.isArray(value)
                  ? value.length === 0
                    ? <span className="text-muted-foreground italic">—</span>
                    : value.map((v, i) => (
                        <span key={i} className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-full text-[11px] bg-secondary">
                          {String(v)}
                        </span>
                      ))
                  : value == null
                    ? <span className="text-muted-foreground italic">—</span>
                    : typeof value === "object"
                      ? <pre className="whitespace-pre-wrap text-[11px] mono">{JSON.stringify(value, null, 2)}</pre>
                      : String(value)}
              </div>
            </div>
          ))}
          {ad.image_url && (
            <a
              href={ad.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] text-primary font-medium"
            >
              Open source asset <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
