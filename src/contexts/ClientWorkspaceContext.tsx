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
  createClientWorkspace,
  fetchClientWorkspaces,
  readActiveWorkspaceId,
  writeActiveWorkspaceId,
  type ClientWorkspace,
  type CreateClientWorkspaceInput,
} from "@/lib/clientWorkspace";

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
  const [workspaces, setWorkspaces] = useState<ClientWorkspace[]>([]);
  const [activeId, setActiveId] = useState<number | null>(() => readActiveWorkspaceId());
  const [loading, setLoading] = useState(true);

  const refreshWorkspaces = useCallback(async () => {
    const rows = await fetchClientWorkspaces();
    setWorkspaces(rows);

    const storedId = readActiveWorkspaceId();
    if (storedId && rows.some((w) => w.id === storedId)) {
      setActiveId(storedId);
    } else if (storedId && !rows.some((w) => w.id === storedId)) {
      writeActiveWorkspaceId(null);
      setActiveId(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await refreshWorkspaces();
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: number | null) => {
    writeActiveWorkspaceId(id);
    setActiveId(id);
  }, []);

  const createWorkspace = useCallback(
    async (input: CreateClientWorkspaceInput) => {
      const result = await createClientWorkspace(input);
      if (result.workspace) {
        await refreshWorkspaces();
        setActiveWorkspaceId(result.workspace.id);
      }
      return result;
    },
    [refreshWorkspaces, setActiveWorkspaceId],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId],
  );

  const value = useMemo(
    () => ({
      workspaces,
      activeWorkspace,
      loading,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
    }),
    [workspaces, activeWorkspace, loading, setActiveWorkspaceId, refreshWorkspaces, createWorkspace],
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
