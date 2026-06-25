type Props = {
  level: number;
  label?: string;
};

export function SpendIndex({ level, label = "Spend index" }: Props) {
  const lvl = Math.max(0, Math.min(5, Math.round(level)));
  return (
    <div>
      <div
        style={{
          letterSpacing: "3px",
          color: "#C9963A",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        {"●".repeat(lvl)}
        <span style={{ color: "#E8E5DE" }}>{"○".repeat(5 - lvl)}</span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#9E9D94",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginTop: 2,
        }}
      >
        {label}
      </div>
    </div>
  );
}
