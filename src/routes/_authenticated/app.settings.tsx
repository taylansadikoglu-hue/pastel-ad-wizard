import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — RevenueAd" }] }),
  component: () => <WorkspaceShell title="Settings" subtitle="Workspace, billing, and team preferences." />,
});
