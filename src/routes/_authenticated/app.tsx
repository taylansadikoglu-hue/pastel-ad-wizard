import { createFileRoute, useNavigate, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Settings, Home, TrendingUp, Target, ArrowRight } from "lucide-react";
import { ThemeProvider } from "@/components/adpalette/theme";
import { OnboardingWizard } from "@/components/adpalette/Onboarding";
import { StrategistDashboard } from "@/components/adpalette/StrategistDashboard";
import { Paywall } from "@/components/adpalette/Paywall";
import { DemoRouteGuard } from "@/components/adpalette/DemoRouteGuard";
import { supabase } from "@/integrations/supabase/client";
import { resolveDemoUser, seedDemoLocalStorage } from "@/lib/demo-account";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Workspace — RevenuAD Signal" },
      { name: "description", content: "Your competitor ad intelligence workspace." },
    ],
  }),
  component: AppPage,
});

const ADMIN_EMAIL = "hello@revenuad.com";
const ADMIN_CHOICE_KEY = "revenuead_admin_choice";

type Stage = "loading" | "paywall" | "admin_picker" | "onboard" | "app";

function AdminPicker({ email, onPick, onSignOut }: { email: string; onPick: () => void; onSignOut: () => void }) {
  const tiles = [
    { to: "/app/clients", label: "Client Workspaces", desc: "Choose client → competitors → pitch context.", icon: Home, choice: "clients" },
    { to: "/app/pcr", label: "Market Intel", desc: "Snapshot, whitespace, recommended moves.", icon: TrendingUp, choice: "pcr" },
    { to: "/app/advertisers", label: "Ad Library", desc: "Tracked competitor creatives and channel mix.", icon: Target, choice: "advertisers" },
    { to: "/app/categories", label: "Categories", desc: "Launch categories + locked upgrade paths.", icon: TrendingUp, choice: "categories" },
    { to: "/app/settings", label: "Settings", desc: "Agency billing and integrations.", icon: Settings, choice: "settings" },
  ] as const;

  return (
    <div className="min-h-screen bg-canvas text-ink px-6 py-10 grid place-items-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="mono text-[10px] uppercase text-muted-foreground">Admin console</div>
            <h1 className="text-2xl font-bold mt-1">Pick a dashboard, {email}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Admin auto-redirect is disabled. Choose any surface to enter manually.
            </p>
          </div>
          <button onClick={onSignOut} className="btn-flat">Sign out</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tiles.map((t) => (
            <Link
              key={t.choice}
              to={t.to}
              onClick={() => {
                localStorage.setItem(ADMIN_CHOICE_KEY, t.choice);
                if (t.choice === "dashboard") onPick();
              }}
              className="card-flat p-4 hover:shadow-flat-md transition-shadow group"
            >
              <div className="flex items-center justify-between">
                <t.icon size={18} />
                <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="font-bold mt-3">{t.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{t.desc}</div>
            </Link>
          ))}
        </div>
        <button
          onClick={() => {
            localStorage.removeItem(ADMIN_CHOICE_KEY);
            toast("Picker reset");
          }}
          className="mono text-[10px] underline mt-4 block mx-auto"
        >
          Reset choice
        </button>
      </div>
    </div>
  );
}

function AppPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isChildWorkspaceRoute = pathname !== "/app" && pathname !== "/app/";

  const refresh = async () => {
    const demoUnlocked = typeof window !== "undefined" && localStorage.getItem("revenuead_demo_unlocked") === "1";
    const isLocalPreview = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        if (demoUnlocked && isLocalPreview) {
          setEmail("demo@local");
          setStage("app");
          return;
        }
        navigate({ to: "/auth", replace: true });
        return;
      }
      const userEmail = u.user.email ?? "";
      setEmail(userEmail);
      const isAdmin = userEmail.toLowerCase() === ADMIN_EMAIL;
      const isDemo = resolveDemoUser(u.user);

      if (isDemo) seedDemoLocalStorage();

      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_status, agency_domain")
        .eq("id", u.user.id)
        .maybeSingle();

      if (profile?.stripe_status !== "active" && !demoUnlocked && !isDemo) {
        setStage("paywall");
        return;
      }

      // Admin picker only on /app root — child routes (e.g. /app/clients) always render.
      if (isAdmin && !isChildWorkspaceRoute) {
        const choice = localStorage.getItem(ADMIN_CHOICE_KEY);
        if (!choice) {
          setStage("admin_picker");
          return;
        }
      }

      setStage(profile?.agency_domain || isAdmin || demoUnlocked || isDemo ? "app" : "onboard");
    } catch {
      if (demoUnlocked && isLocalPreview) {
        setEmail("demo@local");
        setStage("app");
        return;
      }
      navigate({ to: "/auth", replace: true });
    }
  };

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const logout = async () => {
    localStorage.removeItem(ADMIN_CHOICE_KEY);
    await supabase.auth.signOut();
    toast("Signed out");
    navigate({ to: "/", replace: true });
  };

  return (
    <ThemeProvider>
      {stage === "loading" && (
        <div className="min-h-screen grid place-items-center bg-canvas text-ink">
          <Loader2 className="animate-spin" />
        </div>
      )}
      {stage === "paywall" && <Paywall email={email} onSignOut={logout} />}
      {stage === "admin_picker" && (
        <AdminPicker email={email} onPick={() => setStage("app")} onSignOut={logout} />
      )}
      {stage === "onboard" && <OnboardingWizard onComplete={() => setStage("app")} />}
      {stage === "app" && (
        <DemoRouteGuard>
          {isChildWorkspaceRoute ? <Outlet /> : <StrategistDashboard />}
        </DemoRouteGuard>
      )}
    </ThemeProvider>
  );
}
