import type { AdvertiserStrategistIntel } from "@/lib/advertiserStrategistIntel";

type Props = {
  brand: string;
  loading: boolean;
  intel: AdvertiserStrategistIntel | null;
};

const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 10,
  padding: "18px 22px",
};

const label: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#9E9D94",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const chip: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#1C1C1A",
  background: "#F7F6F3",
  border: "1px solid #EBE9E4",
  borderRadius: 6,
  padding: "6px 10px",
};

export function AdvertiserStrategistIntelBlock({ brand, loading, intel }: Props) {
  if (loading) {
    return (
      <div style={{ ...card, borderLeft: "4px solid #1C1C1A" }}>
        <div style={{ height: 12, width: 120, background: "#F0EDE8", borderRadius: 4, marginBottom: 12 }} />
        <div style={{ height: 64, background: "#F0EDE8", borderRadius: 8 }} />
      </div>
    );
  }

  if (!intel?.available) return null;

  const chips = [
    intel.positioningArchetype && { k: "Archetype", v: intel.positioningArchetype },
    intel.funnelFocus && { k: "Funnel", v: intel.funnelFocus },
    intel.topEmotion && { k: "Emotion", v: intel.topEmotion },
    intel.topBuyerStage && { k: "Stage", v: intel.topBuyerStage },
    intel.topOfferType && { k: "Offer", v: intel.topOfferType },
    intel.topCta && { k: "CTA", v: intel.topCta },
  ].filter(Boolean) as { k: string; v: string }[];

  const summary =
    intel.strategistSummary
    ?? intel.strategySummary
    ?? intel.marketDna;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...card, borderLeft: "4px solid #1C1C1A" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1C1C1A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Strategist intelligence
          </div>
          {intel.placements != null && (
            <div style={{ fontSize: 12, color: "#9E9D94" }}>
              {intel.placements} placements indexed
            </div>
          )}
        </div>

        {summary && (
          <p style={{ fontSize: 15, color: "#1C1C1A", lineHeight: 1.65, margin: "0 0 14px" }}>
            {summary}
          </p>
        )}

        {intel.marketDna && intel.marketDna !== summary && (
          <div style={{ marginBottom: 14 }}>
            <div style={label}>Market DNA</div>
            <p style={{ fontSize: 14, color: "#6B6B62", lineHeight: 1.6, margin: 0 }}>{intel.marketDna}</p>
          </div>
        )}

        {chips.length > 0 && (
          <div style={{ marginBottom: intel.recommendation ? 14 : 0 }}>
            <div style={label}>Positioning profile</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {chips.map(({ k, v }) => (
                <span key={k} style={chip}>
                  <span style={{ color: "#9E9D94", marginRight: 4 }}>{k}</span>
                  {v}
                </span>
              ))}
            </div>
            {intel.dnaSignature && (
              <div style={{ fontSize: 11, color: "#9E9D94", marginTop: 8 }}>
                DNA: {intel.dnaSignature}
              </div>
            )}
          </div>
        )}

        {intel.recommendation && (
          <div
            style={{
              background: "#FDF6E8",
              border: "1px solid #E8D5A0",
              borderRadius: 8,
              padding: "12px 14px",
            }}
          >
            <div style={{ ...label, color: "#A07830", marginBottom: 6 }}>Recommended for your client</div>
            <p style={{ fontSize: 14, color: "#1C1C1A", lineHeight: 1.55, margin: 0 }}>
              {intel.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
