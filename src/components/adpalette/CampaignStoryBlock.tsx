import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CampaignStory } from "@/lib/campaignStory";
import { PLACEMENT_INTEL_UNAVAILABLE } from "@/lib/advertiserPlacements";

type Props = {
  brand: string;
  loading: boolean;
  placementIntelUnavailable: boolean;
  story: CampaignStory | null;
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
  fontSize: 12,
  color: "#1C1C1A",
  padding: "10px 12px",
  borderBottom: "1px solid #F0EDE8",
  verticalAlign: "top",
  lineHeight: 1.4,
};

function clip(s: string, max = 60): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function CampaignStoryBlock({ brand, loading, placementIntelUnavailable, story }: Props) {
  const [open, setOpen] = useState(false);

  if (loading) return null;

  if (placementIntelUnavailable || !story?.available || !story.table.length) {
    return null;
  }

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #EBE9E4", borderRadius: 10, overflow: "hidden" }}>
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
            Campaign detail
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginTop: 2 }}>
            {story.table.length} campaign cluster{story.table.length === 1 ? "" : "s"} · {brand}
          </div>
        </div>
        {open ? <ChevronUp size={18} color="#6B6B62" /> : <ChevronDown size={18} color="#6B6B62" />}
      </button>

      {open ? (
        <div style={{ overflowX: "auto", borderTop: "1px solid #EBE9E4" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>Line</th>
                <th style={th}>Product</th>
                <th style={th}>Channels</th>
                <th style={th}>Message</th>
                <th style={{ ...th, textAlign: "center" }}>#</th>
              </tr>
            </thead>
            <tbody>
              {story.table.map((row) => (
                <tr key={row.campaign}>
                  <td style={{ ...td, fontWeight: 600 }}>{row.campaign}</td>
                  <td style={td}>{row.product}</td>
                  <td style={td}>{row.channels}</td>
                  <td style={td}>
                    <span style={{ fontSize: 11, fontWeight: 600, background: "#F7F6F3", borderRadius: 4, padding: "2px 8px" }}>
                      {row.message}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{row.creatives}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: "0 18px 14px", fontSize: 12, color: "#9E9D94" }}>
          Expand for full campaign table · summary is in the signal scan above
        </div>
      )}
    </div>
  );
}

export function CampaignStoryUnavailable({ placementIntelUnavailable }: { placementIntelUnavailable: boolean }) {
  if (!placementIntelUnavailable) return null;
  return (
    <div style={{ fontSize: 12, color: "#9E9D94", padding: "8px 0" }}>{PLACEMENT_INTEL_UNAVAILABLE}</div>
  );
}
