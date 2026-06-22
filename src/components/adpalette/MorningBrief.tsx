import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Inbox, Plus, Target } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = "https://api.revenuad.com";

type AiMeta = Record<string, unknown> & {
  themes?: unknown;
  sentiment?: unknown;
  finance_offer?: unknown;
  industry?: unknown;
};

type Advertiser = {
  brand: string;
  advertiser: string;
  industry: string | null;
  ad_count: string | number;
  total_sightings: string | number;
  last_seen: string | null;
  first_seen: string | null;
  sentiment_score?: number | string | null;
  estimated_spend?: number | string | null;
  dominant_reaction?: string | null;
};

type Ad = {
  id: number;
  image_url: string | null;
  ai_tags?: AiMeta | string | null;
  ai_metadata?: AiMeta | string | null;
  advertiser: string | null;
  first_seen: string | null;
  last_seen: string | null;
  sighting_count?: number | string | null;
  sentiment_score?: number | string | null;
  estimated_spend?: number | string | null;
  dominant_reaction?: string | null;
};

type ThemesResp = {
  messaging_themes?: { theme: string; count: string | number }[];
};

type SovBrand = {
  brand: string;
  industry: string;
  creatives: string | number;
  sightings: string | number;
  share_pct: string | number;
  sentiment_score?: number | string | null;
  estimated_spend?: number | string | null;
};

