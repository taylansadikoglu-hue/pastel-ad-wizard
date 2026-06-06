import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Dashboard } from "@/components/adpalette/Dashboard";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_CHOICE_KEY = "revenuead_admin_choice";

function DashboardPage() {
  const navigate = useNavigate();

  const logout = async () => {
    localStorage.removeItem(ADMIN_CHOICE_KEY);
    await supabase.auth.signOut();
    toast("Signed out");
    navigate({ to: "/", replace: true });
  };

  return <Dashboard onLogout={logout} />;
}

export const Route = createFileRoute("/_authenticated/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RevenueAd" }] }),
  component: DashboardPage,
});