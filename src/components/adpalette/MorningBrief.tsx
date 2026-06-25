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

          {/* SOV table — rows 1-3 normal, 4+ blurred with upsell overlay */}
          {topSov.length > 0 ? (
            <div
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                border: "1px solid #EBE9E4",
                overflow: "hidden",
                position: "relative",
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
                  {topSov.slice(0, 3).map((b) => (
                    <SovRow key={b.brand} brand={b} />
                  ))}
                </tbody>
              </table>
              {topSov.length > 3 && (
                <div style={{ position: "relative" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                      filter: "blur(4px)",
                      userSelect: "none",
                      pointerEvents: "none",
                      opacity: 0.6,
                    }}
                  >
                    <tbody>
                      {topSov.slice(3).map((b) => (
                        <SovRow key={b.brand} brand={b} />
                      ))}
                    </tbody>
                  </table>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(to bottom, rgba(247,246,243,0.6), rgba(247,246,243,0.95))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 20,
                    }}
                  >
                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #EBE9E4",
                        borderLeft: "3px solid #C9963A",
                        borderRadius: 10,
                        padding: "20px 24px",
                        textAlign: "center",
                        maxWidth: 380,
                      }}
                    >
                      <Lock size={18} style={{ color: "#C9963A", margin: "0 auto 8px" }} />
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>
                        See the full picture.
                      </div>
                      <div style={{ fontSize: 13, color: "#6B6B62", lineHeight: 1.5, marginBottom: 14 }}>
                        You're seeing the top 3. Agency Signal shows all competitors, their spend index, and trend direction.
                      </div>
                      <Link
                        to="/"
                        hash="pricing"
                        style={{
                          display: "inline-block",
                          background: "#C9963A",
                          color: "#FFF",
                          borderRadius: 7,
                          padding: "8px 18px",
                          fontSize: 13,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        Upgrade to Agency Signal →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
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
          <SpendLegend />
        </div>

        {/* C — This week's signal (replaces Win Conditions) */}
        <ThisWeeksSignal
          category={category}
          mostActive={mostActive}
          newToday={newToday}
          topTheme={pulse?.top_theme_today ?? null}
          topBrand={topSov[0] ?? null}
          winCondition={winConditions[0] ?? null}
        />


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

// ─── This week's signal ───────────────────────────────────────────────────────

function ThisWeeksSignal({
  category,
  mostActive,
  newToday,
  topTheme,
  topBrand,
  winCondition,
}: {
  category: string;
  mostActive: string;
  newToday: number;
  topTheme: string | null;
  topBrand: SovBrand | null;
  winCondition: { gap: string; why: string; confidence: string } | null;
}) {
  const cards: Array<{
    icon: React.ReactNode;
    label: string;
    title: string;
    stat: string;
    sub: string;
    href: string;
    hrefParams?: { domain: string };
  }> = [];

  if (mostActive && mostActive !== "—") {
    cards.push({
      icon: <TrendingUp size={16} style={{ color: "#C9963A" }} />,
      label: `MOST ACTIVE · ${category.toUpperCase()}`,
      title: properCase(mostActive),
      stat: `${fmtNum(newToday)} new ads this week`,
      sub: topTheme ? `Running ${topTheme} messaging` : "Across multiple channels",
      href: "/app/advertiser/$domain",
      hrefParams: { domain: domainSlug(mostActive) },
    });
  }

  if (topBrand) {
    cards.push({
      icon: <Clock size={16} style={{ color: "#C9963A" }} />,
      label: "ENDURANCE SIGNAL",
      title: properCase(topBrand.brand),
      stat: `${fmtNum(topBrand.ads)} ads in flight`,
      sub: `${fmtNum(topBrand.sightings)} sightings — still going strong`,
      href: "/app/advertiser/$domain",
      hrefParams: { domain: domainSlug(topBrand.brand) },
    });
  }

  if (winCondition) {
    const n = (winCondition.why.match(/\d+/) ?? ["1"])[0];
    const count = parseInt(n, 10) || 1;
    const copy =
      count === 0
        ? `No brand in ${category} is running ${winCondition.gap} messaging. Unclaimed territory.`
        : count === 1
          ? `Only one brand owns ${winCondition.gap} in ${category}. Room to compete — and room to dominate.`
          : `${winCondition.gap} is being used by only ${count} brands in ${category}. Your client could own this message — no one has claimed it yet.`;
    cards.push({
      icon: <Target size={16} style={{ color: "#C9963A" }} />,
      label: "WHITESPACE",
      title: winCondition.gap,
      stat: count === 0 ? "Unclaimed" : `${count} brand${count === 1 ? "" : "s"} using it`,
      sub: copy,
      href: "/app/categories",
    });
  }

  if (!cards.length) return null;

  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", marginBottom: 12, letterSpacing: "-0.01em" }}>
        This week's signal
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {c.icon}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#A07830",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {c.label}
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#1C1C1A", lineHeight: 1.25, textTransform: "capitalize" }}>
              {c.title}
            </div>
            <div style={{ fontSize: 13, color: "#6B6B62" }}>{c.stat}</div>
            <div style={{ fontSize: 12, color: "#9E9D94", lineHeight: 1.5 }}>{c.sub}</div>
            {c.hrefParams ? (
              <Link
                to={c.href}
                params={c.hrefParams}
                style={{ fontSize: 11, color: "#C9963A", marginTop: "auto", textDecoration: "none", fontWeight: 500 }}
              >
                See full signal →
              </Link>
            ) : (
              <Link
                to={c.href}
                style={{ fontSize: 11, color: "#C9963A", marginTop: "auto", textDecoration: "none", fontWeight: 500 }}
              >
                Explore this gap →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
