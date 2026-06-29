import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { AdlibraryCoverageCard } from "@/components/adpalette/AdlibraryCoverageCard";
import { MarketIntelDeepSections } from "@/components/adpalette/MarketIntelDeepSections";
import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import type { ChannelMixResult } from "@/lib/channelMix";
import type { MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import {
  buildProductThemes,
  detectSeasonalTheme,
  normalizeSovRows,
} from "@/lib/marketCampaignThemes";
import {
  radChannelInsight,
  radDataRuleNote,
  radGreeting,
  radHeroKicker,
  radProductHook,
  radSignOff,
  radTemperatureLine,
} from "@/lib/radReportVoice";
import { displayBrand } from "@/utils/brandDisplay";
import type { DataModuleId, PanelFocus } from "./strategist/data-module-types";

const LINEN_CARD: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 12,
  padding: 16,
};

function MiniBar({ pct, color = "#C9963A" }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ height: 8, background: "#F0EDE8", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 4, transition: "width 400ms ease" }} />
    </div>
  );
}

function EvidenceBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#C9963A",
        background: "#FDF6E8",
        border: "1px solid #E8D5A0",
        borderRadius: 999,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      Evidence
    </button>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>{children}</div>
      {action}
    </div>
  );
}

type Props = {
  clientName: string;
  category: string;
  competitorDomains: string[];
  marketTemperature: string | null;
  biggestThreat: string | null;
  biggestOpportunity: string | null;
  recommendedMove: string | null;
  weeklyChanges: { brand: string; movement: string; why: string }[];
  competitorRisers: { brand: string; threatScore: number; label: string }[];
  channelMix: ChannelMixResult;
  channelInsight: string;
  productThemes: ReturnType<typeof buildProductThemes>;
  seasonalTheme: ReturnType<typeof detectSeasonalTheme>;
  whitespaceCards: { title: string; score: number | null; action: string }[];
  recommendedActions: string[];
  confidence: { ads?: number | null; brands?: number | null };
  marketIntel: MarketStrategistIntel | null;
  adlibraryCoverage: AdlibraryCoverage | null;
  onEvidence: (moduleId: DataModuleId, rowIndex?: number, rowLabel?: string) => void;
};

