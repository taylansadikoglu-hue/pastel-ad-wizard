import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEMO_PERMISSIONS,
  resolveDemoUser,
  seedDemoLocalStorage,
  type DemoPermissions,
} from "@/lib/demo-account";

type DemoAccountContextValue = {
  isDemo: boolean;
  loading: boolean;
  permissions: DemoPermissions | null;
  canExport: boolean;
  canScan: boolean;
  canEdit: boolean;
  canCreateWorkspace: boolean;
  refreshDemoState: () => Promise<void>;
};

const DemoAccountContext = createContext<DemoAccountContextValue | null>(null);

export function DemoAccountProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshDemoState = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const demo = resolveDemoUser(data.user);
    setIsDemo(demo);
    if (demo) seedDemoLocalStorage();
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshDemoState();
      if (!alive) return;
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshDemoState();
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshDemoState]);

  const value = useMemo<DemoAccountContextValue>(
    () => ({
      isDemo,
      loading,
      permissions: isDemo ? DEMO_PERMISSIONS : null,
      canExport: !isDemo,
      canScan: !isDemo,
      canEdit: !isDemo,
      canCreateWorkspace: !isDemo,
      refreshDemoState,
    }),
    [isDemo, loading, refreshDemoState],
  );

  return <DemoAccountContext.Provider value={value}>{children}</DemoAccountContext.Provider>;
}

export function useDemoAccount(): DemoAccountContextValue {
  const ctx = useContext(DemoAccountContext);
  if (!ctx) {
    throw new Error("useDemoAccount must be used within DemoAccountProvider");
  }
  return ctx;
}
