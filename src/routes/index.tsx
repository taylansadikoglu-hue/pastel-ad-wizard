import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ThemeProvider } from "@/components/adpalette/theme";
import { Landing } from "@/components/adpalette/Landing";
import { OnboardingWizard } from "@/components/adpalette/Onboarding";
import { Dashboard } from "@/components/adpalette/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPalette — See where your competitors spend their ad budgets" },
      { name: "description", content: "AdPalette tracks every advertising placement across Search, YouTube, Meta, TikTok, and Programmatic. Beautifully simple competitor analysis for agencies." },
      { property: "og:title", content: "AdPalette — cross-channel ad intelligence for agencies" },
      { property: "og:description", content: "Track competitor ad spend, hooks, and creative velocity across every channel." },
    ],
  }),
  component: Index,
});

type Stage = "landing" | "onboard" | "app";

function Index() {
  const [stage, setStage] = useState<Stage>("landing");
  return (
    <ThemeProvider>
      {stage === "landing" && <Landing onEnter={() => setStage("onboard")} />}
      {stage === "onboard" && <OnboardingWizard onComplete={() => setStage("app")} />}
      {stage === "app" && <Dashboard onLogout={() => setStage("landing")} />}
    </ThemeProvider>
  );
}
