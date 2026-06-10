import { createFileRoute } from "@tanstack/react-router";
import { StrategistDashboard } from "@/components/adpalette/StrategistDashboard";

function DashboardPage() {
  return <StrategistDashboard />;
}

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RevenueAd" }] }),
  component: DashboardPage,
});
