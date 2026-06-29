import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
import { isDemoRouteAllowed } from "@/lib/demo-account";
import { DemoRouteRestricted } from "@/components/adpalette/DemoRestricted";

export function DemoRouteGuard({ children }: { children: ReactNode }) {
  const { isDemo, loading } = useDemoAccount();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const allowed = isDemoRouteAllowed(pathname);

  useEffect(() => {
    if (loading || !isDemo || allowed) return;
    navigate({ to: "/app/pcr", replace: true });
  }, [allowed, isDemo, loading, navigate]);

  if (loading) return null;
  if (isDemo && !allowed) {
    return <DemoRouteRestricted />;
  }
  return <>{children}</>;
}
