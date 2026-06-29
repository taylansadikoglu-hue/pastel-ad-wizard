import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

type Props = {
  title?: string;
  description?: string;
};

export function ClientWorkspaceEmptyState({
  title = "Choose a client workspace to start.",
  description = "Select a client to scope Market Intel, competitors, and the advertiser war room.",
}: Props) {
  return (
    <div
      className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-8 py-16 text-center"
      style={{
        background: "var(--paper, #fff)",
        border: "1px solid var(--hairline, #EBE9E4)",
        borderRadius: 10,
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <Users size={28} style={{ color: "#C4C2BA", margin: "0 auto 12px" }} />
      <div style={{ fontSize: 18, fontWeight: 600, color: "#1C1C1A", marginBottom: 8 }}>{title}</div>
      <p
        style={{
          fontSize: 13,
          color: "#6B6B62",
          maxWidth: 420,
          margin: "0 auto 20px",
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
      <Link
        to="/app/clients"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#C9963A",
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 600,
          padding: "10px 20px",
          borderRadius: 7,
          textDecoration: "none",
        }}
      >
        Open Client Workspaces
      </Link>
    </div>
  );
}
