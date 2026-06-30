import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  MapPin,
  Megaphone,
  RefreshCw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { SpendIndex } from "@/components/adpalette/SpendIndex";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import type { CampaignIntelligence } from "@/lib/campaignIntelligence";
import type { CampaignStory } from "@/lib/campaignStory";
import type { ChannelMixResult } from "@/lib/channelMix";

type QuickScan = {
  what: string;
  where: string;
  saying: string;
  changed: string;
  action: string;
};

type Props = {
  brand: string;
  category: string;
  updatedAgo: string | null;
  totalAds: number;
  adsThisWeek: number;
  daysRunning: number;
  reachLabel: string;
  frequencyLabel: string;
  spendSignal?: number;
  spendMonthly?: number;
  spendBandLabel?: string | null;
  quickScan: QuickScan;
  channelMix: ChannelMixResult;
  strategistIntel: AdvertiserStrategistIntel | null;
  campaignIntel: CampaignIntelligence | null;
  campaignStory: CampaignStory | null;
  topMoves: string[];
  topProducts: string[];
  creativeScore: number;
  creativeTier: "fresh" | "maturing" | "fatigued";
  creativeLabel: string;
};

const SCAN_TILES: { key: keyof QuickScan; label: string; icon: typeof Target; accent: string }[] = [
  { key: "what", label: "What", icon: Target, accent: "#C9963A" },
  { key: "where", label: "Where", icon: MapPin, accent: "#4285F4" },
  { key: "saying", label: "Saying", icon: Megaphone, accent: "#7C3AED" },
  { key: "changed", label: "Changed", icon: RefreshCw, accent: "#0D9488" },
  { key: "action", label: "Your move", icon: Crosshair, accent: "#1C1C1A" },
];

