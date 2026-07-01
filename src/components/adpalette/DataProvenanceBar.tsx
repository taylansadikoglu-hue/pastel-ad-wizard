import type { DataProvenance } from "@/lib/dataTrust";
import { formatProvenanceLine } from "@/lib/dataTrust";

type Props = {
  provenance: DataProvenance;
  className?: string;
};

export function DataProvenanceBar({ provenance }: Props) {
  const line = formatProvenanceLine(provenance);
  const isPreview = provenance.confidence === "Preview";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 500,
        color: isPreview ? "#A07830" : "#6B6B62",
        background: isPreview ? "#FDF6E8" : "#F7F6F3",
        border: isPreview ? "1px solid #E8D5A0" : "1px solid #EBE9E4",
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          padding: "2px 6px",
          borderRadius: 4,
          background: isPreview ? "#C9963A" : "#1C1C1A",
          color: "#FFFFFF",
        }}
      >
        {isPreview ? "Preview" : "Observed"}
      </span>
      <span>{line}</span>
      {provenance.note ? <span style={{ color: "#9E9D94" }}>{provenance.note}</span> : null}
    </div>
  );
}
