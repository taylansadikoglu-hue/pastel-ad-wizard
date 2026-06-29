import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ClientWorkspaceProvider } from "@/contexts/ClientWorkspaceContext";
import { DemoAccountProvider } from "@/contexts/DemoAccountContext";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <DemoAccountProvider>
      <ClientWorkspaceProvider>
        <Outlet />
      </ClientWorkspaceProvider>
    </DemoAccountProvider>
  ),
});
