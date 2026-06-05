import { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { ThemeProvider } from "./theme";
import { SidebarNav } from "./Dashboard";
import { supabase } from "@/integrations/supabase/client";

export function WorkspaceShell({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas text-ink flex">
        <aside className="w-60 shrink-0 border-r-2 border-ink bg-paper flex flex-col">
          <div className="p-4 border-b-2 border-ink flex items-center gap-2">
            <div className="px-1.5 h-8 border-2 border-ink rounded-[4px] bg-primary grid place-items-center">
              <span className="mono text-[11px] font-bold">R-AD</span>
            </div>
            <div>
              <div className="font-bold leading-tight">RevenueAd</div>
              <div className="mono text-[10px] text-muted-foreground">workspace</div>
            </div>
          </div>
          <SidebarNav />
          <button onClick={logout} className="m-3 btn-flat justify-start">
            <LogOut size={14} /> Sign out
          </button>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b-2 border-ink bg-paper px-6 py-4">
            <div className="mono text-[10px] text-muted-foreground uppercase">Workspace</div>
            <h1 className="text-2xl font-bold mt-1">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children ?? (
              <div className="card-flat p-10 text-center">
                <div className="mono text-[10px] uppercase text-muted-foreground">Module scaffold</div>
                <div className="text-lg font-semibold mt-2">{title} workspace is provisioning.</div>
                <p className="text-sm text-muted-foreground mt-1">Live data wiring lands in the next sprint.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
