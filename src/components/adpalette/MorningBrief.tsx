import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Inbox, Target, TrendingUp } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type PulseResp = {
  total_ads_today?: number;
  new_ads_today?: number;
  most_active_brand_today?: string;
  top_theme_today?: string;
  alerts?: { brand: string; today_sightings: number; yesterday_sightings: number; increase_pct: number }[];
  industries?: { industry: string; ads_today: number; sightings: number; trend: string }[];
};

type BriefAd = {
  id?: number | string;
  image_url?: string | null;
  video_url?: string | null;
  advertiser?: string | null;
  ad_format?: string | null;
  ai_tags?: Record<string, unknown> | null;
  last_seen?: string | null;
};

type BriefResp = {
  industry?: string;
  market_pulse?: {
    activity_level?: string;
    new_ads_72h?: number;
    most_aggressive_brand?: string;
    total_active_brands?: number;
  };
  top_threat?: {
    brand?: string;
    aggression_score?: number;
    dominant_theme?: string | null;
    psychological_angle?: string | null;
    latest_ad?: BriefAd;
  };
  whitespace?: { theme: string; competition_level: string; opportunity_score: number }[];
  win_conditions?: { gap: string; why: string; confidence: string }[];
};

type SovBrand = {
  rank: number;
  brand: string;
  sightings: number;
  ads: number;
  sov_sightings_pct: number;
  composite_sov: number;
};

