import { Link } from "@tanstack/react-router";
import { useClientWorkspace } from "@/contexts/ClientWorkspaceContext";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
import { DEMO_WORKSPACE_DOMAIN } from "@/lib/demo-account";

/** Active client workspace chip for the top navigation bar. */
export function ActiveClientWorkspaceBadge() {
  const { activeWorkspace, loading } = useClientWorkspace();
  const { isDemo } = useDemoAccount();

  if (loading) return null;

  if (!activeWorkspace) {
    if (isDemo) {
      return (
        <span
          style={{
            fontSize: 12,
            color: "var(--text-secondary, #6B6B62)",
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px dashed var(--hairline, #EBE9E4)",
          }}
        >
          CommBank workspace
        </span>
      );
    }
    return (
      <Link
        to="/app/clients"
        style={{
          fontSize: 12,
          color: "var(--text-secondary, #6B6B62)",
          textDecoration: "none",
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px dashed var(--hairline, #EBE9E4)",
        }}
      >
        Choose client workspace
      </Link>
    );
  }

  return (
    <Link
      to="/app/advertiser/$domain"
      params={{ domain: isDemo ? DEMO_WORKSPACE_DOMAIN : activeWorkspace.client_domain }}
      title={`${activeWorkspace.client_name} · ${activeWorkspace.category}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--ink, #1C1C1A)",
        textDecoration: "none",
        padding: "4px 12px",
        borderRadius: 999,
        background: "#FDF6E8",
        border: "1px solid #E8D5A0",
        maxWidth: 280,
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {activeWorkspace.client_name}
      </span>
      <span style={{ color: "#9E9D94", fontWeight: 500 }}>·</span>
      <span style={{ color: "#C9963A", fontWeight: 600, fontSize: 11 }}>{activeWorkspace.category}</span>
    </Link>
  );
}
