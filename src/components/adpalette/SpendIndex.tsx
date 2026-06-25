import { useState } from "react";

export const SPEND_TIERS = [
  { dots: 1, label: "Emerging", range: "Under $500K" },
  { dots: 2, label: "Building", range: "$500K – $2M" },
  { dots: 3, label: "Active", range: "$2M – $10M" },
  { dots: 4, label: "Competing", range: "$10M – $30M" },
  { dots: 5, label: "Dominant", range: "$30M – $80M" },
  { dots: 6, label: "Major", range: "$80M – $150M" },
  { dots: 7, label: "Category Leader", range: "$150M+" },
];

export function getSpendLevel(estimatedSpend: number): number {
  if (!estimatedSpend || estimatedSpend === 0) return 1;
  if (estimatedSpend < 500_000) return 1;
  if (estimatedSpend < 2_000_000) return 2;
  if (estimatedSpend < 10_000_000) return 3;
  if (estimatedSpend < 30_000_000) return 4;
  if (estimatedSpend < 80_000_000) return 5;
  if (estimatedSpend < 150_000_000) return 6;
  return 7;
}

type Props = {
  level?: number;
  spend?: number;
  /** Optional label override (kept for back-compat); ignored otherwise. */
  label?: string;
  showCaption?: boolean;
};

export function SpendIndex({ level, spend, showCaption = true }: Props) {
  const lvl = Math.max(
    1,
    Math.min(7, Math.round(level ?? (spend != null ? getSpendLevel(spend) : 1))),
  );
  const tier = SPEND_TIERS[lvl - 1];
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ letterSpacing: "3px", fontSize: 14, lineHeight: 1 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} style={{ color: i < lvl ? "#C9963A" : "#EBE9E4" }}>
            ●
          </span>
        ))}
      </div>
      {showCaption && (
        <div
          style={{
            fontSize: 10,
            color: "#9E9D94",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 3,
          }}
        >
          {tier.label} · {tier.range}
        </div>
      )}
      {hover && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 6,
            background: "#1C1C1A",
            color: "#FFF",
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            zIndex: 50,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            Spend index — {tier.label}
          </div>
          <div style={{ opacity: 0.85 }}>Estimated range: {tier.range}</div>
          <div style={{ opacity: 0.6, fontSize: 11, marginTop: 4, whiteSpace: "normal", maxWidth: 240 }}>
            Based on ad frequency, placement signals and impression data.
          </div>
        </div>
      )}
    </div>
  );
}

export function SpendLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: 11,
          color: "#C9963A",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          fontWeight: 500,
        }}
      >
        How we estimate spend {open ? "↑" : "↓"}
      </button>
      {open && (
        <div
          style={{
            marginTop: 8,
            padding: "12px 0",
            background: "#F7F6F3",
            borderTop: "1px solid #EBE9E4",
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          {SPEND_TIERS.map((t) => (
            <div key={t.dots} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ letterSpacing: "2px", fontSize: 11, lineHeight: 1 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <span key={i} style={{ color: i < t.dots ? "#C9963A" : "#EBE9E4" }}>●</span>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "#9E9D94", letterSpacing: "0.04em" }}>
                <span style={{ color: "#1C1C1A", fontWeight: 500 }}>{t.label}</span> · {t.range}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
