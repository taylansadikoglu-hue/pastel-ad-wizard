import type { CampaignIntelligence } from "@/lib/campaignIntelligence";
import { PLACEMENT_INTEL_UNAVAILABLE } from "@/lib/advertiserPlacements";

type Props = {
  brand: string;
  loading: boolean;
  placementIntelUnavailable: boolean;
  intel: CampaignIntelligence | null;
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 10,
  padding: "18px 22px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#6B6B62",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  margin: "0 0 12px",
};

const soWhatStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6B6B62",
  lineHeight: 1.5,
  marginTop: 8,
  paddingTop: 8,
  borderTop: "1px solid #F0EDE8",
  fontStyle: "italic",
};

function Skeleton({ height = 48 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        background: "#F0EDE8",
        borderRadius: 8,
        animation: "radPulse 1.5s infinite",
      }}
    />
  );
}

function Empty({ message }: { message: string }) {
  return <p style={{ fontSize: 13, color: "#9E9D94", margin: 0, lineHeight: 1.5 }}>{message}</p>;
}

function DistBars({ rows }: { rows: { label: string; pct: number; soWhat: string }[] }) {
  if (!rows.length) return <Empty message="No distribution to show from indexed placements." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((row) => (
        <div key={row.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "#1C1C1A" }}>{row.label}</span>
            <span style={{ color: "#6B6B62", fontWeight: 600 }}>{row.pct}%</span>
          </div>
          <div style={{ height: 6, background: "#F0EDE8", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${row.pct}%`, height: "100%", background: "#C9963A", borderRadius: 4 }} />
          </div>
          <p style={{ ...soWhatStyle, marginTop: 6, paddingTop: 0, borderTop: "none" }}>{row.soWhat}</p>
        </div>
      ))}
    </div>
  );
}

export function CampaignIntelligenceBlock({ brand, loading, placementIntelUnavailable, intel }: Props) {
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ ...cardStyle, borderLeft: "3px solid #1C1C1A" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1C1C1A", margin: "0 0 8px" }}>Campaign Intelligence</h2>
          <p style={{ fontSize: 13, color: "#9E9D94", margin: 0 }}>Loading campaign data…</p>
        </div>
        <Skeleton height={120} />
        <Skeleton height={80} />
        <Skeleton height={80} />
      </div>
    );
  }

  if (placementIntelUnavailable || !intel?.available) {
    return (
      <div style={{ ...cardStyle, borderLeft: "3px solid #C0392B" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1C1C1A", margin: "0 0 8px" }}>Campaign Intelligence</h2>
        <Empty message={PLACEMENT_INTEL_UNAVAILABLE} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...cardStyle, borderLeft: "3px solid #1C1C1A" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1C1C1A", margin: "0 0 4px" }}>Campaign Intelligence</h2>
        <p style={{ fontSize: 12, color: "#9E9D94", margin: "0 0 8px" }}>
          Based on {intel.rowCount} indexed placement{intel.rowCount === 1 ? "" : "s"} · no new APIs
        </p>
        <p style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.55, margin: 0 }}>{intel.blockSoWhat}</p>
      </div>

      {/* 1. Current Campaigns */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Current campaigns</h3>
        {intel.currentCampaigns.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {intel.currentCampaigns.map((c) => (
              <div key={c.name} style={{ borderBottom: "1px solid #F0EDE8", paddingBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A", marginBottom: 4 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#6B6B62", marginBottom: 6 }}>
                  {c.firstSeen} → {c.lastSeen} · {c.channels} · {c.creativeCount} creative{c.creativeCount === 1 ? "" : "s"}
                </div>
                <p style={{ fontSize: 13, color: "#1C1C1A", margin: "0 0 4px", lineHeight: 1.5 }}>{c.summary}</p>
                <p style={{ ...soWhatStyle, marginTop: 4 }}>{c.soWhat}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty message={`No campaign groups found for ${brand} in indexed placements.`} />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* 2. Messaging Breakdown */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Messaging breakdown</h3>
          <DistBars rows={intel.messagingBreakdown} />
        </div>

        {/* 3. CTA Breakdown */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>CTA breakdown</h3>
          <DistBars rows={intel.ctaBreakdown} />
        </div>
      </div>

      {/* 4. Campaign Timeline */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Campaign timeline</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <TimelineColumn title="Newest activity" items={intel.timeline.newest} empty="No recent campaign activity indexed." />
          <TimelineColumn title="Recently refreshed" items={intel.timeline.refreshed} empty="No refreshed campaigns in the last 7 days." />
          <TimelineColumn title="Longest running" items={intel.timeline.oldestActive} empty="No long-running campaigns indexed yet." />
        </div>
      </div>

      {/* 5. Creative Fatigue */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Creative fatigue</h3>
        {intel.creativeFatigue.length ? (
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            {intel.creativeFatigue.map((f) => (
              <li key={f.campaign} style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.5 }}>
                <strong>{f.campaign}</strong> — {f.detail}
                <p style={{ ...soWhatStyle }}>{f.soWhat}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty message="No campaigns flagged for fatigue — none running over 60 days with limited creative rotation." />
        )}
      </div>

      {/* 6. What's Changed */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>What&apos;s changed</h3>
        {intel.whatsChanged.length ? (
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {intel.whatsChanged.map((c) => (
              <li key={c.headline} style={{ padding: "10px 12px", background: "#F7F6F3", borderRadius: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{c.headline}</div>
                <div style={{ fontSize: 13, color: "#6B6B62", marginTop: 4 }}>{c.detail}</div>
                <p style={{ ...soWhatStyle }}>{c.soWhat}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty message="No notable changes in the last 7 days from indexed placements." />
        )}
      </div>

      {/* 7. Channel Ownership */}
      <div style={cardStyle}>
        <h3 style={sectionTitle}>Channel ownership</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {intel.channelOwnership.map((ch) => (
            <div key={ch.channel} style={{ display: "flex", alignItems: "center", gap: 12, opacity: ch.status === "gap" ? 0.55 : 1 }}>
              <div style={{ width: 88, fontSize: 13, fontWeight: 500, color: "#1C1C1A" }}>{ch.channel}</div>
              <div style={{ flex: 1, height: 6, background: "#F0EDE8", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${ch.pct}%`,
                    height: "100%",
                    background: ch.status === "gap" ? "#C4C2BA" : "#C9963A",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ width: 40, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#6B6B62" }}>
                {ch.count > 0 ? `${ch.pct}%` : "—"}
              </div>
            </div>
          ))}
        </div>
        <p style={{ ...soWhatStyle, marginTop: 12 }}>
          {intel.channelOwnership.filter((c) => c.status === "gap").length
            ? `Gaps on ${intel.channelOwnership.filter((c) => c.status === "gap").map((c) => c.channel).join(", ")} — practical whitespace for your client.`
            : `${brand} is present across all indexed channels — compete on message and offer, not channel absence.`}
        </p>
      </div>
    </div>
  );
}

function TimelineColumn({
  title,
  items,
  empty,
}: {
  title: string;
  items: { title: string; detail: string; soWhat: string }[];
  empty: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#1C1C1A", marginBottom: 8 }}>{title}</div>
      {items.length ? (
        <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((item) => (
            <li key={item.title + item.detail} style={{ fontSize: 13, color: "#1C1C1A", lineHeight: 1.45 }}>
              <strong>{item.title}</strong>
              <div style={{ color: "#6B6B62", fontSize: 12 }}>{item.detail}</div>
              <div style={{ fontSize: 11, color: "#9E9D94", marginTop: 4, fontStyle: "italic" }}>{item.soWhat}</div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty message={empty} />
      )}
    </div>
  );
}
