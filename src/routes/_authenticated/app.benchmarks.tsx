import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";

export const Route = createFileRoute("/_authenticated/app/benchmarks")({
  head: () => ({ meta: [{ title: "Benchmarks — RevenueAd" }] }),
  component: () => <WorkspaceShell title="Benchmarks" subtitle="Category-level spend and channel-mix benchmarks." />,
});