type SovResp = {
  industry?: string;
  period_days?: number;
  brands?: SovBrand[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

function domainSlug(brand: string): string {
  return brand.toLowerCase().replace(/\s+/g, "") + ".com.au";
}

function fmtNum(n: number | undefined | null): string {
  if (!n || !Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}

const PULSE_TONE: Record<string, string> = {
  high: "bg-amber-100 border-amber-500 text-amber-950",
  moderate: "bg-sky-50 border-sky-500 text-sky-950",
  low: "bg-zinc-50 border-zinc-400 text-zinc-800",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MorningBrief() {
  const [pulse, setPulse] = useState<PulseResp | null>(null);
  const [brief, setBrief] = useState<BriefResp | null>(null);
  const [sov, setSov] = useState<SovResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const [p, b, s] = await Promise.all([
        safeJson<PulseResp>(`${API_BASE}/api/pulse`),
        safeJson<BriefResp>(`${API_BASE}/api/brief/banking`),
        safeJson<SovResp>(`${API_BASE}/api/intelligence/sov-pro/banking`),
      ]);
      if (!alive) return;
      setPulse(p);
      setBrief(b);
      setSov(s);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return (
      <WorkspaceShell title="Morning Brief" subtitle="Your pitch intel, ready before the meeting.">
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading brief…</div>
      </WorkspaceShell>
    );
  }

  const industry = brief?.industry ?? "banking";
  const level = (brief?.market_pulse?.activity_level ?? "moderate").toLowerCase();
  const pulseTone = PULSE_TONE[level] ?? PULSE_TONE.moderate;
  const newToday = pulse?.new_ads_today ?? brief?.market_pulse?.new_ads_72h ?? 0;
  const mostActive = pulse?.most_active_brand_today ?? brief?.market_pulse?.most_aggressive_brand ?? "—";

  const threat = brief?.top_threat;
  const latest = threat?.latest_ad;
  const latestImg = latest?.image_url ?? null;
  const winConditions = (brief?.win_conditions ?? []).slice(0, 3);
  const topSov = (sov?.brands ?? []).slice(0, 6);
  const alerts = (pulse?.alerts ?? []).slice(0, 4);

  return (
    <WorkspaceShell title="Morning Brief" subtitle="Your pitch intel, ready before the meeting.">
      <div className="space-y-8">
        {/* SECTION 1 — Market Pulse */}
        <div className={`border ${pulseTone} rounded-[10px] px-6 py-4 flex items-center gap-3`}>
          <Target size={16} className="shrink-0" />
          <div className="text-sm md:text-base font-medium leading-snug">
            <span className="capitalize">{industry}</span> activity is{" "}
            <span className="font-bold capitalize">{level}</span> —{" "}
            <span className="font-bold tabular-nums">{fmtNum(newToday)}</span> new creatives today —{" "}
            <Link to="/app/advertiser/$domain" params={{ domain: domainSlug(mostActive) }} className="font-bold underline-offset-2 hover:underline">
              {mostActive}
            </Link>{" "}
            is most aggressive
          </div>
        </div>

        {/* SECTION 2 — Top threat hero */}
        {threat?.brand && (
          <div className="card-flat p-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="mono text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-700 flex items-center gap-2">
                  <AlertTriangle size={12} /> The Incumbent's Play
                </div>
                <div>
                  <Link
                    to="/app/advertiser/$domain"
                    params={{ domain: domainSlug(threat.brand) }}
                    className="text-4xl font-bold tracking-tight hover:underline underline-offset-4 inline-block"
                  >
                    {threat.brand}
                  </Link>
                  <div className="mono text-[11px] uppercase tracking-widest text-muted-foreground mt-1">
                    {industry}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Stat label="Aggression score" value={fmtNum(threat.aggression_score)} />
                  <Stat label="Active brands tracked" value={fmtNum(brief?.market_pulse?.total_active_brands)} />
                  <Stat label="New ads (72h)" value={fmtNum(brief?.market_pulse?.new_ads_72h)} />
                  <Stat label="Dominant theme" value={threat.dominant_theme ?? "—"} />
                </div>

                {threat.psychological_angle && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-[8px] px-4 py-3 text-sm">
                    <span className="font-semibold">Angle:</span> {threat.psychological_angle}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {latestImg ? (
                  <img src={latestImg} alt={`${threat.brand} latest creative`} loading="lazy"
                    className="w-full rounded-[8px] border border-ink/20 object-cover aspect-video bg-paper" />
                ) : latest?.video_url ? (
                  <a href={latest.video_url} target="_blank" rel="noreferrer"
                    className="block aspect-video bg-zinc-900 text-white rounded-[8px] grid place-items-center text-sm font-semibold hover:bg-zinc-800">
                    ▶ Watch latest video creative
                  </a>
                ) : (
                  <div className="aspect-video bg-paper border border-ink/20 rounded-[8px] grid place-items-center text-xs text-muted-foreground">
                    No creative preview available
                  </div>
                )}
                {latest?.advertiser && (
                  <div className="text-xs text-muted-foreground">
                    Latest from <span className="font-medium text-foreground">{latest.advertiser}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3 — Win conditions */}
        {winConditions.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Win conditions</h2>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Whitespace opportunities
              </span>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {winConditions.map((w, i) => (
                <div key={i} className="card-flat p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Gap {i + 1}</span>
                    <ConfidenceBadge level={w.confidence} />
                  </div>
                  <div className="text-lg font-bold tracking-tight capitalize">{w.gap}</div>
                  <div className="text-sm text-muted-foreground flex-1">{w.why}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4 — Share of Voice */}
        {topSov.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Share of Voice — {industry}</h2>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Last {sov?.period_days ?? 90} days
              </span>
            </div>
            <div className="card-flat overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-4 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">#</th>
                    <th className="px-4 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">Brand</th>
                    <th className="px-4 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Sightings</th>
                    <th className="px-4 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Ads</th>
                    <th className="px-4 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">SoV</th>
                  </tr>
                </thead>
                <tbody>
                  {topSov.map((b) => (
                    <tr key={b.brand} className="border-t border-zinc-100">
                      <td className="px-4 py-2 mono text-muted-foreground">{b.rank}</td>
                      <td className="px-4 py-2">
                        <Link to="/app/advertiser/$domain" params={{ domain: domainSlug(b.brand) }} className="font-semibold hover:underline">
                          {b.brand}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtNum(b.sightings)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmtNum(b.ads)}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-semibold">{b.sov_sightings_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 5 — Velocity alerts */}
        {alerts.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Brands accelerating today</h2>
              <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">vs yesterday</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {alerts.map((a) => (
                <div key={a.brand} className="card-flat p-4 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-600" />
                    <Link to="/app/advertiser/$domain" params={{ domain: domainSlug(a.brand) }} className="font-semibold hover:underline">
                      {a.brand}
                    </Link>
                  </div>
                  <div className="text-2xl font-bold tabular-nums">+{Math.round(a.increase_pct).toLocaleString()}%</div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {fmtNum(a.today_sightings)} sightings today · {fmtNum(a.yesterday_sightings)} yesterday
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!threat?.brand && winConditions.length === 0 && topSov.length === 0 && (
          <div className="card-flat p-12 text-center">
            <Inbox size={28} className="mx-auto text-muted-foreground mb-3" />
            <div className="text-base font-semibold tracking-tight">No signal yet</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              The next scan will populate your morning brief. Check back after fresh creatives land.
            </p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-semibold mt-1 capitalize">{value}</div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const k = (level ?? "").toLowerCase();
  const cls =
    k === "high" ? "border-emerald-600 text-emerald-700 bg-emerald-50"
      : k === "medium" ? "border-amber-500 text-amber-800 bg-amber-50"
        : "border-muted-foreground text-muted-foreground";
  return (
    <span className={`text-[10px] mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${cls}`}>
      {level || "low"}
    </span>
  );
}
