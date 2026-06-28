import { ReactNode, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut, Presentation } from "lucide-react";
import { ThemeProvider } from "./theme";
import { SidebarNav } from "./Dashboard";
import { TopBar } from "./TopBar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Linen app shell — TopBar (52px) + Sidebar (200px) + main canvas. */
export function WorkspaceShell({
  title,
  subtitle,
  children,
  variant = "default",
  onExportPitch,
  exportPitchDisabled = false,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  variant?: "default" | "dark-dense";
  /** When set, shows Export PPTX in the header (strategist cockpit). */
  onExportPitch?: () => void | Promise<void>;
  exportPitchDisabled?: boolean;
}) {
  const isDense = variant === "dark-dense";
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const handleExportPitch = async () => {
    if (!onExportPitch || exporting) return;
    setExporting(true);
    try {
      await onExportPitch();
    } finally {
      setExporting(false);
    }
  };
  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <ThemeProvider>
      <div
        className={cn("min-h-screen flex flex-col", isDense && "dark-dense bg-neutral-950 text-neutral-100")}
        style={isDense ? undefined : { background: "var(--canvas)" }}
      >
        <TopBar />
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
            style={{ padding: isDense ? "12px 16px" : "28px 32px" }}
          >
            <div style={{ maxWidth: isDense ? 1440 : 1280, margin: "0 auto" }}>
              {(title || subtitle || onExportPitch) && (
                <header
                  className={cn(onExportPitch && "flex items-start justify-between gap-4")}
                  style={{ marginBottom: isDense ? 10 : 24 }}
                >
                  <div className="min-w-0">
                    {title && (isDense ? <h1 className="text-base font-semibold tracking-tight">{title}</h1> : <h1>{title}</h1>)}
                    {subtitle && (
                      <p className={cn(isDense && "dense-meta mt-1")} style={isDense ? undefined : { color: "var(--text-secondary)", fontSize: 13, marginTop: 6 }}>
                        {subtitle}
                      </p>
                    )}
                  </div>
                  {onExportPitch && (
                    <button
                      type="button"
                      onClick={handleExportPitch}
                      disabled={exporting || exportPitchDisabled}
                      className={cn(
                        "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-colors",
                        isDense
                          ? "dense-chip border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800 disabled:opacity-50"
                          : "border-[var(--hairline)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--canvas)] disabled:opacity-50",
                      )}
                      style={isDense ? undefined : { fontSize: 12, fontWeight: 500, cursor: exporting || exportPitchDisabled ? "not-allowed" : "pointer" }}
                    >
                      {exporting ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />}
                      {exporting ? "Building deck…" : "Export PPTX"}
                    </button>
                  )}
                </header>
              )}
              {children ?? (
                <div className="card-linen">
                  <div className="label-eyebrow">Module</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6 }}>{title}</div>
                  <p style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                    This section is loading. Check back shortly.
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
