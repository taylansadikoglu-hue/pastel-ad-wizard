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
};

type Ad = {
  id: number | string;
  advertiser?: string | null;
  brand?: string | null;
  image_url?: string | null;
  video_url?: string | null;
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

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

function adKind(ad: Ad): "video" | "image" {
  return ad.video_url ? "video" : "image";
}

type FilterKind = "all" | "image" | "video";
type FilterChannel = "all" | "google" | "meta";

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
      const [sRes, aRes] = await Promise.all([
        fetch(`${API_BASE}/api/advertisers/${encodeURIComponent(domain)}`).then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch(`${API_BASE}/api/ads?brand=${encodeURIComponent(domain)}&limit=50`).then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (!alive) return;
      const s: AdvertiserSummary | null = sRes?.advertiser ?? sRes ?? null;
      const list: Ad[] = aRes?.ads ?? aRes?.data ?? (Array.isArray(aRes) ? aRes : []);
      setSummary(s);
      setAds(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [domain]);

  const isBlocked = tierLoaded && tier !== null && SOLO_TIERS.has(tier);

  const filtered = useMemo(() => {
    return ads.filter((a) => {
      if (kind === "image" && adKind(a) !== "image") return false;
      if (kind === "video" && adKind(a) !== "video") return false;
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
  }, [ads, kind, channel, from, to]);

  const stats = useMemo(() => {
    const themeCounts = new Map<string, number>();
    const emotionCounts = new Map<string, number>();
    let financeOffers = 0;
    for (const a of ads) {
      const t = asTags(a.ai_tags);
      for (const th of asStringArray(t.themes)) themeCounts.set(th, (themeCounts.get(th) ?? 0) + 1);
      const em = typeof t.emotion === "string" ? t.emotion : typeof t.sentiment === "string" ? t.sentiment : "";
      if (em) emotionCounts.set(em, (emotionCounts.get(em) ?? 0) + 1);
      if (typeof t.finance_offer === "string" && t.finance_offer.trim()) financeOffers += 1;
    }
    const topTheme = [...themeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const topEmotion = [...emotionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    return { totalCreatives: ads.length, topTheme, topEmotion, financeOffers };
  }, [ads]);

  const headerBrand = summary?.brand ?? summary?.advertiser ?? domain;
  const headerIndustry = summary?.industry ?? "—";
  const headerTotal = summary ? num(summary.ad_count ?? summary.total_sightings) || ads.length : ads.length;
  const headerFirst = summary?.first_seen ?? ads.reduce<string | null>((acc, a) => {
    if (!a.first_seen) return acc;
    if (!acc) return a.first_seen;
    return new Date(a.first_seen) < new Date(acc) ? a.first_seen : acc;
  }, null);

  return (
    <WorkspaceShell title={String(headerBrand)} subtitle="Ad library · creatives, themes and channel mix for this advertiser.">
      <div className="space-y-6">
        <Link to="/app/advertisers" className="mono text-[11px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1 hover:text-ink">
          <ArrowLeft size={12} /> Back to advertisers
        </Link>

        {/* Header strip */}
        <div className="card-flat p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <HeaderCell label="Brand" value={String(headerBrand)} />
          <HeaderCell label="Industry" value={String(headerIndustry)} className="capitalize" />
          <HeaderCell label="Total ads" value={String(headerTotal)} />
          <HeaderCell label="First seen" value={fmtDate(headerFirst)} />
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total creatives" value={String(stats.totalCreatives)} />
          <StatCard label="Most used theme" value={stats.topTheme} capitalize />
          <StatCard label="Dominant emotion" value={stats.topEmotion} capitalize />
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
                  { v: "video", label: "Videos" },
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
                  <AdCard key={ad.id} ad={ad} onOpen={() => setActive(ad)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {active && <AdPanel ad={active} onClose={() => setActive(null)} />}
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

function AdCard({ ad, onOpen }: { ad: Ad; onOpen: () => void }) {
  const tags = asTags(ad.ai_tags);
  const themes = asStringArray(tags.themes).slice(0, 3);
  const finance = typeof tags.finance_offer === "string" ? tags.finance_offer : null;
  const sentiment = typeof tags.sentiment === "string" ? tags.sentiment : null;
  const sightings = num(ad.sighting_count);
  return (
    <button
      onClick={onOpen}
      className="card-flat overflow-hidden flex flex-col text-left hover:shadow-flat-md transition-shadow"
    >
      <AdMedia ad={ad} />
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {sentiment && (
          <div>
            <Badge variant="outline" className="capitalize text-[10px] mono uppercase tracking-widest">
              {sentiment}
            </Badge>
          </div>
        )}
        {themes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {themes.map((t) => (
              <span key={t} className="px-2 py-0.5 border border-ink/30 rounded-full text-[10px] font-medium capitalize">
                {t.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
        {finance && (
          <div className="bg-amber-100 border border-amber-500 rounded-[6px] px-2.5 py-1.5 text-[11px] font-semibold text-amber-950">
            {finance}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-ink/10 text-[11px] text-muted-foreground">
          <span>{fmtDate(ad.first_seen)} → {timeAgo(ad.last_seen)}</span>
          {sightings > 0 && <span className="mono">Seen {sightings}×</span>}
        </div>
      </div>
    </button>
  );
}

function AdPanel({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const tags = asTags(ad.ai_tags);
  const entries = Object.entries(tags);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div
        className="w-full max-w-md bg-paper border-l border-ink h-full overflow-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-paper border-b border-ink/10 p-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Creative detail</div>
            <div className="font-bold truncate">{ad.advertiser ?? ad.brand ?? "Ad"}</div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <AdMedia ad={ad} />

          <Section label="Channel source">
            <div className="capitalize text-sm font-medium">{adChannel(ad)}</div>
          </Section>

          <Section label="Sighting history">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <KV k="First seen" v={fmtDate(ad.first_seen)} />
              <KV k="Last seen" v={fmtDate(ad.last_seen)} />
              <KV k="Sightings" v={String(num(ad.sighting_count))} />
            </div>
          </Section>

          <Section label="AI tags">
            {entries.length === 0 ? (
              <div className="text-xs text-muted-foreground">No AI tags recorded.</div>
            ) : (
              <dl className="space-y-2 text-xs">
                {entries.map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[120px_1fr] gap-2">
                    <dt className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                    <dd className="font-medium break-words whitespace-pre-wrap">
                      {typeof v === "string" || typeof v === "number" || typeof v === "boolean"
                        ? String(v)
                        : Array.isArray(v)
                          ? v.join(", ")
                          : JSON.stringify(v, null, 2)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
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
