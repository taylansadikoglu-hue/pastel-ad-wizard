import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { ThemeProvider } from "./theme";
import { SidebarNav } from "./Dashboard";
import { TopBar } from "./TopBar";
import { supabase } from "@/integrations/supabase/client";

/** Linen app shell — TopBar (52px) + Sidebar (200px) + main canvas. */
export function WorkspaceShell({
  title,
  subtitle,
  children,
  demo = false,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  demo?: boolean;
}) {
  const navigate = useNavigate();
  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col" style={{ background: "var(--canvas)" }}>
        <TopBar demo={demo} />
        <div className="flex flex-1 min-h-0">
          <aside
            className="shrink-0 flex flex-col"
            style={{
              width: 200,
              background: "var(--paper)",
              borderRight: "1px solid var(--hairline)",
            }}
          >
            <div className="flex-1 py-4">
              <SidebarNav />
            </div>
            <button
              onClick={logout}
              className="nav-item"
              style={{ margin: "0 8px 12px", border: "none", background: "none", cursor: "pointer", width: "auto" }}
            >
              <LogOut size={15} strokeWidth={1.5} /> Sign out
            </button>
          </aside>

          <main
            className="flex-1 min-w-0 overflow-auto"
            style={{ padding: "28px 32px" }}
          >
            <div style={{ maxWidth: 1280, margin: "0 auto" }}>
              {(title || subtitle) && (
                <header style={{ marginBottom: 24 }}>
                  {title && <h1>{title}</h1>}
                  {subtitle && (
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 6 }}>
                      {subtitle}
                    </p>
                  )}
                </header>
              )}
              {children ?? (
                <div className="card-linen">
                  <div className="label-eyebrow">Module</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{title}</div>
                  <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                    Section is provisioning. Live data wires up shortly.
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
        <footer
          style={{
            borderTop: "1px solid var(--hairline)",
            background: "var(--paper)",
            padding: "12px 24px",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 16,
            fontSize: 12,
            color: "var(--text-placeholder)",
          }}
        >
          <span style={{ justifySelf: "start" }}>
            <span style={{ color: "var(--text-placeholder)" }}>revenuad</span>
            <span style={{ color: "var(--accent-gold)" }}>.</span>
            <span style={{ marginLeft: 4 }}>signal</span>
          </span>
          <span style={{ color: "var(--text-tertiary, #9E9D94)", fontStyle: "italic" }}>
            Less prep. Better pitches.
          </span>
          <span style={{ justifySelf: "end" }}>© 2026 · Privacy · Terms</span>
        </footer>
      </div>
    </ThemeProvider>
  );
}
