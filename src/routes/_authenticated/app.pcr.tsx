import { createFileRoute } from "@tanstack/react-router";
import { StrategistDashboard } from "@/components/adpalette/StrategistDashboard";

export const Route = createFileRoute("/_authenticated/app/pcr")({
  head: () => ({ meta: [{ title: "Morning Signal — RevenuAD Signal" }] }),
  component: StrategistDashboard,
});
