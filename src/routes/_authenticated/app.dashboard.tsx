import { createFileRoute } from "@tanstack/react-router";
import { MorningBrief } from "@/components/adpalette/MorningBrief";

function DashboardPage() {
  return <MorningBrief />;
}

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Morning Brief — RevenueAd" }] }),
  component: DashboardPage,
});
