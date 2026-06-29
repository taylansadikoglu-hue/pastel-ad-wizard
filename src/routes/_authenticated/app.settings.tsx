import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsSettings } from "@/components/adpalette/IntegrationsSettings";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — RevenuAD Signal" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <WorkspaceShell title="Settings" subtitle="Integrations and workspace preferences.">
      <IntegrationsSettings />
    </WorkspaceShell>
  );
}
