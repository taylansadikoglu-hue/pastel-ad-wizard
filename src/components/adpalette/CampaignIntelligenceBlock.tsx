import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  padding: "16px 18px",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#9E9D94",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  margin: "0 0 10px",
};

function Empty({ message }: { message: string }) {
  return <p style={{ fontSize: 12, color: "#9E9D94", margin: 0 }}>{message}</p>;
}

export function CampaignIntelligenceBlock({ brand, loading, placementIntelUnavailable, intel }: Props) {
  const [open, setOpen] = useState(false);

  if (loading) return null;

  if (placementIntelUnavailable || !intel?.available) {
    return null;
  }

  const hasTimeline =
    intel.timeline.newest.length > 0 ||
    intel.timeline.refreshed.length > 0 ||
    intel.timeline.oldestActive.length > 0;
  const hasChanges = intel.whatsChanged.length > 0;
  const hasFatigue = intel.creativeFatigue.length > 0;

  if (!hasTimeline && !hasChanges && !hasFatigue) return null;

  return (
    <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 18px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Deep dive
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginTop: 2 }}>
            Timeline, changes & fatigue · {brand}
          </div>
        </div>
        {open ? <ChevronUp size={18} color="#6B6B62" /> : <ChevronDown size={18} color="#6B6B62" />}
      </button>

      {open ? (
        <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 16, borderTop: "1px solid #EBE9E4" }}>
          {hasTimeline ? (
            <div>
              <h3 style={sectionTitle}>Campaign timeline</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <TimelineColumn title="Newest" items={intel.timeline.newest} />
                <TimelineColumn title="Refreshed" items={intel.timeline.refreshed} />
                <TimelineColumn title="Longest run" items={intel.timeline.oldestActive} />
              </div>
            </div>
          ) : null}

          {hasChanges ? (
            <div>
              <h3 style={sectionTitle}>What changed (7d)</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {intel.whatsChanged.map((c) => (
                  <div key={c.headline} style={{ padding: "10px 12px", background: "#F7F6F3", borderRadius: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>{c.headline}</div>
                    <div style={{ fontSize: 12, color: "#6B6B62", marginTop: 2 }}>{c.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasFatigue ? (
            <div>
              <h3 style={sectionTitle}>Creative fatigue flags</h3>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
                {intel.creativeFatigue.map((f) => (
                  <li key={f.campaign} style={{ fontSize: 13, color: "#1C1C1A", lineHeight: 1.45 }}>
                    <strong>{f.campaign}</strong> — {f.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ padding: "0 18px 14px", fontSize: 12, color: "#9E9D94" }}>
          Channel mix, messaging & campaigns are in the dashboard above
        </div>
      )}
    </div>
  );
}

function TimelineColumn({
  title,
  items,
}: {
  title: string;
  items: { title: string; detail: string }[];
}) {
  return (
    <div style={{ background: "#F7F6F3", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#1C1C1A", marginBottom: 6 }}>{title}</div>
      {items.length ? (
        <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.slice(0, 3).map((item) => (
            <li key={item.title + item.detail} style={{ fontSize: 12, color: "#1C1C1A", lineHeight: 1.4 }}>
              <strong>{item.title}</strong>
              <div style={{ color: "#6B6B62", fontSize: 11 }}>{item.detail}</div>
            </li>
          ))}
        </ul>
      ) : (
        <Empty message="—" />
      )}
    </div>
  );
}

export function CampaignIntelUnavailable({ placementIntelUnavailable }: { placementIntelUnavailable: boolean }) {
  if (!placementIntelUnavailable) return null;
  return <Empty message={PLACEMENT_INTEL_UNAVAILABLE} />;
}
