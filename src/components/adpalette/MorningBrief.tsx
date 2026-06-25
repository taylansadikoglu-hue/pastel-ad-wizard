import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Inbox, TrendingUp, Clock, Target, Lock } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";
import { SpendLegend } from "./SpendIndex";

const API_BASE = "https://api.revenuad.com";

// ─── Types ────────────────────────────────────────────────────────────────────

type PulseResp = {
  total_ads_today?: number;
  new_ads_today?: number;
  most_active_brand_today?: string;
  top_theme_today?: string;
  alerts?: { brand: string; today_sightings: number; yesterday_sightings: number; increase_pct: number }[];
};

type BriefResp = {
  industry?: string;
  market_pulse?: {
    activity_level?: string;
    new_ads_72h?: number;
    most_aggressive_brand?: string;
    total_active_brands?: number;
  };
  win_conditions?: { gap: string; why: string; confidence: string }[];
};

type SovBrand = {
  rank: number;
  brand: string;
  sightings: number;
  ads: number;
  sov_sightings_pct: number;
};

type SovResp = {
  industry?: string;
  period_days?: number;
  brands?: SovBrand[];
};

const CATEGORIES = ["Banking", "Auto", "Telco", "Retail", "Health"] as const;
type Category = typeof CATEGORIES[number];

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

// Proper-case brand normalisation — known acronyms and brand spellings.
const BRAND_CASE: Record<string, string> = {
  commbank: "CommBank",
  commonwealthbank: "CommBank",
  anz: "ANZ",
  westpac: "Westpac",
  nab: "NAB",
  macquarie: "Macquarie",
  "newcastle permanent": "Newcastle Permanent",
  newcastlepermanent: "Newcastle Permanent",
  suncorp: "Suncorp",
  ing: "ING",
  "me bank": "ME Bank",
  mebank: "ME Bank",
  bendigo: "Bendigo Bank",
  bankwest: "Bankwest",
  ubank: "UBank",
  stgeorge: "St.George",
  bom: "Bank of Melbourne",
};

