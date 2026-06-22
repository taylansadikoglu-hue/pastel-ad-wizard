import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
      if (root.length > 4) {
        candidates.add(root.charAt(0).toUpperCase() + root.slice(1, 4) + root.charAt(4).toUpperCase() + root.slice(5));
      }
      if (root === "commbank") {
        candidates.add("CommBank");
        candidates.add("Commonwealth Bank");
      }

      const results = await Promise.all(
        [...candidates].map((brand) =>
          fetch(`${API_BASE}/api/ads?brand=${encodeURIComponent(brand)}&limit=50`)
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

      if (!alive) return;
      setSummary(matchedSummary);
      setAds([...merged.values()]);
      setLoading(false);
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

  const stats = useMemo(() => {
    const themeCounts = new Map<string, number>();
    const industryCounts = new Map<string, number>();
    let financeOffers = 0;
    let videoCount = 0;
    let displayCount = 0;
    for (const a of ads) {
      const t = asTags(a.ai_tags);
      for (const th of asStringArray(t.themes)) themeCounts.set(th, (themeCounts.get(th) ?? 0) + 1);
      const ind = typeof t.industry === "string" ? t.industry : "";
      if (ind) industryCounts.set(ind, (industryCounts.get(ind) ?? 0) + 1);
      if (typeof t.finance_offer === "string" && t.finance_offer.trim()) financeOffers += 1;
      const fmt = adFormat(a);
      if (fmt === "video") videoCount += 1;
      else if (fmt === "display") displayCount += 1;
    }
    const topTheme = [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const topIndustry = [...industryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { total: ads.length, topTheme, topIndustry, financeOffers, videoCount, displayCount };
  }, [ads]);

  const headerBrand = summary?.brand ?? summary?.advertiser ?? domain;
  const headerIndustry = summary?.industry ?? stats.topIndustry ?? "—";
  const headerTotal = summary ? num(summary.ad_count ?? summary.total_sightings) || ads.length : ads.length;
  const headerFirst = summary?.first_seen ?? ads.reduce<string | null>((acc, a) => {
    if (!a.first_seen) return acc;
    if (!acc) return a.first_seen;
    return new Date(a.first_seen) < new Date(acc) ? a.first_seen : acc;
  }, null);

  const brandLabel = String(headerBrand);

  return (
    <WorkspaceShell title={brandLabel} subtitle="Ad library · creatives, themes and channel mix for this advertiser.">
      <div className="space-y-6">
        <Link to="/app/advertisers" className="mono text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={12} /> Back to advertisers
        </Link>

        {/* Header strip */}
        <div className="card-flat p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <HeaderCell label="Brand" value={brandLabel} />
          <HeaderCell label="Industry" value={String(headerIndustry)} className="capitalize" />
          <HeaderCell label="Total ads" value={String(headerTotal)} />
          <HeaderCell label="First seen" value={fmtDate(headerFirst)} />
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={String(stats.total)} />
          <StatCard label="Video" value={String(stats.videoCount)} />
          <StatCard label="Display" value={String(stats.displayCount)} />
          <StatCard label="Industry" value={stats.topIndustry} capitalize />
          <StatCard label="Top theme" value={stats.topTheme} capitalize />
          <StatCard label="Finance offers" value={String(stats.financeOffers)} />
        </div>

        {isBlocked ? (
          <PaywallCard />
        ) : (
          <>
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
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="border border-ink/20 rounded-[3px] px-2 py-1 bg-paper text-xs"
                  aria-label="From date"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="border border-ink/20 rounded-[3px] px-2 py-1 bg-paper text-xs"
                  aria-label="To date"
                />
                {(from || to) && (
                  <button
                    onClick={() => { setFrom(""); setTo(""); }}
                    className="text-[10px] mono uppercase tracking-widest text-muted-foreground hover:text-ink ml-1"
                  >
                    Clear
                  </button>
                )}
              </div>
              <span className="w-px h-5 bg-ink/10 mx-1" />
              <div className="flex items-center gap-1.5 text-xs">
                <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="border border-ink/20 rounded-[3px] px-2 py-1 bg-paper text-xs"
                  aria-label="Sort ads"
                >
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

            {/* Grid */}
            {loading ? (
              <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading ads…</div>
            ) : filtered.length === 0 ? (
              <div className="card-flat p-12 text-center text-sm text-muted-foreground">
                No ads match these filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((ad) => (
                  <AdCard key={ad.id} ad={ad} brand={brandLabel} onOpen={() => setActive(ad)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {active && <AdPanel ad={active} brand={brandLabel} onClose={() => setActive(null)} />}
    </WorkspaceShell>
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
  const [ok, setOk] = useState<boolean>(Boolean(ad.image_url));
  const isVideo = adKind(ad) === "video";
  if (ad.image_url && ok) {
    return (
      <div className="relative aspect-video bg-paper border-b border-ink/10 overflow-hidden">
        <img
          src={ad.image_url}
          alt={ad.advertiser ?? ad.brand ?? "Creative"}
          loading="lazy"
          onError={() => setOk(false)}
          className="w-full h-full object-cover"
        />
        {isVideo && (
          <div className="absolute inset-0 grid place-items-center bg-black/30">
            <div className="w-12 h-12 rounded-full bg-white/95 grid place-items-center shadow">
              <Play size={20} className="text-ink ml-0.5" />
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="aspect-video bg-paper border-b border-ink/10 grid place-items-center text-muted-foreground">
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
          <AdMedia ad={ad} />

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
