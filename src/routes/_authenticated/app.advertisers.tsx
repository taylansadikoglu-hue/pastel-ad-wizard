import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";

export const Route = createFileRoute("/_authenticated/app/advertisers")({
  head: () => ({ meta: [{ title: "Advertisers — RevenueAd" }] }),
  component: () => <WorkspaceShell title="Advertisers" subtitle="Tracked competitor domains and their fingerprints." />,
});
