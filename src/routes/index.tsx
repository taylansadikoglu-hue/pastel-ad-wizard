import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/adpalette/theme";
import { Landing } from "@/components/adpalette/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevenueAd — See where your competitors spend their ad budgets" },
      { name: "description", content: "RevenueAd tracks every advertising placement across Search, YouTube, Meta, TikTok, and Programmatic. Beautifully simple competitor ad intelligence for agencies." },
      { property: "og:title", content: "RevenueAd — cross-channel ad intelligence for agencies" },
      { property: "og:description", content: "Track competitor ad spend, hooks, and creative velocity across every channel." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  return (
    <ThemeProvider>
      <Landing onEnter={() => navigate({ to: "/auth" })} />
    </ThemeProvider>
  );
}
