import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ThemeProvider } from "@/components/adpalette/theme";
import { OnboardingWizard } from "@/components/adpalette/Onboarding";
import { Dashboard } from "@/components/adpalette/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AdPalette — cross-channel ad intelligence for agencies" },
      { name: "description", content: "AdPalette gives ad agencies x-ray vision into every rival creative running on Meta, Google, TikTok, and programmatic networks." },
      { property: "og:title", content: "AdPalette — cross-channel ad intelligence" },
      { property: "og:description", content: "Track rival ad spend, hooks, and creative velocity across every channel." },
    ],
  }),
  component: Index,
});

function Index() {
  const [stage, setStage] = useState<"onboard" | "app">("onboard");
  return (
    <ThemeProvider>
      {stage === "onboard"
        ? <OnboardingWizard onComplete={() => setStage("app")} />
        : <Dashboard onLogout={() => setStage("onboard")} />}
    </ThemeProvider>
  );
}
