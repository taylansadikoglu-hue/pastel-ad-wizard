import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/adpalette/theme";
import { Landing } from "@/components/adpalette/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevenueAd — See where your competitors are spending" },
      { name: "description", content: "RevenueAd tracks every paid ad across Meta and Google — showing you spend estimates, winning creatives, and where the market opportunity is." },
      { property: "og:title", content: "RevenueAd — Competitive spend intelligence for Meta & Google" },
      { property: "og:description", content: "Spend estimates, longest-running creatives, channel allocation, and one-click PDF briefs for every competitor you track." },
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
