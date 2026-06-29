import type { CampaignStory } from "@/lib/campaignStory";
import { PLACEMENT_INTEL_UNAVAILABLE } from "@/lib/advertiserPlacements";

type Props = {
  brand: string;
  loading: boolean;
  placementIntelUnavailable: boolean;
  story: CampaignStory | null;
};

const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderLeft: "4px solid #C9963A",
  borderRadius: 10,
  padding: "22px 24px",
};

const th: React.CSSProperties = {
  textAlign: "left",
  fontSize: 10,
  fontWeight: 600,
  color: "#9E9D94",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "10px 12px",
  borderBottom: "1px solid #EBE9E4",
  background: "#F7F6F3",
};

const td: React.CSSProperties = {
  fontSize: 13,
  color: "#1C1C1A",
  padding: "12px",
  borderBottom: "1px solid #F0EDE8",
  verticalAlign: "top",
  lineHeight: 1.45,
};

const QUICK_LABELS: { key: keyof CampaignStory["quickAnswers"]; label: string }[] = [
  { key: "whatDoing", label: "What are they doing?" },
  { key: "whereSpending", label: "Where are they spending?" },
  { key: "whatSaying", label: "What are they saying?" },
  { key: "whatChanged", label: "What changed?" },
  { key: "clientShouldDo", label: "What should my client do?" },
];

export function CampaignStoryBlock({ brand, loading, placementIntelUnavailable, story }: Props) {
  if (loading) {
    return (
      <div style={card}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#C9963A", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
          Campaign Story
        </div>
        <div style={{ height: 14, width: "40%", background: "#F0EDE8", borderRadius: 4, marginBottom: 16 }} />
        <div style={{ height: 72, background: "#F0EDE8", borderRadius: 8 }} />
      </div>
    );
  }

  if (placementIntelUnavailable || !story?.available) {
    return (
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 600, color: "#1C1C1A", marginBottom: 8 }}>Campaign Story</div>
        <p style={{ fontSize: 14, color: "#9E9D94", margin: 0, lineHeight: 1.55 }}>{PLACEMENT_INTEL_UNAVAILABLE}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#C9963A", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
              Campaign Story
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1C1C1A", margin: 0, lineHeight: 1.25 }}>
              {brand} at a glance
            </h2>
          </div>
          <div style={{ fontSize: 12, color: "#9E9D94" }}>
            {story.rowCount} indexed placement{story.rowCount === 1 ? "" : "s"} · read in 30 seconds
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          {QUICK_LABELS.map(({ key, label }) => (
            <div
              key={key}
              style={{
                background: "#F7F6F3",
                border: "1px solid #EBE9E4",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, color: "#1C1C1A", lineHeight: 1.45 }}>
                {story.quickAnswers[key]}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 15, color: "#1C1C1A", lineHeight: 1.65, margin: "0 0 4px" }}>
          {story.executiveSummary}
        </p>
        <p style={{ fontSize: 12, color: "#9E9D94", margin: 0 }}>
          Supporting evidence — channel mix, products, and campaign detail — follows below.
        </p>
      </div>

      {story.table.length > 0 && (
        <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #EBE9E4" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>Campaign table</div>
            <div style={{ fontSize: 12, color: "#9E9D94", marginTop: 2 }}>Grouped by campaign cluster and product type</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Campaign</th>
                  <th style={th}>Product</th>
                  <th style={th}>First seen</th>
                  <th style={th}>Last seen</th>
                  <th style={th}>Channels</th>
                  <th style={th}>Message</th>
                  <th style={th}>Offer signal</th>
                  <th style={th}>Market signal</th>
                  <th style={th}>CTA</th>
                  <th style={th}>Strategist takeaway</th>
                  <th style={th}>Creatives</th>
                </tr>
              </thead>
              <tbody>
                {story.table.map((row) => (
                  <tr key={row.campaign}>
                    <td style={{ ...td, fontWeight: 600 }}>{row.campaign}</td>
                    <td style={td}>{row.product}</td>
                    <td style={td}>{row.firstSeen}</td>
                    <td style={td}>{row.lastSeen}</td>
                    <td style={td}>{row.channels}</td>
                    <td style={td}>{row.message}</td>
                    <td style={{ ...td, maxWidth: 200 }}>{row.offerSignal}</td>
                    <td style={{ ...td, maxWidth: 200 }}>{row.marketSignal}</td>
                    <td style={td}>{row.cta}</td>
                    <td style={{ ...td, maxWidth: 280 }}>{row.strategistTakeaway}</td>
                    <td style={{ ...td, textAlign: "center" }}>{row.creatives}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
