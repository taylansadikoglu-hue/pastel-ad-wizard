import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Lock, TrendingUp, TrendingDown, Minus, Search, Grid3x3, FileText } from "lucide-react";
import { WorkspaceShell } from "./WorkspaceShell";

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

const CATEGORIES = [
  { key: "Banking", label: "General Banking", slug: "banking" },
  { key: "Auto", label: "Automotive", slug: "automotive" },
  { key: "Telco", label: "Telco", slug: "telco" },
  { key: "Health", label: "Health Insurance", slug: "health_insurance" },
  { key: "Retail", label: "Retail", slug: "retail" },
] as const;
type Category = typeof CATEGORIES[number]["key"];

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

const BRAND_CASE: Record<string, string> = {
  commbank: "CommBank", commonwealthbank: "CommBank", anz: "ANZ",
  westpac: "Westpac", nab: "NAB", macquarie: "Macquarie",
  "newcastle permanent": "Newcastle Permanent", newcastlepermanent: "Newcastle Permanent",
  suncorp: "Suncorp", ing: "ING", "me bank": "ME Bank", mebank: "ME Bank",
  bendigo: "Bendigo Bank", bankwest: "Bankwest", ubank: "UBank",
  stgeorge: "St.George", bom: "Bank of Melbourne",
};

