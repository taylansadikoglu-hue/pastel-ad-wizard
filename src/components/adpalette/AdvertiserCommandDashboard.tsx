import { ArrowDown, ArrowUp, Zap } from "lucide-react";
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { SpendIndex } from "@/components/adpalette/SpendIndex";
import { AdvertiserVisualScan, VisualMoveCards } from "@/components/adpalette/AdvertiserVisualScan";
import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";
import type { CampaignIntelligence } from "@/lib/campaignIntelligence";
import type { ChannelMixResult } from "@/lib/channelMix";
import type { AdvertiserVisualScan as VisualScanData } from "@/lib/advertiserVisualSignals";

type Props = {
  brand: string;
  category: string;
  updatedAgo: string | null;
  placementCount: number;
  totalAds: number;
  adsThisWeek: number;
  daysRunning: number;
  reachLabel: string;
  frequencyLabel: string;
  spendSignal?: number;
  spendMonthly?: number;
  spendBandLabel?: string | null;
  visualScan: VisualScanData;
  channelMix: ChannelMixResult;
  strategistIntel: AdvertiserStrategistIntel | null;
  campaignIntel: CampaignIntelligence | null;
  topProducts: string[];
  creativeScore: number;
  creativeTier: "fresh" | "maturing" | "fatigued";
  creativeLabel: string;
};

function MiniBars({ rows, colour = "#C9963A" }: { rows: { label: string; pct: number }[]; colour?: string }) {
  const active = rows.filter((r) => r.pct > 0).slice(0, 4);
  if (!active.length) {
    return <div style={{ fontSize: 12, color: "#9E9D94" }}>—</div>;
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
      <div style={{ fontSize: 26, fontWeight: 700, color: "#1C1C1A", letterSpacing: "-0.03em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>
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

function channelPills(channels: string): string[] {
  return channels
    .split(/[,·]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function AdvertiserCommandDashboard({
  brand,
  category,
  updatedAgo,
  placementCount,
  totalAds,
  adsThisWeek,
  daysRunning,
  reachLabel,
  frequencyLabel,
  spendSignal,
  spendMonthly = 0,
  spendBandLabel,
  visualScan,
  channelMix,
  strategistIntel,
  campaignIntel,
  topProducts,
  creativeScore,
  creativeTier,
  creativeLabel,
}: Props) {
  const tierColour = creativeTier === "fresh" ? "#2D7D46" : creativeTier === "maturing" ? "#C9963A" : "#C0392B";
  const campaigns = campaignIntel?.currentCampaigns?.slice(0, 4) ?? [];
  const leadChannel = visualScan.channels[0];
  const channelHeadline = leadChannel ? `${leadChannel.name} ${leadChannel.pct}%` : "—";

  const dnaChips = [
    strategistIntel?.positioningArchetype && { label: "Archetype", value: strategistIntel.positioningArchetype },
    strategistIntel?.funnelFocus && { label: "Funnel", value: strategistIntel.funnelFocus },
    strategistIntel?.topEmotion && { label: "Emotion", value: strategistIntel.topEmotion },
    strategistIntel?.topBuyerStage && { label: "Stage", value: strategistIntel.topBuyerStage },
    strategistIntel?.topCta && { label: "CTA", value: strategistIntel.topCta },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 10 }}>
        <KpiTile
          value={totalAds.toLocaleString()}
          label="Ads"
          sub={adsThisWeek > 0 ? `+${adsThisWeek} wk` : undefined}
          trendUp={adsThisWeek > 0 ? true : null}
        />
        <KpiTile value={reachLabel} label="Reach" />
        <KpiTile value={frequencyLabel} label="Freq" />
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
              {spendBandLabel.replace(/\(.*\)/, "").trim()}
            </div>
          ) : null}
        </div>
        <KpiTile value={channelHeadline} label="Lead ch." />
        <KpiTile value={`${daysRunning}d`} label="Active" sub={category} />
      </div>

      <AdvertiserVisualScan
        brand={brand}
        category={category}
        updatedAgo={updatedAgo}
        placementCount={placementCount}
        scan={visualScan}
      />

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
            emptyMessage="—"
          />
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Messaging %
          </div>
          <MiniBars rows={(campaignIntel?.messagingBreakdown ?? []).map((r) => ({ label: r.label, pct: r.pct }))} colour="#7C3AED" />
        </div>
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            CTA %
          </div>
          <MiniBars rows={(campaignIntel?.ctaBreakdown ?? []).map((r) => ({ label: r.label, pct: r.pct }))} colour="#4285F4" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 120px", gap: 12, alignItems: "stretch" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderLeft: "4px solid #1C1C1A", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1C1C1A", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            DNA tags
          </div>
          {dnaChips.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {dnaChips.map((chip) => (
                <span
                  key={chip.label}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    background: "#F7F6F3",
                    border: "1px solid #EBE9E4",
                    borderRadius: 20,
                    padding: "6px 12px",
                  }}
                >
                  <span style={{ color: "#9E9D94", marginRight: 6 }}>{chip.label}</span>
                  {chip.value}
                </span>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "#9E9D94" }}>—</div>
          )}
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Products
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(topProducts.length ? topProducts : ["—"]).slice(0, 5).map((p) => (
              <span
                key={p}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
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

        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBE9E4",
            borderRadius: 10,
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase" }}>Health</div>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: `3px solid ${tierColour}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {creativeScore}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: tierColour }}>{creativeLabel}</div>
        </div>
      </div>

      {campaigns.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Campaign lines
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(campaigns.length, 4)}, minmax(0, 1fr))`, gap: 10 }}>
            {campaigns.map((c) => {
              const share = visualScan.campaigns.find((x) => x.name === c.name)?.sharePct ?? 0;
              return (
                <div key={c.name} style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1A" }}>{c.name}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#C9963A" }}>{c.creativeCount}</div>
                  </div>
                  <div style={{ height: 4, background: "#F0EDE8", borderRadius: 2, margin: "8px 0", overflow: "hidden" }}>
                    <div style={{ width: `${Math.max(share, 6)}%`, height: "100%", background: "#C9963A", borderRadius: 2 }} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {channelPills(c.channels).map((ch) => (
                      <span key={ch} style={{ fontSize: 10, fontWeight: 600, background: "#F0EDE8", borderRadius: 4, padding: "2px 6px", color: "#6B6B62" }}>
                        {ch}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "#9E9D94", marginTop: 6 }}>
                    {c.firstSeen} → {c.lastSeen}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {visualScan.moves.length > 0 ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Zap size={14} color="#C9963A" />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#A07830", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Play angles
            </span>
          </div>
          <VisualMoveCards moves={visualScan.moves} />
        </div>
      ) : null}
    </div>
  );
}
