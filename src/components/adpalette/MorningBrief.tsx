import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Target } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";

const API_BASE = "https://api.revenuad.com";

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
  ai_tags: Record<string, unknown> | string | null;
  advertiser: string | null;
  first_seen: string | null;
  last_seen: string | null;
};

type ThemesResp = {
  messaging_themes?: { theme: string; count: string | number }[];
};

type SovResp = {
  brands?: { brand: string; industry: string; creatives: string; sightings: string; share_pct: string }[];
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

function asTags(raw: Ad["ai_tags"]): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return raw as Record<string, unknown>;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 60000) return "just now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 3600000);
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

function angleFromSentiment(s: string | undefined | null): string {
  const v = (s ?? "").toLowerCase();
  if (v === "urgency" || v === "negative" || v === "fear") return "Fear-based pressure messaging";
  if (v === "positive" || v === "aspirational") return "Aspirational trust play";
  return "Awareness saturation";
}

export function MorningBrief() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [topAd, setTopAd] = useState<Ad | null>(null);
  const [themes, setThemes] = useState<{ theme: string; count: number }[]>([]);
  const [sov, setSov] = useState<SovResp["brands"]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const advRes = await safeJson<{ advertisers: Advertiser[] }>(
        `${API_BASE}/api/advertisers?limit=50`,
      );
      const list = (advRes?.advertisers ?? []).slice().sort(
        (a, b) => Number(b.total_sightings ?? 0) - Number(a.total_sightings ?? 0),
      );
      if (cancelled) return;
      setAdvertisers(list);

      const top = list[0];
      const [adRes, themeRes, sovRes] = await Promise.all([
        top
          ? safeJson<{ ads: Ad[] }>(
              `${API_BASE}/api/ads?limit=10&brand=${encodeURIComponent(top.brand)}`,
            )
          : Promise.resolve(null),
        safeJson<ThemesResp>(`${API_BASE}/api/intelligence/creative-themes`),
        safeJson<SovResp>(`${API_BASE}/api/intelligence/share-of-voice?limit=30`),
      ]);
      if (cancelled) return;

      const ads = adRes?.ads ?? [];
      const withImage = ads.find((a) => a.image_url) ?? ads[0] ?? null;
      setTopAd(withImage);

      const t = (themeRes?.messaging_themes ?? [])
        .map((x) => ({ theme: x.theme, count: Number(x.count) }))
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
    const creativeCount = recent.reduce((s, a) => s + Number(a.ad_count ?? 0), 0);
    const top = advertisers[0];
    const industry = top?.industry ?? "market";
    let level: "HIGH" | "ELEVATED" | "NORMAL" = "NORMAL";
    if (creativeCount > 200) level = "HIGH";
    else if (creativeCount > 80) level = "ELEVATED";
    return { level, creativeCount, top, industry };
  }, [advertisers]);

  const top = pulse.top;
  const topTags = topAd ? asTags(topAd.ai_tags) : {};
  const topThemes = Array.isArray(topTags.themes)
    ? (topTags.themes as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 3)
    : [];
  const dominantTheme = topThemes[0] ?? null;
  const sentiment = typeof topTags.sentiment === "string" ? (topTags.sentiment as string) : null;
  const financeOffer = typeof topTags.finance_offer === "string" ? (topTags.finance_offer as string) : null;

  const lowThemes = useMemo(() => {
    if (themes.length === 0) return [];
    const sorted = themes.slice().sort((a, b) => a.count - b.count);
    return sorted.slice(0, 4).map((t) => t.theme);
  }, [themes]);

  const winConditions = useMemo(() => {
    if (!sov || sov.length === 0) return [];
    const industry = top?.industry;
    const peers = sov.filter((b) => !industry || b.industry === industry);
    const sorted = peers
      .slice()
      .sort((a, b) => Number(a.share_pct) - Number(b.share_pct))
      .slice(0, 3);
    return sorted.map((b, i) => {
      const themeGap = lowThemes[i] ?? "Whitespace narrative";
      const competitorAds = Number(b.creatives ?? 0);
      const confidence = competitorAds < 15 ? "High" : competitorAds < 30 ? "Medium" : "Low";
      return {
        label: themeGap.replace(/_/g, " "),
        rationale:
          competitorAds < 15
            ? `${b.brand} barely touches this theme — clear opening`
            : `${b.brand} only owns ${b.share_pct}% share — exploitable`,
        confidence,
      };
    });
  }, [sov, top, lowThemes]);

  const pulseTone =
    pulse.level === "HIGH"
      ? "bg-amber-100 border-amber-500 text-amber-950"
      : pulse.level === "ELEVATED"
        ? "bg-amber-50 border-amber-300 text-ink"
        : "bg-paper border-ink text-ink";

  return (
    <WorkspaceShell title="Morning Brief" subtitle="Your pitch intel, ready before the meeting.">
      {loading ? (
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading brief…</div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1 — Market Pulse */}
          <div className={`border ${pulseTone} rounded-[10px] px-6 py-4 flex items-center gap-3`}>
            <Target size={16} className="shrink-0" />
            <div className="text-sm md:text-base font-medium leading-snug">
              <span className="capitalize">{pulse.industry}</span> activity is{" "}
              <span className="font-bold">{pulse.level}</span> —{" "}
              <span className="font-bold tabular-nums">{pulse.creativeCount}</span> new creatives in 72hrs —{" "}
              <span className="font-bold">{top?.brand ?? "—"}</span> is most aggressive
            </div>
          </div>

          {/* SECTION 2 — Incumbent's Play */}
          {top && (
            <div className="card-flat p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div className="mono text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-700 flex items-center gap-2">
                    <AlertTriangle size={12} /> Biggest threat
                  </div>
                  <div>
                    <div className="text-4xl font-bold tracking-tight">{top.brand}</div>
                    <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
                      {top.industry ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Aggression Score
                    </div>
                    <div className="text-3xl font-bold tabular-nums">
                      {Math.min(100, Number(top.total_sightings))}
                      <span className="text-base text-muted-foreground font-normal">/100</span>
                    </div>
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
                  {dominantTheme && (
                    <div>
                      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                        Dominant theme
                      </div>
                      <span className="inline-block px-3 py-1 border border-ink rounded-full text-xs font-medium capitalize">
                        {dominantTheme.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                      Psychological angle
                    </div>
                    <div className="text-sm font-medium">{angleFromSentiment(sentiment)}</div>
                  </div>
                </div>

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
                        Top themes
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
          )}

          {/* SECTION 3 — Win Conditions */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Your pitch angle for 2pm</h2>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Win conditions
              </span>
            </div>
            {winConditions.length === 0 ? (
              <div className="card-flat p-8 text-sm text-muted-foreground text-center">
                Not enough whitespace signal yet — check back after the next scan.
              </div>
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
        </div>
      )}
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