type SovResp = { brands?: SovBrand[] };

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function withTenant(url: string, agencyId: string | null): string {
  if (!agencyId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}agency_id=${encodeURIComponent(agencyId)}`;
}

function asMeta(raw: AiMeta | string | null | undefined): AiMeta {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as AiMeta; } catch { return {}; }
  }
  return raw;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function sentimentScore(source: { sentiment_score?: unknown; ai_metadata?: AiMeta | string | null; ai_tags?: AiMeta | string | null }): number {
  if (source.sentiment_score != null) return Math.max(0, Math.min(100, num(source.sentiment_score)));
  const meta = asMeta(source.ai_metadata ?? source.ai_tags);
  const s = (typeof meta.sentiment === "string" ? meta.sentiment : "").toLowerCase();
  if (s === "positive" || s === "aspirational" || s === "trust") return 78;
  if (s === "urgency" || s === "fear" || s === "negative") return 28;
  if (s === "neutral") return 52;
  return 50;
}

function spendScore(a: { estimated_spend?: unknown; total_sightings?: unknown; sightings?: unknown; sighting_count?: unknown; ad_count?: unknown; creatives?: unknown }): number {
  if (a.estimated_spend != null) return num(a.estimated_spend);
  // Proxy: sightings × creatives weighting
  const sightings = num(a.total_sightings ?? a.sightings ?? a.sighting_count);
  const creatives = num(a.ad_count ?? a.creatives);
  return Math.round(sightings * 120 + creatives * 60);
}

function spendLabel(v: number): string {
  if (v >= 100000) return `$${(v / 1000).toFixed(0)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

function dominantReaction(a: Advertiser, meta: AiMeta): string {
  if (a.dominant_reaction) return a.dominant_reaction;
  const s = typeof meta.sentiment === "string" ? meta.sentiment : "";
  return s || "mixed";
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function sinceDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || t < 100000000000) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function sentimentTone(score: number): { label: string; cls: string } {
  if (score >= 65) return { label: "Positive", cls: "border-emerald-600 text-emerald-700 bg-emerald-50" };
  if (score >= 45) return { label: "Neutral", cls: "border-amber-500 text-amber-800 bg-amber-50" };
  return { label: "Negative", cls: "border-rose-600 text-rose-700 bg-rose-50" };
}

export function MorningBrief() {
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [topAd, setTopAd] = useState<Ad | null>(null);
  const [themes, setThemes] = useState<{ theme: string; count: number }[]>([]);
  const [sov, setSov] = useState<SovBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const aid = data.user?.id ?? null;
      if (cancelled) return;
      setAgencyId(aid);

      const advRes = await safeJson<{ advertisers: Advertiser[] }>(
        withTenant(`${API_BASE}/api/advertisers?limit=50`, aid),
      );
      const list = (advRes?.advertisers ?? []).slice().sort(
        (a, b) => spendScore(b) - spendScore(a),
      );
      if (cancelled) return;
      setAdvertisers(list);

      const top = list[0];
      const [adRes, themeRes, sovRes] = await Promise.all([
        top
          ? safeJson<{ ads: Ad[] }>(
              withTenant(`${API_BASE}/api/ads?limit=10&brand=${encodeURIComponent(top.brand)}`, aid),
            )
          : Promise.resolve(null),
        safeJson<ThemesResp>(withTenant(`${API_BASE}/api/intelligence/creative-themes`, aid)),
        safeJson<SovResp>(withTenant(`${API_BASE}/api/intelligence/share-of-voice?limit=30`, aid)),
      ]);
      if (cancelled) return;

      const ads = adRes?.ads ?? [];
      const withImage = ads.find((a) => a.image_url) ?? ads[0] ?? null;
      setTopAd(withImage);

      const t = (themeRes?.messaging_themes ?? [])
        .map((x) => ({ theme: x.theme, count: num(x.count) }))
        .filter((x) => x.theme);
      setThemes(t);
      setSov(sovRes?.brands ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const pulse = useMemo(() => {
    const recent = advertisers.filter((a) => {
      const t = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      return Date.now() - t < 72 * 3600 * 1000;
    });
    const creativeCount = recent.reduce((s, a) => s + num(a.ad_count), 0);
    const top = advertisers[0];
    const industry = top?.industry ?? "market";
    const level: "HIGH" | "NORMAL" = creativeCount > 120 ? "HIGH" : "NORMAL";
    return { level, creativeCount, top, industry };
  }, [advertisers]);

  const top = pulse.top;
  const topMeta = asMeta(topAd?.ai_metadata ?? topAd?.ai_tags);
  const topThemes = Array.isArray(topMeta.themes)
    ? (topMeta.themes as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 4)
    : [];

  const lowThemes = useMemo(() => {
    if (themes.length === 0) return [];
    return themes.slice().sort((a, b) => a.count - b.count).slice(0, 4).map((t) => t.theme);
  }, [themes]);

  // Section 3: prioritize gaps where competitor has HIGH spend but LOW sentiment
  const winConditions = useMemo(() => {
    if (!sov || sov.length === 0) return [];
    const enriched = sov.map((b) => {
      const spend = spendScore(b);
      const sent = sentimentScore(b);
      // counter-angle score: high spend × low sentiment
      const counter = spend * (100 - sent);
      return { b, spend, sent, counter };
    });
    const sorted = enriched.sort((x, y) => y.counter - x.counter).slice(0, 3);
    return sorted.map((row, i) => {
      const themeGap = lowThemes[i] ?? row.b.industry ?? "whitespace narrative";
      const competitorAds = num(row.b.creatives);
      const confidence = row.sent < 40 && row.spend > 0
        ? "High"
        : competitorAds < 25
          ? "Medium"
          : "Low";
      return {
        label: String(themeGap).replace(/_/g, " "),
        rationale: row.sent < 45
          ? `${row.b.brand} is spending ${spendLabel(row.spend)} but sentiment is weak (${row.sent.toFixed(0)}/100) — counter-angle opening.`
          : `${row.b.brand} only owns ${num(row.b.share_pct).toFixed(1)}% share — exploitable.`,
        confidence,
      };
    });
  }, [sov, lowThemes]);

  if (loading) {
    return (
      <WorkspaceShell title="Morning Brief" subtitle="Your pitch intel, ready before the meeting.">
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading brief…</div>
      </WorkspaceShell>
    );
  }

  if (!top) {
    return (
      <WorkspaceShell title="Morning Brief" subtitle="Your pitch intel, ready before the meeting.">
        <EmptyState />
      </WorkspaceShell>
    );
  }

  const topSpend = spendScore(top);
  const topSent = sentimentScore(top);
  const tone = sentimentTone(topSent);
  const reaction = dominantReaction(top, topMeta);
  const aggression = Math.min(100, num(top.total_sightings));
  const financeOffer = typeof topMeta.finance_offer === "string" ? topMeta.finance_offer : null;

  const pulseTone =
    pulse.level === "HIGH"
      ? "bg-amber-100 border-amber-500 text-amber-950"
      : "bg-paper border-ink text-ink";

  return (
    <WorkspaceShell title="Morning Brief" subtitle="Your pitch intel, ready before the meeting.">
      <div className="space-y-8">
        {/* SECTION 1 — Market Pulse */}
        <div className={`border ${pulseTone} rounded-[10px] px-6 py-4 flex items-center gap-3`}>
          <Target size={16} className="shrink-0" />
          <div className="text-sm md:text-base font-medium leading-snug">
            <span className="capitalize">{pulse.industry}</span> activity is{" "}
            <span className="font-bold">{pulse.level}</span> —{" "}
            <span className="font-bold tabular-nums">{pulse.creativeCount}</span> new creatives —{" "}
            <Link to="/app/advertiser/$domain" params={{ domain: top.brand }} className="font-bold underline-offset-2 hover:underline">
              {top.brand}
            </Link>{" "}
            is most aggressive
          </div>
        </div>

        {/* SECTION 2 — The Incumbent's Play */}
        <div className="card-flat p-8">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left */}
            <div className="space-y-5">
              <div className="mono text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-700 flex items-center gap-2">
                <AlertTriangle size={12} /> The Incumbent's Play
              </div>
              <div>
                <Link to="/app/advertiser/$domain" params={{ domain: top.brand }} className="text-4xl font-bold tracking-tight hover:underline underline-offset-4 inline-block">
                  {top.brand}
                </Link>
                <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
                  {top.industry ?? "—"}
                </div>
              </div>

              {/* Aggression progress */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Aggression</span>
                  <span className="text-sm font-bold tabular-nums">{aggression}/100</span>
                </div>
                <Progress value={aggression} className="h-2" />
              </div>

              {/* Spend gauge */}
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Estimated spend (30d)</span>
                  <span className="text-sm font-bold tabular-nums">{spendLabel(topSpend)}</span>
                </div>
                <Progress value={Math.min(100, (topSpend / Math.max(topSpend, spendScore(advertisers[0]) || 1)) * 100)} className="h-2" />
              </div>

              {/* Sentiment badge */}
              <div className="flex items-center gap-3">
                <span className={`text-[10px] mono uppercase tracking-widest px-2.5 py-1 rounded-full border ${tone.cls}`}>
                  Sentiment · {tone.label} · {topSent.toFixed(0)}
                </span>
                <span
                  className="text-xs text-muted-foreground capitalize"
                  title={`Dominant reaction: ${reaction}`}
                >
                  reaction: {reaction}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Active since</div>
                  <div className="font-medium mt-1">{sinceDate(top.first_seen)}</div>
                </div>
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Last seen</div>
                  <div className="font-medium mt-1">{timeAgo(top.last_seen)}</div>
                </div>
              </div>
            </div>

            {/* Right */}
            <div className="space-y-5">
              {topAd?.image_url ? (
                <AdImage src={topAd.image_url} alt={`${top.brand} latest creative`} />
              ) : (
                <div className="aspect-video bg-paper border border-ink/20 rounded-[8px] grid place-items-center text-xs text-muted-foreground">
                  No creative preview available
                </div>
              )}

              {topThemes.length > 0 && (
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    Themes they own
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topThemes.map((t) => (
                      <span key={t} className="px-3 py-1 border border-ink rounded-full text-xs font-medium capitalize">
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {financeOffer && (
                <div className="bg-amber-100 border border-amber-500 rounded-[8px] px-4 py-3">
                  <div className="mono text-[10px] uppercase tracking-widest text-amber-800 mb-1">Finance offer</div>
                  <div className="text-sm font-semibold text-amber-950">{financeOffer}</div>
                </div>
              )}

              {lowThemes.length > 0 && (
                <div>
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                    What they're NOT saying
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lowThemes.map((t) => (
                      <span
                        key={t}
                        className="px-3 py-1 border border-dashed border-muted-foreground/60 rounded-full text-xs text-muted-foreground capitalize"
                      >
                        {t.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3 — Win Conditions */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">Win conditions</h2>
            <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Counter-angle opportunities
            </span>
          </div>
          {winConditions.length === 0 ? (
            <EmptyState compact />
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {winConditions.map((w, i) => (
                <div key={i} className="card-flat p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Gap {i + 1}
                    </span>
                    <span
                      className={`text-[10px] mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                        w.confidence === "High"
                          ? "border-emerald-600 text-emerald-700 bg-emerald-50"
                          : w.confidence === "Medium"
                            ? "border-amber-500 text-amber-800 bg-amber-50"
                            : "border-muted-foreground text-muted-foreground"
                      }`}
                    >
                      {w.confidence}
                    </span>
                  </div>
                  <div className="text-lg font-bold tracking-tight capitalize">{w.label}</div>
                  <div className="text-sm text-muted-foreground flex-1">{w.rationale}</div>
                  <button className="btn-flat justify-center text-sm">
                    <Plus size={14} /> Add to brief
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {agencyId && (
          <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">
            Tenant · {agencyId.slice(0, 8)}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

function AdImage({ src, alt }: { src: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) {
    return (
      <div className="aspect-video bg-paper border border-ink/20 rounded-[8px] grid place-items-center text-xs text-muted-foreground">
        Creative unavailable
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setOk(false)}
      className="w-full rounded-[8px] border border-ink/20 object-cover aspect-video bg-paper"
    />
  );
}

function EmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`card-flat ${compact ? "p-8" : "p-12"} text-center`}>
      <Inbox size={28} className="mx-auto text-muted-foreground mb-3" />
      <div className="text-base font-semibold tracking-tight">No signal yet</div>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
        The next scan will populate your morning brief. Check back after fresh creatives land.
      </p>
    </div>
  );
}