function properCase(raw: string): string {
  if (!raw) return raw;
  const key = raw.toLowerCase().trim();
  if (BRAND_CASE[key]) return BRAND_CASE[key];
  // Title-case fallback
  return raw
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w === w.toLowerCase() === false ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MorningBrief() {
  const [pulse, setPulse] = useState<PulseResp | null>(null);
  const [brief, setBrief] = useState<BriefResp | null>(null);
  const [sov, setSov] = useState<SovResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("Banking");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const slug = category.toLowerCase();
    (async () => {
      const [p, b, s] = await Promise.all([
        safeJson<PulseResp>(`${API_BASE}/api/pulse`),
        safeJson<BriefResp>(`${API_BASE}/api/brief/${slug}`),
        safeJson<SovResp>(`${API_BASE}/api/intelligence/sov-pro/${slug}`),
      ]);
      if (!alive) return;
      setPulse(p);
      setBrief(b);
      setSov(s);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [category]);

  if (loading) {
    return (
      <WorkspaceShell title="Morning signal" subtitle="Your pitch intel, ready before the meeting.">
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Reading signal…</div>
      </WorkspaceShell>
    );
  }

  const industry = brief?.industry ?? category.toLowerCase();
  const level = (brief?.market_pulse?.activity_level ?? "moderate").toLowerCase();
  const newToday = pulse?.new_ads_today ?? brief?.market_pulse?.new_ads_72h ?? 0;
  const mostActive = pulse?.most_active_brand_today ?? brief?.market_pulse?.most_aggressive_brand ?? "—";

  const winConditions = (brief?.win_conditions ?? []).slice(0, 3);
  const topSov = (sov?.brands ?? []).slice(0, 10);
  const alerts = (pulse?.alerts ?? []).slice(0, 4);

  return (
    <WorkspaceShell title="Morning signal" subtitle="Your pitch intel, ready before the meeting.">
      <div className="space-y-8">
        {/* A — Gold alert banner */}
        <div
          style={{
            background: "#FDF6E8",
            borderLeft: "3px solid #C9963A",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 13,
            color: "#1C1C1A",
            lineHeight: 1.5,
          }}
        >
          <span style={{ textTransform: "capitalize" }}>{industry}</span> activity is{" "}
          <strong style={{ textTransform: "capitalize" }}>{level}</strong> ·{" "}
          <strong>{fmtNum(newToday)}</strong> new creatives today ·{" "}
          <Link
            to="/app/advertiser/$domain"
            params={{ domain: domainSlug(mostActive) }}
            style={{ fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            {properCase(mostActive)}
          </Link>{" "}
          is most aggressive
        </div>

        {/* B — Share of voice */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.01em" }}>
              Share of voice
            </h2>
            <span style={{ fontSize: 10, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Last {sov?.period_days ?? 90} days
            </span>
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    background: active ? "#1C1C1A" : "transparent",
                    color: active ? "#FFFFFF" : "#6B6B62",
                    transition: "background 120ms, color 120ms",
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* SOV table */}
          {topSov.length > 0 ? (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                border: "1px solid #EBE9E4",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "transparent" }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Brand</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Sightings</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>SOV %</th>
                  </tr>
                </thead>
                <tbody>
                  {topSov.map((b) => (
                    <SovRow key={b.brand} brand={b} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div
              style={{
                background: "#FFFFFF",
                border: "1px solid #EBE9E4",
                borderRadius: 10,
                padding: 32,
                textAlign: "center",
                color: "#6B6B62",
                fontSize: 13,
              }}
            >
              Signal incoming for {category}. R-AD is on it.
            </div>
          )}
        </div>

        {/* C — Win conditions */}
        {winConditions.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", marginBottom: 12, letterSpacing: "-0.01em" }}>
              Win conditions
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {winConditions.map((w, i) => (
                <div
                  key={i}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #EBE9E4",
                    borderRadius: 10,
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      alignSelf: "flex-start",
                      background: "#FDF6E8",
                      border: "1px solid #E8D5A0",
                      color: "#A07830",
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      padding: "2px 10px",
                      borderRadius: 999,
                    }}
                  >
                    Opportunity
                  </span>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "#1C1C1A",
                      textTransform: "capitalize",
                      lineHeight: 1.3,
                    }}
                  >
                    {w.gap}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 400, color: "#6B6B62", lineHeight: 1.5 }}>
                    {w.why}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Velocity alerts (kept — purely numeric, no $) */}
        {alerts.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", marginBottom: 12, letterSpacing: "-0.01em" }}>
              Brands accelerating today
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {alerts.map((a) => (
                <div
                  key={a.brand}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #EBE9E4",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <TrendingUp size={14} style={{ color: "#0F8A4F" }} />
                    <Link
                      to="/app/advertiser/$domain"
                      params={{ domain: domainSlug(a.brand) }}
                      style={{ fontWeight: 600, fontSize: 13, color: "#1C1C1A" }}
                    >
                      {properCase(a.brand)}
                    </Link>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#1C1C1A" }}>
                    +{Math.round(a.increase_pct).toLocaleString()}%
                  </div>
                  <div style={{ fontSize: 11, color: "#6B6B62", marginTop: 2 }}>
                    {fmtNum(a.today_sightings)} today · {fmtNum(a.yesterday_sightings)} yesterday
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {winConditions.length === 0 && topSov.length === 0 && (
          <div className="card-flat p-12 text-center">
            <Inbox size={28} className="mx-auto text-muted-foreground mb-3" />
            <div className="text-base font-semibold tracking-tight">R-AD is on it.</div>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              We're reading the signal. First results land within 24 hours.
            </p>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#9E9D94",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  textAlign: "left",
  padding: "10px 16px",
  borderBottom: "1px solid #EBE9E4",
};

function SovRow({ brand }: { brand: SovBrand }) {
  const [hover, setHover] = useState(false);
  const isTop = brand.rank === 1;
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? "#F0EDE8" : "transparent",
        borderLeft: isTop ? "2px solid #C9963A" : "2px solid transparent",
        transition: "background 100ms",
      }}
    >
      <td style={tdStyle}>
        <span style={{ color: isTop ? "#C9963A" : "#9E9D94", fontWeight: isTop ? 600 : 400 }}>
          {brand.rank}
        </span>
      </td>
      <td style={tdStyle}>
        <Link
          to="/app/advertiser/$domain"
          params={{ domain: domainSlug(brand.brand) }}
          style={{ fontWeight: 600, color: "#1C1C1A", textDecoration: "none" }}
        >
          {properCase(brand.brand)}
        </Link>
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fmtNum(brand.sightings)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {fmtNum(brand.ads)}
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
        {brand.sov_sightings_pct.toFixed(1)}%
      </td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 13,
  color: "#1C1C1A",
  borderTop: "1px solid #F2F0EB",
};
