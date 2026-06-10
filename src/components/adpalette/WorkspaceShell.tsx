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
        <aside className="w-64 shrink-0 border-r border-ink bg-paper/60 backdrop-blur-sm flex flex-col">
          <div className="px-5 py-5 border-b border-ink flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-primary grid place-items-center">
              <span className="mono text-[11px] font-bold">R-AD</span>
            </div>
            <div>
              <div className="font-semibold leading-tight tracking-tight">RevenueAd</div>
              <div className="mono text-[10px] text-muted-foreground uppercase tracking-widest">Workspace</div>
            </div>
          </div>
          <SidebarNav />
          <button onClick={logout} className="m-4 btn-flat justify-start">
            <LogOut size={14} /> Sign out
          </button>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b border-ink bg-paper/70 backdrop-blur-sm px-10 py-8">
            <div className="mono text-[10px] text-muted-foreground uppercase tracking-widest">Workspace</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2">{title}</h1>
            {subtitle && <p className="text-base text-muted-foreground mt-2 max-w-3xl leading-relaxed">{subtitle}</p>}
          </header>
          <main className="flex-1 overflow-auto px-10 py-10">
            {children ?? (
              <div className="card-flat p-12 text-center">
                <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">Module scaffold</div>
                <div className="text-xl font-semibold mt-3 tracking-tight">{title} workspace is provisioning.</div>
                <p className="text-sm text-muted-foreground mt-2">Live data wiring lands in the next sprint.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
