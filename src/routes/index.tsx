import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ThemeProvider } from "@/components/adpalette/theme";
import { Landing } from "@/components/adpalette/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevenueAd — The AI strategist that watches your market 24/7" },
      { name: "description", content: "RevenueAd reads every competitive move, surfaces open territory, and tells your team exactly what to do next — before the morning meeting." },
      { property: "og:title", content: "RevenueAd — AI strategy platform for modern brand teams" },
      { property: "og:description", content: "An AI strategist that watches your market 24/7. Daily briefings, strategic openings, and recommended actions." },
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
