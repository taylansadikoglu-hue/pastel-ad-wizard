import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  COMM_BANK_FALLBACK_WORKSPACE,
  DEMO_FALLBACK_WORKSPACES,
  createClientWorkspace,
  fetchClientWorkspaces,
  readActiveWorkspaceId,
  writeActiveWorkspaceId,
  type ClientWorkspace,
  type CreateClientWorkspaceInput,
} from "@/lib/clientWorkspace";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
import {
  DEMO_WORKSPACE_DOMAIN,
  isDemoShowcaseWorkspace,
  seedDemoLocalStorage,
} from "@/lib/demo-account";
import { withTimeout } from "@/lib/withTimeout";

type ClientWorkspaceContextValue = {
  workspaces: ClientWorkspace[];
  activeWorkspace: ClientWorkspace | null;
  loading: boolean;
  setActiveWorkspaceId: (id: number | null) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (
    input: CreateClientWorkspaceInput,
  ) => Promise<{ workspace: ClientWorkspace | null; error: string | null }>;
};

const ClientWorkspaceContext = createContext<ClientWorkspaceContextValue | null>(null);

export function ClientWorkspaceProvider({ children }: { children: ReactNode }) {
  const { isDemo, loading: demoLoading } = useDemoAccount();
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [activeId, setActiveId] = useState<number | null>(() => readActiveWorkspaceId());
  const [loading, setLoading] = useState(true);
  const [demoFallback, setDemoFallback] = useState(false);

  const refreshWorkspaces = useCallback(async () => {
    const rows = await withTimeout(
      fetchClientWorkspaces(),
      10_000,
      [] as ClientWorkspace[],
      "fetchClientWorkspaces",
    );
    setWorkspaces(rows);

    if (isDemo) {
      const showcase = rows.filter(isDemoShowcaseWorkspace);
      if (showcase.length) {
        setDemoFallback(false);
        const preferred =
          showcase.find((w) => w.client_domain === DEMO_WORKSPACE_DOMAIN) ?? showcase[0]!;
        const storedId = readActiveWorkspaceId();
        const active =
          storedId && showcase.some((w) => w.id === storedId)
            ? showcase.find((w) => w.id === storedId)!
            : preferred;
        seedDemoLocalStorage(active.id);
        setActiveId(active.id);
        return;
      }
      setDemoFallback(true);
      seedDemoLocalStorage(COMM_BANK_FALLBACK_WORKSPACE.id);
      setActiveId(COMM_BANK_FALLBACK_WORKSPACE.id);
      return;
    }

    setDemoFallback(false);
    const storedId = readActiveWorkspaceId();
    if (storedId && rows.some((w) => w.id === storedId)) {
      setActiveId(storedId);
    } else if (storedId && !rows.some((w) => w.id === storedId)) {
      writeActiveWorkspaceId(null);
      setActiveId(null);
    }
  }, [isDemo]);

  useEffect(() => {
    if (demoLoading) return;

    let alive = true;
    setLoading(true);
    (async () => {
      try {
        await refreshWorkspaces();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshWorkspaces, demoLoading]);

  const setActiveWorkspaceId = useCallback(
    (id: number | null) => {
      if (isDemo) {
        const pool = demoFallback
          ? DEMO_FALLBACK_WORKSPACES
          : workspaces.filter(isDemoShowcaseWorkspace);
        const target = pool.find((w) => w.id === id) ?? null;
        if (!target || !isDemoShowcaseWorkspace(target)) return;
      }
      writeActiveWorkspaceId(id);
      setActiveId(id);
    },
    [isDemo, workspaces, demoFallback],
  );

  const createWorkspace = useCallback(
    async (input: CreateClientWorkspaceInput) => {
      if (isDemo) {
        return { workspace: null, error: "Demo accounts cannot create workspaces." };
      }
      const result = await createClientWorkspace(input);
      if (result.workspace) {
        await refreshWorkspaces();
        setActiveWorkspaceId(result.workspace.id);
      }
      return result;
    },
    [isDemo, refreshWorkspaces, setActiveWorkspaceId],
  );

  const visibleWorkspaces = useMemo(() => {
    if (isDemo && demoFallback) return DEMO_FALLBACK_WORKSPACES;
    return isDemo ? workspaces.filter(isDemoShowcaseWorkspace) : workspaces;
  }, [isDemo, workspaces, demoFallback]);

  const activeWorkspace = useMemo(() => {
    if (isDemo && demoFallback) {
      return DEMO_FALLBACK_WORKSPACES.find((w) => w.id === activeId) ?? COMM_BANK_FALLBACK_WORKSPACE;
    }
    const pool = isDemo ? workspaces.filter(isDemoShowcaseWorkspace) : workspaces;
    return pool.find((w) => w.id === activeId) ?? null;
  }, [workspaces, activeId, isDemo, demoFallback]);

  const value = useMemo(
    () => ({
      workspaces: visibleWorkspaces,
      activeWorkspace,
      loading,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
    }),
    [visibleWorkspaces, activeWorkspace, loading, setActiveWorkspaceId, refreshWorkspaces, createWorkspace],
  );

  return (
    <ClientWorkspaceContext.Provider value={value}>{children}</ClientWorkspaceContext.Provider>
  );
}

export function useClientWorkspace(): ClientWorkspaceContextValue {
  const ctx = useContext(ClientWorkspaceContext);
  if (!ctx) {
    throw new Error("useClientWorkspace must be used within ClientWorkspaceProvider");
  }
  return ctx;
}
