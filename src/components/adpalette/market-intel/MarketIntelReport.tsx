import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { AdlibraryCoverageCard } from "@/components/adpalette/AdlibraryCoverageCard";
import { MarketIntelDeepSections } from "@/components/adpalette/MarketIntelDeepSections";
import { Sparkline } from "@/components/adpalette/strategist/Sparkline";
import type { AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import type { ChannelMixResult } from "@/lib/channelMix";
import type { MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import { detectSeasonalTheme } from "@/lib/marketCampaignThemes";
import {
  type CategoryKpis,
  type EnrichedBrandChange,
  type EnrichedCompetitor,
  type EnrichedProductTheme,
  type HeroPulse,
  type PeriodDeltas,
  formatDelta,
} from "@/lib/marketPulseMetrics";
import {
  radCompetitorBite,
  radDataRuleNote,
  radGreeting,
  radHeroKicker,
  radProductBite,
  radTemperatureBite,
  radWeeklyBite,
  radWhitespaceBite,
} from "@/lib/radReportVoice";
import { displayBrand } from "@/utils/brandDisplay";
import { dedupeActions, shortActionHeadline } from "@/lib/dataTrust";
import { DataProvenanceBar } from "@/components/adpalette/DataProvenanceBar";
import type { DataModuleId } from "@/components/adpalette/strategist/data-module-types";
import type { MarketIntelSectionId } from "@/lib/dashboardViewPrefs";

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

function RadBite({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: "10px 0 0",
        padding: "8px 12px",
        fontSize: 12,
        color: "#6B6B62",
        lineHeight: 1.45,
        background: "#FDF6E8",
        borderLeft: "3px solid #C9963A",
        borderRadius: "0 8px 8px 0",
      }}
    >
      <span style={{ fontWeight: 600, color: "#A07830" }}>R-AD · </span>
      {children}
    </p>
  );
}

function DeltaChip({ label, value, compact }: { label: string; value: number; compact?: boolean }) {
  const positive = value > 0;
  const negative = value < 0;
  const color = positive ? "#1E7A4C" : negative ? "#C0392B" : "#6B6B62";
  const bg = positive ? "#E8F5EE" : negative ? "#FDECEA" : "#F0EDE8";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color,
        background: bg,
        borderRadius: 6,
        padding: compact ? "2px 6px" : "3px 8px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span style={{ color: "#9E9D94", fontWeight: 500 }}>{label}</span>
      {formatDelta(value)}
    </span>
  );
}

function DeltaRow({ deltas, compact }: { deltas: PeriodDeltas; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: compact ? 4 : 6 }}>
      <DeltaChip label="WoW" value={deltas.wow} compact={compact} />
      <DeltaChip label="MoM" value={deltas.mom} compact={compact} />
      <DeltaChip label="YoY" value={deltas.yoy} compact={compact} />
    </div>
  );
}

