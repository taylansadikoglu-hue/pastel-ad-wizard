import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ThemeProvider } from "@/components/adpalette/theme";
import { OnboardingWizard } from "@/components/adpalette/Onboarding";
import { Dashboard } from "@/components/adpalette/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/lib/integrations.functions";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Workspace — RevenueAd" },
      { name: "description", content: "Your competitor ad intelligence workspace." },
    ],
  }),
  component: AppPage,
});

function AppPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<"loading" | "onboard" | "app">("loading");

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((p) => {
        if (cancelled) return;
        setStage(p?.agency_domain ? "app" : "onboard");
      })
      .catch(() => !cancelled && setStage("onboard"));
    return () => {
      cancelled = true;
    };
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
      {stage === "onboard" && <OnboardingWizard onComplete={() => setStage("app")} />}
      {stage === "app" && <Dashboard onLogout={logout} />}
    </ThemeProvider>
  );
}
