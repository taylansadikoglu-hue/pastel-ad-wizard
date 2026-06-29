import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import {
  DEMO_ADVERTISER_BLOCKED_MESSAGE,
  DEMO_READ_ONLY_MESSAGE,
} from "@/lib/demo-account";

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #EBE9E4",
  borderRadius: 10,
  padding: 28,
  maxWidth: 520,
  margin: "0 auto",
  textAlign: "center",
};

export function DemoAdvertiserRestricted() {
  return (
    <div style={cardStyle}>
      <Lock size={22} style={{ margin: "0 auto 12px", color: "#C9963A" }} />
      <div style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1A", marginBottom: 8 }}>
        Demo showcase
      </div>
      <p style={{ fontSize: 14, color: "#6B6B62", lineHeight: 1.6, margin: 0 }}>
        {DEMO_ADVERTISER_BLOCKED_MESSAGE}
      </p>
      <Link
        to="/app/advertiser/$domain"
        params={{ domain: "commbank.com.au" }}
        style={{
          display: "inline-block",
          marginTop: 18,
          fontSize: 13,
          fontWeight: 600,
          color: "#C9963A",
          textDecoration: "none",
        }}
      >
        View CommBank war room →
      </Link>
    </div>
  );
}

export function DemoRouteRestricted({ title = "Not available in demo" }: { title?: string }) {
  return (
    <div style={cardStyle}>
      <Lock size={22} style={{ margin: "0 auto 12px", color: "#C9963A" }} />
      <div style={{ fontSize: 17, fontWeight: 600, color: "#1C1C1A", marginBottom: 8 }}>{title}</div>
      <p style={{ fontSize: 14, color: "#6B6B62", lineHeight: 1.6, margin: 0 }}>{DEMO_READ_ONLY_MESSAGE}</p>
      <Link
        to="/app/pcr"
        style={{
          display: "inline-block",
          marginTop: 18,
          fontSize: 13,
          fontWeight: 600,
          color: "#C9963A",
          textDecoration: "none",
        }}
      >
        Back to Market Intel →
      </Link>
    </div>
  );
}