export function MarketIntelReport({
  clientName,
  category,
  competitorDomains,
  marketTemperature,
  biggestThreat,
  biggestOpportunity,
  recommendedMove,
  weeklyChanges,
  competitorRisers,
  channelMix,
  channelInsight,
  productThemes,
  seasonalTheme,
  whitespaceCards,
  recommendedActions,
  confidence,
  marketIntel,
  adlibraryCoverage,
  onEvidence,
}: Props) {
  const [deepOpen, setDeepOpen] = useState(false);
  const displayTitle = /bank/i.test(category) ? "Banking Pulse" : `${category} Pulse`;

  const topChannels = useMemo(() => {
    const active = channelMix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
    return { first: active[0]?.channel ?? "Search", second: active[1]?.channel ?? "Video" };
  }, [channelMix.rows]);

  const storyLine = radProductHook(seasonalTheme?.label ?? null, productThemes[0]?.label ?? null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* R-AD Report masthead — ~20% story */}
      <div
        style={{
          background: "linear-gradient(135deg, #FDF6E8 0%, #FFFFFF 55%)",
          border: "1px solid #E8D5A0",
          borderRadius: 14,
          padding: "18px 20px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A07830" }}>
              {radHeroKicker()}
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 700, color: "#1C1C1A", letterSpacing: "-0.02em" }}>
              {displayTitle}
            </h1>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#6B6B62", maxWidth: 560, lineHeight: 1.55 }}>
              {radGreeting(category)}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9E9D94", fontStyle: "italic" }}>
              {radDataRuleNote()}
            </p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#9E9D94" }}>
            {clientName} · {category}
            {confidence.brands != null && (
              <div style={{ marginTop: 4, color: "#6B6B62" }}>
                {confidence.brands} brands · {confidence.ads?.toLocaleString() ?? "—"} ads indexed
              </div>
            )}
          </div>
        </div>
      </div>

      {competitorDomains.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Watchlist
          </span>
          {competitorDomains.map((d) => (
            <Link
              key={d}
              to="/app/advertiser/$domain"
              params={{ domain: d }}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#1C1C1A",
                background: "#FFFFFF",
                border: "1px solid #EBE9E4",
                borderRadius: 999,
                padding: "4px 12px",
                textDecoration: "none",
              }}
            >
              {displayBrand(d)}
            </Link>
          ))}
        </div>
      )}

      {/* Hero signal cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <HeroCard emoji="🔥" label="Market temperature" value={marketTemperature ?? "Heating up"} note={radTemperatureLine(marketTemperature)} />
        <HeroCard emoji="⚠️" label="Biggest threat" value={biggestThreat ?? "—"} onEvidence={() => onEvidence("threats")} />
        <HeroCard emoji="💡" label="Biggest opportunity" value={biggestOpportunity ?? "—"} onEvidence={() => onEvidence("whitespace")} />
        <HeroCard emoji="🎯" label="Recommended move" value={recommendedMove ?? recommendedActions[0] ?? "—"} onEvidence={() => onEvidence("pitch")} highlight />
      </div>

      {/* 80% data band */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
        {/* Weekly changes */}
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("changes")} />}>What changed this week</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {(weeklyChanges.length ? weeklyChanges : [{ brand: clientName, movement: "Stable", why: "Baseline week — no major shifts in indexed creative." }]).slice(0, 4).map((row) => (
              <div key={row.brand} style={{ background: "#F7F6F3", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{row.brand}</div>
                <div style={{ fontSize: 12, color: "#C9963A", fontWeight: 600, marginTop: 4 }}>{row.movement}</div>
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>{row.why}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor risers + SOV bars */}
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("competitors")} />}>Competitor movements</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {competitorRisers.slice(0, 5).map((row) => (
              <div key={row.brand} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>{row.brand}</span>
                <MiniBar pct={row.threatScore} color={row.threatScore >= 70 ? "#C0392B" : "#C9963A"} />
                <span style={{ fontSize: 11, color: "#9E9D94", minWidth: 72, textAlign: "right" }}>
                  {row.label} · {row.threatScore}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Channel mix — always visible */}
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("channelMix")} />}>Channel mix</SectionLabel>
          <ChannelMixBars
            rows={channelMix.rows}
            overallConfidence={channelMix.overallConfidence}
            sourceLabel={channelMix.sourceLabel}
            estimationTooltip={channelMix.estimationTooltip}
            variant="light"
            animate
          />
          <p style={{ margin: "12px 0 0", fontSize: 13, color: "#6B6B62", fontStyle: "italic" }}>
            {channelInsight || radChannelInsight(topChannels.first, topChannels.second)}
          </p>
        </div>

        {/* Campaign & product themes */}
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("challengers")} />}>
            What they're advertising — grouped by product & theme
          </SectionLabel>
          {seasonalTheme && (
            <div
              style={{
                background: "#FDF6E8",
                border: "1px solid #E8D5A0",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>
                {seasonalTheme.emoji} {seasonalTheme.label}
              </div>
              <p style={{ margin: "6px 0 8px", fontSize: 13, color: "#6B6B62", lineHeight: 1.45 }}>{seasonalTheme.note}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {seasonalTheme.activeBrands.map((b) => (
                  <span key={b} style={{ fontSize: 11, fontWeight: 600, background: "#FFFFFF", border: "1px solid #E8D5A0", borderRadius: 999, padding: "3px 10px" }}>
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6B6B62" }}>{storyLine}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {productThemes.map((theme) => (
              <div key={theme.id} style={{ background: "#F7F6F3", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{theme.label}</span>
                  <span style={{ fontSize: 11, color: "#9E9D94" }}>{theme.ads} ads · {theme.sharePct}%</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <MiniBar pct={theme.sharePct} />
                </div>
                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {theme.brands.map((b) => (
                    <span key={b} style={{ fontSize: 10, color: "#6B6B62", background: "#FFFFFF", borderRadius: 4, padding: "2px 6px" }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* White space */}
      {whitespaceCards.length > 0 && (
        <div>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("whitespace")} />}>White space opportunities</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {whitespaceCards.slice(0, 3).map((card, i) => (
              <button
                key={card.title}
                type="button"
                onClick={() => onEvidence("whitespace", i, card.title)}
                style={{ ...LINEN_CARD, textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A" }}>{card.title}</div>
                {card.score != null && (
                  <div style={{ fontSize: 12, color: "#C9963A", fontWeight: 600, marginTop: 4 }}>Score {card.score}</div>
                )}
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>{card.action}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recommended actions */}
      {recommendedActions.length > 0 && (
        <div>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("strategicActions")} />}>Recommended actions</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recommendedActions.slice(0, 3).map((action, i) => (
              <div
                key={i}
                style={{
                  ...LINEN_CARD,
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  borderColor: i === 0 ? "#E8D5A0" : "#EBE9E4",
                  background: i === 0 ? "#FDF6E8" : "#FFFFFF",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: "#1C1C1A",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <p style={{ margin: 0, fontSize: 14, color: "#1C1C1A", lineHeight: 1.5, fontWeight: i === 0 ? 600 : 500 }}>{action}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: "#9E9D94", fontStyle: "italic" }}>{radSignOff(clientName)}</p>
        </div>
      )}

      {/* Collapsible analyst depth */}
      <div style={{ ...LINEN_CARD, padding: 0, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setDeepOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            color: "#1C1C1A",
          }}
        >
          <span>Supporting evidence — analyst depth</span>
          {deepOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {deepOpen && (
          <div style={{ padding: "0 16px 16px", borderTop: "1px solid #EBE9E4" }}>
            <AdlibraryCoverageCard coverage={adlibraryCoverage} variant="linen" onEvidence={() => onEvidence("adlibrary")} />
            <MarketIntelDeepSections
              intel={marketIntel}
              variant="linen"
              onEvidence={(moduleId, rowIndex, rowLabel) => onEvidence(moduleId, rowIndex, rowLabel)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HeroCard({
  emoji,
  label,
  value,
  note,
  highlight,
  onEvidence,
}: {
  emoji: string;
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
  onEvidence?: () => void;
}) {
  return (
    <div
      style={{
        ...LINEN_CARD,
        background: highlight ? "#FDF6E8" : "#FFFFFF",
        borderColor: highlight ? "#E8D5A0" : "#EBE9E4",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {emoji} {label}
        </span>
        {onEvidence && <EvidenceBtn onClick={onEvidence} />}
      </div>
      <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: "#1C1C1A", lineHeight: 1.35 }}>{value}</div>
      {note && <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>{note}</p>}
    </div>
  );
}

export function buildCompetitorRisers(
  threats: { competitor_domain?: string | null; threat_score?: number | null; creative_volume?: number | null }[],
  momentum: { brand_domain?: string | null; momentum?: string | null }[],
): { brand: string; threatScore: number; label: string }[] {
  const rows = threats.map((t) => ({
    brand: displayBrand(t.competitor_domain ?? ""),
    sov: Number(t.threat_score ?? t.creative_volume ?? 0),
  }));
  const normalized = normalizeSovRows(rows.map((r) => ({ brand: r.brand, sov: r.sov })));
  const labelByBrand = new Map<string, string>();
  for (const m of momentum) {
    const b = displayBrand(m.brand_domain ?? "");
    if ((m.momentum ?? "").toLowerCase().includes("ris")) labelByBrand.set(b, "Rising");
  }
  return normalized.map((r) => ({
    brand: r.brand,
    threatScore: Math.round(r.sov),
    label: labelByBrand.get(r.brand) ?? "Tracked",
  }));
}

export function buildWeeklyChanges(
  dailyChanges: MarketStrategistIntel["dailyChanges"],
  clientName: string,
): { brand: string; movement: string; why: string }[] {
  if (!dailyChanges?.length) return [];
  return dailyChanges.slice(0, 4).map((row) => ({
    brand: displayBrand(row.brandDomain),
    movement: [row.marketChange, row.momentum].filter(Boolean).join(" · ") || "Shift detected",
    why: row.pressure
      ? `Pressure building on ${row.pressure.toLowerCase()} messaging.`
      : "Indexed creative volume moved vs last week.",
  }));
}
