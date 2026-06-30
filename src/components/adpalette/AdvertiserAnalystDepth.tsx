import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";

type Props = {
  children: ReactNode;
  defaultOpen?: boolean;
};

export function AdvertiserAnalystDepth({ children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ border: "1px solid #EBE9E4", borderRadius: 10, overflow: "hidden", background: "#FFFFFF" }}>
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
          background: open ? "#F7F6F3" : "#FFFFFF",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#1C1C1A",
              color: "#FBBF24",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={16} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Analyst depth
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A", marginTop: 2 }}>
              {open ? "Hide pitch prep & evidence" : "Open pitch prep, market signals & campaign detail"}
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={18} color="#6B6B62" /> : <ChevronDown size={18} color="#6B6B62" />}
      </button>
      {open ? (
        <div style={{ padding: "16px 18px 18px", borderTop: "1px solid #EBE9E4", display: "flex", flexDirection: "column", gap: 16 }}>
          {children}
        </div>
      ) : (
        <div style={{ padding: "0 18px 14px", fontSize: 12, color: "#9E9D94" }}>
          The scan above is the default view — expand only when you need deck-level detail.
        </div>
      )}
    </div>
  );
}
