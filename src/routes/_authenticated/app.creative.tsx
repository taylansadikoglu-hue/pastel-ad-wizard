import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";

export const Route = createFileRoute("/_authenticated/app/creative")({
  head: () => ({ meta: [{ title: "Creative library — RevenueAd" }] }),
  component: () => <WorkspaceShell title="Creative library" subtitle="All scraped creatives across tracked advertisers." />,
});
