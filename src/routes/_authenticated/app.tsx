import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/adpalette/theme";
import { OnboardingWizard } from "@/components/adpalette/Onboarding";
import { Dashboard } from "@/components/adpalette/Dashboard";
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

type Stage = "loading" | "paywall" | "onboard" | "app";

function AppPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [email, setEmail] = useState("");

  const refresh = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    setEmail(u.user.email ?? "");
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_status, agency_domain")
      .eq("id", u.user.id)
      .maybeSingle();
    if (profile?.stripe_status !== "active") {
      setStage("paywall");
      return;
    }
    setStage(profile?.agency_domain ? "app" : "onboard");
  };

  useEffect(() => {
    refresh();
    // Re-check on tab focus so a successful Stripe redirect updates the gate
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
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
      {stage === "onboard" && <OnboardingWizard onComplete={() => setStage("app")} />}
      {stage === "app" && <Dashboard onLogout={logout} />}
    </ThemeProvider>
  );
}