function properCase(raw: string): string {
  if (!raw) return raw;
  const key = raw.toLowerCase().trim();
  if (BRAND_CASE[key]) return BRAND_CASE[key];
  return raw.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function todayString(): string {
  return new Date().toLocaleDateString("en-AU", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
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
      setPulse(p); setBrief(b); setSov(s); setLoading(false);
    })();
    return () => { alive = false; };
  }, [category]);

  const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? category;

  if (loading) {
    return (
      <WorkspaceShell title="">
        <PageHeader category={category} setCategory={setCategory} />
        <div style={loadingStyle}>Reading signal…</div>
      </WorkspaceShell>
    );
  }

  const newToday = pulse?.new_ads_today ?? brief?.market_pulse?.new_ads_72h ?? 0;
  const mostActive = pulse?.most_active_brand_today ?? brief?.market_pulse?.most_aggressive_brand ?? "";
  const topTheme = pulse?.top_theme_today ?? "";
  const level = (brief?.market_pulse?.activity_level ?? "moderate").toLowerCase();
  const brands = sov?.brands ?? [];
  const totalBrands = brief?.market_pulse?.total_active_brands ?? brands.length;
  const alerts = (pulse?.alerts ?? []);
  const winConditions = (brief?.win_conditions ?? []).slice(0, 4);

  // Synthesize threats from SOV + alerts
  const strongest = brands[0];
  const strategic = brands[1];
  const emerging = alerts.sort((a, b) => b.increase_pct - a.increase_pct)[0];

  return (
    <WorkspaceShell title="">
      <PageHeader category={category} setCategory={setCategory} />

      {/* Data notice */}
      <div style={{
        background: "#FDF6E8", borderLeft: "2px solid #C9963A", borderRadius: 6,
        padding: "10px 14px", fontSize: 12, color: "#6B6B62", marginBottom: 32, lineHeight: 1.5,
      }}>
        R-AD began tracking Australian advertising from June 2026. All signal reflects current market activity from that date.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

        {/* SECTION 1 — HERO */}
        <HeroInsight
          categoryLabel={categoryLabel}
          mostActive={mostActive}
          topTheme={topTheme}
          level={level}
          newToday={newToday}
          totalBrands={totalBrands}
          alertsCount={alerts.length}
        />

        {/* SECTION 2 — THREATS */}
        <ThreatsSection
          strongest={strongest}
          emerging={emerging}
          strategic={strategic}
          topTheme={topTheme}
          categoryLabel={categoryLabel}
        />

        {/* SECTION 3 — SOV TABLE */}
        <SovSection brands={brands} categoryLabel={categoryLabel} periodDays={sov?.period_days ?? 90} />

        {/* SECTION 4 — WHITESPACE */}
        <WhitespaceSection winConditions={winConditions} categoryLabel={categoryLabel} />

        {/* SECTION 5 — MOMENTUM */}
        {alerts.length > 0 && <MomentumSection alerts={alerts.slice(0, 6)} />}

        {/* SECTION 6 — WHERE TO NEXT */}
        <WhereToNext />
      </div>
    </WorkspaceShell>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({ category, setCategory }: { category: Category; setCategory: (c: Category) => void }) {
  return (
    <header style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      marginBottom: 16, flexWrap: "wrap", gap: 16,
    }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.01em", margin: 0 }}>
          Morning signal
        </h1>
        <div style={{ fontSize: 13, color: "#9E9D94", marginTop: 4 }}>{todayString()}</div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {CATEGORIES.map((c) => {
          const active = c.key === category;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              onMouseEnter={(e) => { if (!active) (e.currentTarget.style.background = "#F0EDE8"); }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget.style.background = "transparent"); }}
              style={{
                padding: "4px 14px", borderRadius: 4, fontSize: 13, fontWeight: 500,
                border: "none", cursor: "pointer",
                background: active ? "#1C1C1A" : "transparent",
                color: active ? "#FFFFFF" : "#9E9D94",
                transition: "background 120ms, color 120ms",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroInsight({
  categoryLabel, mostActive, topTheme, level, newToday, totalBrands, alertsCount,
}: {
  categoryLabel: string; mostActive: string; topTheme: string; level: string;
  newToday: number; totalBrands: number; alertsCount: number;
}) {
  const headline = mostActive
    ? `${properCase(mostActive)} is leading the ${categoryLabel} narrative`
    : `${categoryLabel} activity is ${level}`;
  const paragraph = mostActive
    ? `${properCase(mostActive)} is the most aggressive advertiser this week with the highest sighting velocity.${topTheme ? ` Messaging is anchored on ${topTheme}.` : ""} The rest of the category is reacting, not setting the pace.`
    : `${fmtNum(newToday)} new creatives have entered the market this week. Several brands are quietly shifting positioning — worth a closer read before your next pitch.`;
  const action = mostActive
    ? `Open ${properCase(mostActive)}'s war room and identify the two themes their competitors haven't matched yet.`
    : `Review the whitespace section below — gaps in this category are still wide open.`;

  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 12,
      padding: "32px 36px",
      display: "grid", gridTemplateColumns: "3fr 2fr", gap: 32,
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#A07830", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
          Today's signal
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>
          {headline}
        </h2>
        <p style={{ fontSize: 15, color: "#6B6B62", lineHeight: 1.6, marginTop: 14 }}>{paragraph}</p>
        <div style={{
          background: "#FDF6E8", borderLeft: "2px solid #C9963A", borderRadius: 6,
          padding: "14px 18px", marginTop: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#A07830", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
            Recommended action
          </div>
          <div style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.5 }}>{action}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
        <HeroStat label="Brands tracked" value={fmtNum(totalBrands)} />
        <HeroStat label="New creatives this week" value={fmtNum(newToday)} divider />
        <HeroStat label="Coverage" value={`${Math.min(100, Math.round(((alertsCount + totalBrands) / Math.max(totalBrands, 1)) * 100))}%`} divider />
      </div>
    </div>
  );
}

function HeroStat({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <div style={{
      padding: "16px 0",
      borderTop: divider ? "1px solid #F0EDE8" : "none",
    }}>
      <div style={{ fontSize: 11, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

// ─── Threats ──────────────────────────────────────────────────────────────────

function ThreatsSection({ strongest, emerging, strategic, topTheme, categoryLabel }: {
  strongest?: SovBrand;
  emerging?: { brand: string; today_sightings: number; increase_pct: number };
  strategic?: SovBrand;
  topTheme: string;
  categoryLabel: string;
}) {
  type T = {
    kind: "strongest" | "emerging" | "strategic";
    brand: string;
    score: number;
    demand: number | string;
    creative: number | string;
    trend: "Rising" | "Stable" | "Falling";
    insight: string;
  };
  const threats: T[] = [];
  if (strongest) threats.push({
    kind: "strongest", brand: strongest.brand,
    score: Math.min(99, Math.round(60 + strongest.sov_sightings_pct * 0.8)),
    demand: fmtNum(strongest.sightings), creative: fmtNum(strongest.ads),
    trend: "Rising",
    insight: `Holds ${strongest.sov_sightings_pct.toFixed(1)}% share of voice in ${categoryLabel}.`,
  });
  if (emerging) threats.push({
    kind: "emerging", brand: emerging.brand,
    score: Math.min(99, Math.round(40 + Math.min(emerging.increase_pct, 50))),
    demand: fmtNum(emerging.today_sightings), creative: `+${Math.round(emerging.increase_pct)}%`,
    trend: "Rising",
    insight: `Accelerating fast — sightings up ${Math.round(emerging.increase_pct)}% vs yesterday.`,
  });
  if (strategic) threats.push({
    kind: "strategic", brand: strategic.brand,
    score: Math.min(99, Math.round(45 + strategic.sov_sightings_pct * 0.6)),
    demand: fmtNum(strategic.sightings), creative: fmtNum(strategic.ads),
    trend: "Stable",
    insight: topTheme ? `Quiet but consistent on ${topTheme} messaging.` : `Defending position with steady output.`,
  });
  if (threats.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Competitive threats" pill="LIVE" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {threats.map((t) => <ThreatCard key={t.kind} t={t} />)}
      </div>
    </section>
  );
}

function ThreatCard({ t }: { t: { kind: "strongest" | "emerging" | "strategic"; brand: string; score: number; demand: number | string; creative: number | string; trend: "Rising" | "Stable" | "Falling"; insight: string } }) {
  const badge = {
    strongest: { label: "Strongest", bg: "#FFF0EE", color: "#C0392B" },
    emerging: { label: "Emerging", bg: "#FDF6E8", color: "#A07830" },
    strategic: { label: "Strategic", bg: "#F0F9F4", color: "#2D7D46" },
  }[t.kind];
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10,
      padding: 24, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{
          background: badge.bg, color: badge.color,
          fontSize: 10, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 4,
        }}>{badge.label}</span>
        <div style={{ fontSize: 22, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
          {t.score}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", textTransform: "capitalize" }}>
        {properCase(t.brand)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Stat label="Demand" value={String(t.demand)} />
        <Stat label="Creative" value={String(t.creative)} />
      </div>
      <TrendBadge trend={t.trend} />
      <div style={{ fontSize: 13, color: "#6B6B62", fontStyle: "italic", lineHeight: 1.5 }}>{t.insight}</div>
      <Link
        to="/app/advertiser/$domain"
        params={{ domain: domainSlug(t.brand) }}
        style={{ fontSize: 12, color: "#C9963A", fontWeight: 500, textDecoration: "none", marginTop: "auto" }}
      >
        Open war room →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: "Rising" | "Stable" | "Falling" }) {
  const map = {
    Rising: { Icon: TrendingUp, color: "#2D7D46", bg: "#F0F9F4" },
    Stable: { Icon: Minus, color: "#6B6B62", bg: "#F0EDE8" },
    Falling: { Icon: TrendingDown, color: "#C0392B", bg: "#FFF0EE" },
  } as const;
  const { Icon, color, bg } = map[trend];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: bg, color, fontSize: 11, fontWeight: 600,
      padding: "3px 8px", borderRadius: 4, alignSelf: "flex-start",
    }}>
      <Icon size={11} /> {trend}
    </div>
  );
}

// ─── SOV ──────────────────────────────────────────────────────────────────────

function SovSection({ brands, categoryLabel, periodDays }: { brands: SovBrand[]; categoryLabel: string; periodDays: number }) {
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.01em", margin: 0 }}>
          Share of voice · {categoryLabel}
        </h2>
        <span style={{ fontSize: 10, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.18em" }}>
          Last {periodDays} days
        </span>
      </div>
      {brands.length === 0 ? (
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: 36, textAlign: "center", color: "#6B6B62", fontSize: 14 }}>
          Signal incoming for {categoryLabel}.
        </div>
      ) : (
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, overflow: "hidden", position: "relative" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#F7F6F3" }}>
                <th style={thStyle}>#</th>
                <th style={thStyle}>Brand</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Sightings</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ads</th>
                <th style={{ ...thStyle, textAlign: "right" }}>SOV %</th>
              </tr>
            </thead>
            <tbody>
              {brands.slice(0, 3).map((b) => <SovRow key={b.brand} brand={b} />)}
            </tbody>
          </table>
          {brands.length > 3 && (
            <div style={{ position: "relative" }}>
              <table style={{
                width: "100%", borderCollapse: "collapse", fontSize: 14,
                filter: "blur(5px)", userSelect: "none", pointerEvents: "none", opacity: 0.5,
              }}>
                <tbody>{brands.slice(3).map((b) => <SovRow key={b.brand} brand={b} />)}</tbody>
              </table>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
              }}>
                <div style={{
                  background: "#FFFFFF", border: "1px solid #EBE9E4", borderLeft: "3px solid #C9963A",
                  borderRadius: 10, padding: 24, textAlign: "center", maxWidth: 420,
                }}>
                  <Lock size={18} style={{ color: "#C9963A", margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>
                    See who's ranked 4th and beyond.
                  </div>
                  <div style={{ fontSize: 13, color: "#6B6B62", marginBottom: 14, lineHeight: 1.5 }}>
                    Agency Signal shows the full leaderboard.
                  </div>
                  <a href="/#pricing" style={{
                    display: "inline-block", background: "#C9963A", color: "#FFF",
                    borderRadius: 7, padding: "9px 20px", fontSize: 13, fontWeight: 500, textDecoration: "none",
                  }}>
                    Upgrade to Agency Signal →
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#9E9D94",
  textTransform: "uppercase", letterSpacing: "0.12em",
  textAlign: "left", padding: "12px 20px",
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
        background: hover ? "#F7F6F3" : "transparent",
        borderLeft: isTop ? "3px solid #C9963A" : "3px solid transparent",
        transition: "background 100ms",
      }}
    >
      <td style={tdStyle}><span style={{ color: isTop ? "#C9963A" : "#9E9D94", fontWeight: isTop ? 600 : 400 }}>{brand.rank}</span></td>
      <td style={tdStyle}>
        <Link to="/app/advertiser/$domain" params={{ domain: domainSlug(brand.brand) }}
          style={{ fontWeight: 600, color: "#1C1C1A", textDecoration: "none" }}>
          {properCase(brand.brand)}
        </Link>
      </td>
      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(brand.sightings)}</td>
      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(brand.ads)}</td>
      <td style={{ ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, letterSpacing: "-0.02em" }}>{brand.sov_sightings_pct.toFixed(1)}%</td>
    </tr>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "14px 20px", fontSize: 14, color: "#1C1C1A",
  borderTop: "1px solid #F2F0EB",
};

// ─── Whitespace ───────────────────────────────────────────────────────────────

function WhitespaceSection({ winConditions, categoryLabel }: {
  winConditions: { gap: string; why: string; confidence: string }[]; categoryLabel: string;
}) {
  if (winConditions.length === 0) return null;
  return (
    <section>
      <SectionHeader title="Whitespace opportunities" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {winConditions.slice(0, 4).map((w, i) => {
          const n = parseInt((w.why.match(/\d+/) ?? ["1"])[0], 10) || 1;
          const status = n <= 1 ? "Emerging" : "Competitive";
          const statusStyle = status === "Emerging"
            ? { bg: "#F0F9F4", color: "#2D7D46" }
            : { bg: "#F0EDE8", color: "#9E9D94" };
          const body = n === 0
            ? `No brand in ${categoryLabel} is running this messaging — unclaimed.`
            : n === 1
              ? `Only one brand owns this in ${categoryLabel}. Room to compete.`
              : `${n} brands using it in ${categoryLabel}.`;
          return (
            <div key={i} style={{
              background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10,
              padding: 20, display: "flex", flexDirection: "column", gap: 8, position: "relative",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A", textTransform: "capitalize", lineHeight: 1.3 }}>
                  {w.gap}
                </div>
                <span style={{
                  background: statusStyle.bg, color: statusStyle.color,
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: "0.1em", padding: "3px 8px", borderRadius: 4, flexShrink: 0,
                }}>{status}</span>
              </div>
              <div style={{ fontSize: 13, color: "#6B6B62", lineHeight: 1.5 }}>{body}</div>
              <div style={{ fontSize: 11, color: "#C4C2BA", marginTop: "auto", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Confidence · {w.confidence}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Momentum ─────────────────────────────────────────────────────────────────

function MomentumSection({ alerts }: { alerts: { brand: string; today_sightings: number; yesterday_sightings: number; increase_pct: number }[] }) {
  return (
    <section>
      <SectionHeader title="Momentum watchlist" />
      <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, overflow: "hidden" }}>
        {alerts.map((a, i) => {
          const trend: "Rising" | "Stable" | "Falling" =
            a.increase_pct > 5 ? "Rising" : a.increase_pct < -5 ? "Falling" : "Stable";
          const last = i === alerts.length - 1;
          return (
            <div key={a.brand} style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto",
              gap: 16, alignItems: "center",
              padding: "16px 24px",
              borderBottom: last ? "none" : "1px solid #F0EDE8",
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#1C1C1A" }}>{properCase(a.brand)}</div>
                <div style={{ fontSize: 11, color: "#9E9D94", marginTop: 2 }}>{domainSlug(a.brand)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em" }}>Interest</div>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(Math.abs(a.increase_pct))}
                </div>
              </div>
              <div><TrendBadge trend={trend} /></div>
              <Link to="/app/advertiser/$domain" params={{ domain: domainSlug(a.brand) }}
                style={{ fontSize: 13, color: "#C9963A", fontWeight: 500, textDecoration: "none" }}>
                Open →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Where to next ────────────────────────────────────────────────────────────

function WhereToNext() {
  const cards = [
    { Icon: Search, title: "Look up a competitor", body: "Search any brand by name or domain.", to: "/app/advertisers" as const },
    { Icon: Grid3x3, title: "Browse by category", body: "See which brands own each market.", to: "/app/categories" as const },
    { Icon: FileText, title: "Generate a pitch brief", body: "Turn signal into a client-ready brief.", to: "/app/advertisers" as const },
  ];
  return (
    <section style={{
      background: "#F7F6F3", border: "1px solid #EBE9E4", borderRadius: 10,
      padding: 24,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginBottom: 14 }}>Where to next?</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {cards.map((c) => (
          <Link
            key={c.title}
            to={c.to}
            style={{
              background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 8,
              padding: 18, textDecoration: "none",
              display: "flex", flexDirection: "column", gap: 6,
              transition: "border-color 120ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9963A")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#EBE9E4")}
          >
            <c.Icon size={18} style={{ color: "#C9963A" }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1C1C1A" }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#9E9D94", lineHeight: 1.5 }}>{c.body}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionHeader({ title, pill }: { title: string; pill?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A", letterSpacing: "-0.01em", margin: 0 }}>{title}</h2>
      {pill && (
        <span style={{
          background: "#1C1C1A", color: "#FFFFFF",
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
          letterSpacing: "0.1em",
        }}>{pill}</span>
      )}
    </div>
  );
}

const loadingStyle: React.CSSProperties = {
  background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10,
  padding: 48, textAlign: "center", color: "#6B6B62", fontSize: 14,
};
