import { createFileRoute, useNavigate, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Radio, Target, TrendingUp, Settings, Home, ArrowRight } from "lucide-react";
import { ThemeProvider } from "@/components/adpalette/theme";
import { OnboardingWizard } from "@/components/adpalette/Onboarding";
import { StrategistDashboard } from "@/components/adpalette/StrategistDashboard";
import { Paywall } from "@/components/adpalette/Paywall";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Workspace — RevenueAd" },
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
    { to: "/app", label: "Dashboard", desc: "Strategist cockpit — coverage, pipeline, opportunities.", icon: Home, choice: "dashboard" },
    { to: "/app/advertisers", label: "Brand Intelligence", desc: "Tracked competitor domains + brand DNA.", icon: Target, choice: "advertisers" },
    { to: "/app/pcr", label: "Market Intelligence", desc: "Category leaders, share of voice, positioning.", icon: TrendingUp, choice: "pcr" },
    { to: "/app/sentiment", label: "Audience Signals", desc: "Emotion ownership and territory gaps.", icon: Radio, choice: "sentiment" },
    { to: "/app/advisor", label: "Strategic Advisor", desc: "Pitch recommendations and next moves.", icon: ArrowRight, choice: "advisor" },
    { to: "/app/settings", label: "Settings", desc: "Workspace and integrations.", icon: Settings, choice: "settings" },
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
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/app";
  const isChildWorkspaceRoute = pathname !== "/app";

  const refresh = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    const userEmail = u.user.email ?? "";
    setEmail(userEmail);
    const isAdmin = userEmail.toLowerCase() === ADMIN_EMAIL;

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_status, agency_domain")
      .eq("id", u.user.id)
      .maybeSingle();

    const demoUnlocked = typeof window !== "undefined" && localStorage.getItem("revenuead_demo_unlocked") === "1";
    if (profile?.stripe_status !== "active" && !demoUnlocked) {
      setStage("paywall");
      return;
    }

    // Admin: no auto-redirect — explicit picker, unless a choice is already stored
    if (isAdmin) {
      const choice = typeof window !== "undefined" ? localStorage.getItem(ADMIN_CHOICE_KEY) : null;
      if (!choice) {
        setStage("admin_picker");
        return;
      }
      setStage("app");
      return;
    }

    setStage(profile?.agency_domain ? "app" : "onboard");
  };

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {stage === "app" && (isChildWorkspaceRoute ? <Outlet /> : <StrategistDashboard />)}
    </ThemeProvider>
  );
}