function clip(text: string, max = 72): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function MiniBars({ rows, colour = "#C9963A" }: { rows: { label: string; pct: number }[]; colour?: string }) {
  const active = rows.filter((r) => r.pct > 0).slice(0, 4);
  if (!active.length) {
    return <div style={{ fontSize: 12, color: "#9E9D94" }}>Awaiting indexed placements</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {active.map((row) => (
        <div key={row.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: "#1C1C1A", fontWeight: 500 }}>{row.label}</span>
            <span style={{ color: "#6B6B62", fontWeight: 600 }}>{row.pct}%</span>
          </div>
          <div style={{ height: 5, background: "#F0EDE8", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${row.pct}%`, height: "100%", background: colour, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiTile({
  value,
  label,
  sub,
  trendUp,
}: {
  value: string;
  label: string;
  sub?: string | null;
  trendUp?: boolean | null;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #F7F6F3 100%)",
        border: "1px solid #EBE9E4",
        borderRadius: 10,
        padding: "14px 16px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: "#1C1C1A",
          letterSpacing: "-0.03em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "#9E9D94",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 6,
        }}
      >
        {label}
      </div>
      {sub ? (
        <div
          style={{
            fontSize: 11,
            color: trendUp === true ? "#2D7D46" : trendUp === false ? "#C0392B" : "#6B6B62",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          {trendUp === true ? <ArrowUp size={11} /> : trendUp === false ? <ArrowDown size={11} /> : null}
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function AdvertiserCommandDashboard({
  brand,
  category,
  updatedAgo,
  totalAds,
  adsThisWeek,
  daysRunning,
  reachLabel,
  frequencyLabel,
  spendSignal,
  spendMonthly = 0,
  spendBandLabel,
  quickScan,
  channelMix,
  strategistIntel,
  campaignIntel,
  campaignStory,
  topMoves,
  topProducts,
  creativeScore,
  creativeTier,
  creativeLabel,
}: Props) {
  const tierColour = creativeTier === "fresh" ? "#2D7D46" : creativeTier === "maturing" ? "#C9963A" : "#C0392B";
  const campaigns = campaignIntel?.currentCampaigns?.slice(0, 4) ?? [];
  const channelHeadline =
    channelMix.rows
      .filter((r) => r.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 2)
      .map((r) => `${r.channel} ${r.pct}%`)
      .join(" · ") || "—";

  const dnaChips = [
    strategistIntel?.positioningArchetype && { label: "Archetype", value: strategistIntel.positioningArchetype },
    strategistIntel?.funnelFocus && { label: "Funnel", value: strategistIntel.funnelFocus },
    strategistIntel?.topEmotion && { label: "Emotion", value: strategistIntel.topEmotion },
    strategistIntel?.topBuyerStage && { label: "Stage", value: strategistIntel.topBuyerStage },
    strategistIntel?.topCta && { label: "CTA", value: strategistIntel.topCta },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 10,
        }}
      >
        <KpiTile
          value={totalAds.toLocaleString()}
          label="Active ads"
          sub={adsThisWeek > 0 ? `+${adsThisWeek} this week` : "Indexed creatives"}
          trendUp={adsThisWeek > 0 ? true : null}
        />
        <KpiTile value={reachLabel} label="Est. reach" sub="Unique Australians" />
        <KpiTile value={frequencyLabel} label="Frequency" sub="Avg exposures" />
        <div
          style={{
            background: "linear-gradient(180deg, #FFFFFF 0%, #F7F6F3 100%)",
            border: "1px solid #EBE9E4",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <SpendIndex level={spendSignal && spendSignal > 0 ? spendSignal : undefined} spend={spendMonthly} />
          {spendBandLabel ? (
            <div style={{ fontSize: 10, color: "#9E9D94", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {spendBandLabel}
            </div>
          ) : null}
        </div>
        <KpiTile value={channelHeadline.split(" · ")[0] ?? "—"} label="Lead channel" sub={channelHeadline} />
        <KpiTile
          value={daysRunning.toLocaleString()}
          label="Days active"
          sub={category}
        />
      </div>

      {/* 2-second scan */}
      <div
        style={{
          background: "#1C1C1A",
          borderRadius: 12,
          padding: "18px 20px",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              Signal scan
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em" }}>
              {brand} — who, where, what
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#9E9D94" }}>
            {category}
            {updatedAgo ? ` · Updated ${updatedAgo}` : ""}
            {campaignStory?.rowCount ? ` · ${campaignStory.rowCount} placements` : ""}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {SCAN_TILES.map(({ key, label, icon: Icon, accent }) => (
            <div
              key={key}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "12px 14px",
                minHeight: 88,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: accent,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={12} color="#FFFFFF" />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#C4C2BA" }}>
                  {label}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: "#FFFFFF" }}>
                {clip(quickScan[key], 48)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data grid: channels + messaging + DNA */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Channel mix
          </div>
          <ChannelMixBars
            rows={channelMix.rows}
            overallConfidence={channelMix.overallConfidence}
            sourceLabel={channelMix.sourceLabel}
            estimationTooltip={channelMix.estimationTooltip}
            available={channelMix.available}
            variant="light"
            emptyMessage="Channels appear once creatives are tagged."
          />
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Messaging
          </div>
          <MiniBars
            rows={(campaignIntel?.messagingBreakdown ?? []).map((r) => ({ label: r.label, pct: r.pct }))}
            colour="#7C3AED"
          />
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            CTA mix
          </div>
          <MiniBars
            rows={(campaignIntel?.ctaBreakdown ?? []).map((r) => ({ label: r.label, pct: r.pct }))}
            colour="#4285F4"
          />
        </div>
      </div>

      {/* DNA ribbon + products */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderLeft: "4px solid #1C1C1A", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1C1C1A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Strategist DNA
          </div>
          {dnaChips.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dnaChips.map((chip) => (
                <span
                  key={chip.label}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    background: "#F7F6F3",
                    border: "1px solid #EBE9E4",
                    borderRadius: 20,
                    padding: "6px 12px",
                    color: "#1C1C1A",
                  }}
                >
                  <span style={{ color: "#9E9D94", fontWeight: 600, marginRight: 6 }}>{chip.label}</span>
                  {chip.value}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9E9D94" }}>DNA tags populate from indexed placements.</div>
          )}
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Products live
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(topProducts.length ? topProducts : ["—"]).slice(0, 5).map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  background: "#FDF6E8",
                  border: "1px solid #E8D5A0",
                  borderRadius: 6,
                  padding: "5px 9px",
                  color: "#A07830",
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign clusters */}
      {campaigns.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Active campaigns
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(campaigns.length, 4)}, minmax(0, 1fr))`,
              gap: 10,
            }}
          >
            {campaigns.map((c) => (
              <div
                key={c.name}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #EBE9E4",
                  borderRadius: 10,
                  padding: "14px 16px",
                  minWidth: 0,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1A", marginBottom: 4 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "#9E9D94", marginBottom: 8 }}>
                  {c.creativeCount} creative{c.creativeCount === 1 ? "" : "s"} · {c.channels}
                </div>
                <div style={{ fontSize: 12, color: "#6B6B62", lineHeight: 1.45 }}>{clip(c.summary ?? "—", 90)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bottom row: creative health + moves */}
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12 }}>
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBE9E4",
            borderRadius: 10,
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Creative health
          </div>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: `4px solid ${tierColour}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
              color: "#1C1C1A",
            }}
          >
            {creativeScore}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: tierColour }}>{creativeLabel}</div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderLeft: "4px solid #C9963A", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Zap size={14} color="#C9963A" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#A07830", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Recommended moves
            </span>
          </div>
          {topMoves.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {topMoves.slice(0, 3).map((move, i) => (
                <div
                  key={move}
                  style={{
                    background: "#FDF6E8",
                    border: "1px solid #E8D5A0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: "#1C1C1A",
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#A07830", marginRight: 6 }}>#{i + 1}</span>
                  {clip(move, 100)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9E9D94" }}>Moves surface once placement intel is indexed.</div>
          )}
        </div>
      </div>

      {/* Channel gaps — visual only */}
      {campaignIntel?.channelOwnership?.some((c) => c.status === "gap") ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#F0F9F4",
            border: "1px solid #A7D9B8",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#1B7F4A",
          }}
        >
          <Sparkles size={14} />
          <span>
            <strong>Whitespace:</strong>{" "}
            {campaignIntel.channelOwnership
              .filter((c) => c.status === "gap")
              .map((c) => c.channel)
              .join(", ")}{" "}
            — no indexed activity yet.
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function buildQuickScan(
  story: CampaignStory | null,
  moves: string[],
): QuickScan {
  return {
    what: story?.quickAnswers.whatDoing ?? "Indexing campaigns",
    where: story?.quickAnswers.whereSpending ?? "—",
    saying: story?.quickAnswers.whatSaying ?? "—",
    changed: story?.quickAnswers.whatChanged ?? "—",
    action: moves[0] ?? story?.quickAnswers.clientShouldDo ?? "—",
  };
}