function KpiTile({
  label,
  value,
  suffix,
  deltas,
  sparkline,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  deltas?: PeriodDeltas;
  sparkline?: number[];
}) {
  return (
    <div style={{ ...LINEN_CARD, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: "#1C1C1A", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
          {suffix && <span style={{ fontSize: 16, fontWeight: 600, color: "#9E9D94", marginLeft: 2 }}>{suffix}</span>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline values={sparkline} stroke="#C9963A" width={72} height={24} />
        )}
      </div>
      {deltas && <DeltaRow deltas={deltas} compact />}
    </div>
  );
}

function isActionQuality(text: string): boolean {
  const s = text.trim();
  if (s.length < 48) return false;
  if (/^(protect|counter|defend)\s+(against\s+)?[a-z0-9.-]+\.?$/i.test(s)) return false;
  if (/^(n\/a|na|none|—|tbd|todo)$/i.test(s)) return false;
  if (/valueless/i.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  return words.length >= 8;
}

function curateRecommendedActions(input: {
  recommendedActions: string[];
  topChannel: string;
  underWeightedChannel: string;
  topProduct: string | null;
  biggestThreat: string | null;
  whitespace: { title: string; action: string }[];
}): string[] {
  const cleaned = (input.recommendedActions ?? [])
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .filter(isActionQuality);

  if (cleaned.length >= 2) return cleaned.slice(0, 3);

  const ideas: string[] = [];
  if (input.whitespace[0]?.title && input.whitespace[0]?.action) {
    ideas.push(`${input.whitespace[0].action} (${input.whitespace[0].title}).`);
  }
  if (input.biggestThreat) {
    ideas.push(
      `Counter ${input.biggestThreat} by mirroring their best-performing offer framing, then differentiating on proof + speed.`,
    );
  }
  ideas.push(
    `Re-balance into ${input.underWeightedChannel}: ship 3–5 new creatives around ${input.topProduct ?? "your top product line"} and keep rotation weekly.`,
  );

  return [...new Set([...cleaned, ...ideas])].slice(0, 3);
}

type Props = {
  clientName: string;
  category: string;
  competitorDomains: string[];
  marketTemperature: string | null;
  biggestThreat: string | null;
  biggestOpportunity: string | null;
  recommendedMove: string | null;
  categoryKpis: CategoryKpis;
  heroPulse: HeroPulse;
  weeklyChanges: EnrichedBrandChange[];
  competitorRisers: EnrichedCompetitor[];
  channelMix: ChannelMixResult;
  channelBite: string;
  productThemes: EnrichedProductTheme[];
  seasonalTheme: ReturnType<typeof detectSeasonalTheme>;
  whitespaceCards: { title: string; score: number | null; action: string }[];
  recommendedActions: string[];
  confidence: { ads?: number | null; brands?: number | null };
  marketIntel: MarketStrategistIntel | null;
  adlibraryCoverage: AdlibraryCoverage | null;
  onEvidence: (moduleId: DataModuleId, rowIndex?: number, rowLabel?: string) => void;
  visibleSections?: MarketIntelSectionId[];
};

export function MarketIntelReport({
  clientName,
  category,
  competitorDomains,
  marketTemperature,
  biggestThreat,
  biggestOpportunity,
  recommendedMove,
  categoryKpis,
  heroPulse,
  weeklyChanges,
  competitorRisers,
  channelMix,
  channelBite,
  productThemes,
  seasonalTheme,
  whitespaceCards,
  recommendedActions,
  confidence,
  marketIntel,
  adlibraryCoverage,
  onEvidence,
  visibleSections,
}: Props) {
  const [deepOpen, setDeepOpen] = useState(false);
  const show = (id: MarketIntelSectionId) =>
    !visibleSections || visibleSections.includes(id);
  const displayTitle = /bank/i.test(category) ? "Banking Pulse" : `${category} Pulse`;

  const topChannels = useMemo(() => {
    const active = channelMix.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
    return { first: active[0]?.channel ?? "Search", second: active[1]?.channel ?? "Video" };
  }, [channelMix.rows]);

  const productBite = radProductBite(seasonalTheme?.label ?? null, productThemes[0]?.label ?? null);
  const weeklyBite = radWeeklyBite(
    weeklyChanges.find((r) => r.deltas.wow > 5)?.brand ?? weeklyChanges[0]?.brand ?? null,
  );
  const competitorBite = radCompetitorBite(
    competitorRisers[0]?.brand ?? null,
    competitorRisers[0]?.deltas.wow ?? null,
  );
  const whitespaceBite = radWhitespaceBite(whitespaceCards[0]?.title ?? biggestOpportunity);
  const heroMoveRaw = recommendedMove ?? recommendedActions[0] ?? null;
  const heroMove = shortActionHeadline(heroMoveRaw);
  const curatedActions = useMemo(
    () =>
      dedupeActions(
        curateRecommendedActions({
          recommendedActions,
          topChannel: topChannels.first,
          underWeightedChannel: topChannels.second,
          topProduct: productThemes[0]?.label ?? null,
          biggestThreat,
          whitespace: whitespaceCards.map((w) => ({ title: w.title, action: w.action })),
        }),
        heroMoveRaw,
      ),
    [recommendedActions, topChannels.first, topChannels.second, productThemes, biggestThreat, whitespaceCards, heroMoveRaw],
  );
  const marketProvenance = {
    sampleSize: confidence.ads ?? 0,
    source: "AdLibrary market index",
    confidence: (confidence.ads ?? 0) >= 50 ? "High" : (confidence.ads ?? 0) >= 10 ? "Medium" : "Low",
    note: confidence.brands != null ? `${confidence.brands} brands in watchlist` : undefined,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {show("masthead") ? (
      <div
        style={{
          background: "linear-gradient(135deg, #FDF6E8 0%, #FFFFFF 55%)",
          border: "1px solid #E8D5A0",
          borderRadius: 14,
          padding: "16px 18px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#A07830" }}>
              {radHeroKicker()}
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, color: "#1C1C1A", letterSpacing: "-0.02em" }}>
              {displayTitle}
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9E9D94" }}>{radDataRuleNote()}</p>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#9E9D94" }}>
            {clientName} · {category}
          </div>
        </div>
        <RadBite>{radGreeting(category)}</RadBite>
      </div>
      ) : null}

      {show("watchlist") && competitorDomains.length > 0 && (
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

      {show("kpis") ? (
      <>
      <DataProvenanceBar provenance={marketProvenance} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <KpiTile
          label="Brands tracked"
          value={categoryKpis.brandsTracked}
          deltas={categoryKpis.deltas}
          sparkline={categoryKpis.sparkline}
        />
        <KpiTile
          label="Ads indexed"
          value={categoryKpis.adsIndexed}
          sparkline={buildAdsSparkline(categoryKpis.adsIndexed)}
        />
        <KpiTile
          label="Activity index"
          value={categoryKpis.activityIndex}
          suffix="/100"
          deltas={heroPulse.deltas}
          sparkline={heroPulse.sparkline}
        />
        <KpiTile
          label="Data confidence"
          value={confidence.brands != null ? `${confidence.brands}b` : "—"}
          suffix={confidence.ads != null ? ` · ${confidence.ads.toLocaleString()} ads` : undefined}
        />
      </div>
      </>
      ) : null}

      {show("heroSignals") ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <HeroCard
          emoji="🔥"
          label="Market temperature"
          value={marketTemperature ?? "Heating up"}
          metric={heroPulse.activityIndex}
          metricSuffix="/100"
          deltas={heroPulse.deltas}
          sparkline={heroPulse.sparkline}
          bite={radTemperatureBite(marketTemperature)}
        />
        <HeroCard emoji="⚠️" label="Biggest threat" value={biggestThreat ?? "—"} onEvidence={() => onEvidence("threats")} />
        <HeroCard emoji="💡" label="Biggest opportunity" value={biggestOpportunity ?? "—"} onEvidence={() => onEvidence("whitespace")} />
        <HeroCard
          emoji="🎯"
          label="Recommended move"
          value={heroMove}
          onEvidence={() => onEvidence("pitch")}
          highlight
        />
      </div>
      ) : null}

      {(show("weeklyChanges") || show("competitors") || show("channelMix") || show("productThemes")) ? (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>
        {show("weeklyChanges") ? (
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("changes")} />}>What changed this week</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {weeklyChanges.slice(0, 4).map((row) => (
              <div key={row.brand} style={{ background: "#F7F6F3", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{row.brand}</div>
                    <div style={{ fontSize: 11, color: "#C9963A", fontWeight: 600, marginTop: 2 }}>{row.movement}</div>
                  </div>
                  {row.interest != null && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#9E9D94", textTransform: "uppercase" }}>Interest</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1A", fontVariantNumeric: "tabular-nums" }}>
                        {Math.round(row.interest)}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                  <DeltaRow deltas={row.deltas} compact />
                  <Sparkline values={row.sparkline} stroke={row.deltas.wow >= 0 ? "#1E7A4C" : "#C0392B"} width={64} height={22} />
                </div>
              </div>
            ))}
          </div>
          <RadBite>{weeklyBite}</RadBite>
        </div>
        ) : null}

        {show("competitors") ? (
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("competitors")} />}>
            Competitor share-of-voice (index)
          </SectionLabel>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>
            The index is relative within your watchlist: 100 = loudest competitor observed; 50 = roughly half as present.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {competitorRisers.slice(0, 5).map((row) => (
              <div key={row.brand} style={{ display: "grid", gridTemplateColumns: "100px 1fr auto auto", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>{row.brand}</span>
                <MiniBar pct={row.threatScore} color={row.threatScore >= 70 ? "#C0392B" : "#C9963A"} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 88 }}>
                  <span style={{ fontSize: 11, color: "#9E9D94" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1C1C1A", fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(row.threatScore)}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <DeltaChip label="WoW" value={row.deltas.wow} compact />
                  <Sparkline values={row.sparkline} stroke="#C9963A" width={56} height={18} />
                </div>
              </div>
            ))}
          </div>
          <RadBite>{competitorBite}</RadBite>
        </div>
        ) : null}

        {show("channelMix") ? (
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("channelMix")} />}>Channel mix</SectionLabel>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>
            Confidence: High = direct channel tags; Medium = mixed sources; Low = inferred from incomplete tagging.
          </p>
          <ChannelMixBars
            rows={channelMix.rows}
            overallConfidence={channelMix.overallConfidence}
            sourceLabel={channelMix.sourceLabel}
            estimationTooltip={channelMix.estimationTooltip}
            available={channelMix.available}
            variant="light"
            animate
            emptyMessage="Channel mix will appear once creatives are indexed with platform/channel tags."
          />
          <RadBite>{channelBite || `${topChannels.first} leads; ${topChannels.second} under-weighted.`}</RadBite>
        </div>
        ) : null}

        {show("productThemes") ? (
        <div style={{ ...LINEN_CARD, gridColumn: "span 12 / span 12" }}>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("challengers")} />}>
            What they&apos;re advertising — by product & theme
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>
                  {seasonalTheme.emoji} Seasonal watch · {seasonalTheme.label}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#C9963A" }}>
                  {seasonalTheme.activeBrands.length} brands spotted
                </span>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>
                {seasonalTheme.note}
              </p>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {seasonalTheme.activeBrands.map((b) => (
                  <span key={b} style={{ fontSize: 11, fontWeight: 600, background: "#FFFFFF", border: "1px solid #E8D5A0", borderRadius: 999, padding: "3px 10px" }}>
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
            {productThemes.map((theme) => (
              <div key={theme.id} style={{ background: "#F7F6F3", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{theme.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1C1A", fontVariantNumeric: "tabular-nums" }}>{theme.sharePct}%</div>
                    <div style={{ fontSize: 10, color: "#9E9D94" }}>{theme.ads} ads</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <MiniBar pct={theme.sharePct} />
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
                  <DeltaRow deltas={theme.deltas} compact />
                  <Sparkline
                    values={theme.sparkline}
                    stroke={theme.trend === "up" ? "#1E7A4C" : theme.trend === "down" ? "#C0392B" : "#C9963A"}
                    width={56}
                    height={18}
                  />
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
          <RadBite>{productBite}</RadBite>
        </div>
        ) : null}
      </div>
      ) : null}

      {show("whitespace") && whitespaceCards.length > 0 && (
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
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#C9963A", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                    {card.score}
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#9E9D94", marginLeft: 4 }}>score</span>
                  </div>
                )}
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>
                  {card.action}
                </p>
              </button>
            ))}
          </div>
          <RadBite>{whitespaceBite}</RadBite>
        </div>
      )}

      {show("recommendedActions") && curatedActions.length > 0 && (
        <div>
          <SectionLabel action={<EvidenceBtn onClick={() => onEvidence("strategicActions")} />}>Recommended actions</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {curatedActions.slice(0, 3).map((action, i) => (
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
                <p style={{ margin: 0, fontSize: 14, color: "#1C1C1A", lineHeight: 1.5, fontWeight: i === 0 ? 600 : 500 }}>
                  {shortActionHeadline(action, 14)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {show("deepEvidence") ? (
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
      ) : null}
    </div>
  );
}

function buildAdsSparkline(ads: number): number[] {
  const base = Math.max(100, ads);
  return [0.82, 0.86, 0.89, 0.91, 0.94, 0.97, 0.99, 1].map((m) => Math.round(base * m));
}

function HeroCard({
  emoji,
  label,
  value,
  metric,
  metricSuffix,
  deltas,
  sparkline,
  bite,
  highlight,
  onEvidence,
}: {
  emoji: string;
  label: string;
  value: string;
  metric?: number;
  metricSuffix?: string;
  deltas?: PeriodDeltas;
  sparkline?: number[];
  bite?: string;
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
      {metric != null ? (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#1C1C1A", fontVariantNumeric: "tabular-nums" }}>
              {metric}
              {metricSuffix && <span style={{ fontSize: 14, color: "#9E9D94" }}>{metricSuffix}</span>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6B6B62", marginTop: 2 }}>{value}</div>
          </div>
          {sparkline && <Sparkline values={sparkline} stroke="#C9963A" width={64} height={24} />}
        </div>
      ) : (
        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: "#1C1C1A", lineHeight: 1.35 }}>{value}</div>
      )}
      {deltas && <DeltaRow deltas={deltas} compact />}
      {bite && <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9E9D94", lineHeight: 1.4 }}>{bite}</p>}
    </div>
  );
}

/** @deprecated Use enrichWeeklyChanges from marketPulseMetrics */
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

/** @deprecated Use enrichCompetitorRisers from marketPulseMetrics */
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