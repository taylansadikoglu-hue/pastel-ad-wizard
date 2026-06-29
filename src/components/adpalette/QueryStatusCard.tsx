type Props = {
  title: string;
  reason: string;
  optional?: boolean;
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
};

export function QueryStatusCard({ title, reason, optional = false, action }: Props) {
  return (
    <section
      style={{
        background: optional ? "#F7F6F3" : "#FDF6E8",
        border: `1px solid ${optional ? "#EBE9E4" : "#E8D5A0"}`,
        borderLeft: `3px solid ${optional ? "#9E9D94" : "#C9963A"}`,
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>{title}</h3>
            {optional ? (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#9E9D94",
                  background: "#EBE9E4",
                  borderRadius: 999,
                  padding: "2px 8px",
                }}
              >
                Optional
              </span>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#6B6B62", lineHeight: 1.55 }}>{reason}</p>
        </div>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.loading}
            style={{
              flexShrink: 0,
              background: "#C9963A",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 7,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              cursor: action.loading ? "not-allowed" : "pointer",
              opacity: action.loading ? 0.7 : 1,
            }}
          >
            {action.loading ? "Working…" : action.label}
          </button>
        ) : null}
      </div>
    </section>
  );
}
