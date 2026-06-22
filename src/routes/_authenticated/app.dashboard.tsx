import { createFileRoute } from "@tanstack/react-router";
import { AdMap } from "@/components/adpalette/AdMap";

function DashboardPage() {
  return <AdMap />;
}

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Ad Map — RevenueAd" }] }),
  component: DashboardPage,
});
