import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, Users, ArrowRight, Plus, Check } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { Input } from "@/components/ui/input";
import { useClientWorkspace } from "@/contexts/ClientWorkspaceContext";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
import {
  CATEGORY_OPTIONS,
  normalizeClientDomain,
  parseCompetitorDomains,
} from "@/lib/clientWorkspace";
import { toast } from "sonner";

function ClientsPage() {
  const {
    workspaces,
    activeWorkspace,
    loading,
    setActiveWorkspaceId,
    createWorkspace,
  } = useClientWorkspace();
  const { isDemo, canCreateWorkspace } = useDemoAccount();

  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_name: "",
    client_domain: "",
    category: "Banking",
    competitor_domains: "",
  });

  useEffect(() => {
    if (!loading && workspaces.length === 0 && canCreateWorkspace) {
      setShowForm(true);
    }
  }, [loading, workspaces.length, canCreateWorkspace]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return workspaces;
    return workspaces.filter(
      (w) =>
        w.client_name.toLowerCase().includes(term) ||
        w.client_domain.toLowerCase().includes(term) ||
        w.category.toLowerCase().includes(term) ||
        w.competitor_domains.some((d) => d.toLowerCase().includes(term)),
    );
  }, [workspaces, q]);

  const handleSelect = (id: number) => {
    setActiveWorkspaceId(id);
    toast.success("Client workspace selected");
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.client_name.trim() || !form.client_domain.trim()) {
      toast.error("Client name and domain are required");
      return;
    }
    setSaving(true);
    const result = await createWorkspace({
      client_name: form.client_name.trim(),
      client_domain: normalizeClientDomain(form.client_domain),
      category: form.category,
      competitor_domains: parseCompetitorDomains(form.competitor_domains),
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`${form.client_name} workspace created`);
    setForm({ client_name: "", client_domain: "", category: "Banking", competitor_domains: "" });
    setShowForm(false);
  };

  return (
    <WorkspaceShell
      title="Client Workspaces"
      subtitle="Choose a client workspace — category, domain, and competitors scope Market Intel and the war room."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {canCreateWorkspace && (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: showForm ? "#FDF6E8" : "#FFFFFF",
                border: "1px solid #EBE9E4",
                borderRadius: 7,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                color: "#1C1C1A",
              }}
            >
              <Plus size={14} /> {showForm ? "Hide form" : "Create client"}
            </button>
          )}
          {activeWorkspace && (
            <span style={{ fontSize: 12, color: "#6B6B62" }}>
              Active: <strong>{activeWorkspace.client_name}</strong> · {activeWorkspace.category}
            </span>
          )}
        </div>

        {showForm && canCreateWorkspace && (
          <form
            onSubmit={handleCreate}
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: 20,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>New client workspace</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Client name
                <Input
                  value={form.client_name}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))}
                  placeholder="CommBank"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Client domain
                <Input
                  value={form.client_domain}
                  onChange={(e) => setForm((f) => ({ ...f, client_domain: e.target.value }))}
                  placeholder="commbank.com.au"
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                Category
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  style={{
                    height: 36,
                    borderRadius: 6,
                    border: "1px solid #EBE9E4",
                    padding: "0 10px",
                    fontSize: 13,
                  }}
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Competitor domains (comma or newline separated)
              <textarea
                value={form.competitor_domains}
                onChange={(e) => setForm((f) => ({ ...f, competitor_domains: e.target.value }))}
                placeholder="nab.com.au, anz.com.au, westpac.com.au"
                rows={3}
                style={{
                  borderRadius: 6,
                  border: "1px solid #EBE9E4",
                  padding: 10,
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            </label>
            <div>
              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "#C9963A",
                  color: "#FFF",
                  border: "none",
                  borderRadius: 7,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving…" : "Create workspace"}
              </button>
            </div>
          </form>
        )}

        {workspaces.length > 0 && (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: "8px 14px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Search size={15} style={{ color: "#9E9D94" }} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients…"
              className="border-0 focus-visible:ring-0 shadow-none px-0"
            />
            <span style={{ fontSize: 10, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {filtered.length}/{workspaces.length}
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6B6B62", fontSize: 13 }}>Loading workspaces…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <Users size={24} style={{ color: "#C4C2BA", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A" }}>No client workspaces yet</div>
            <p style={{ fontSize: 13, color: "#9E9D94", marginTop: 6 }}>Create one above to scope Market Intel.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
            {filtered.map((w) => {
              const isActive = activeWorkspace?.id === w.id;
              return (
                <div
                  key={w.id}
                  style={{
                    background: isActive ? "#FDF6E8" : "#FFFFFF",
                    border: isActive ? "1px solid #C9963A" : "1px solid #EBE9E4",
                    borderRadius: 10,
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1C1C1A" }}>{w.client_name}</div>
                      <div style={{ fontSize: 12, color: "#9E9D94", marginTop: 2 }}>{w.client_domain}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#C9963A",
                        background: "#FDF6E8",
                        padding: "4px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {w.category}
                    </span>
                  </div>

                  {w.competitor_domains.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {w.competitor_domains.map((d) => (
                        <span
                          key={d}
                          style={{
                            fontSize: 11,
                            color: "#6B6B62",
                            background: "#F5F4F0",
                            border: "1px solid #EBE9E4",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleSelect(w.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: isActive ? "#C9963A" : "#FFFFFF",
                        color: isActive ? "#FFF" : "#C9963A",
                        border: "1px solid #C9963A",
                        borderRadius: 7,
                        padding: "8px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {isActive ? <Check size={14} /> : null}
                      {isActive ? "Selected" : "Select workspace"}
                    </button>
                    <Link
                      to="/app/pcr"
                      onClick={() => handleSelect(w.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#6B6B62",
                        textDecoration: "none",
                        padding: "8px 4px",
                      }}
                    >
                      Market Intel <ArrowRight size={12} />
                    </Link>
                    <Link
                      to="/app/advertiser/$domain"
                      params={{ domain: w.client_domain }}
                      onClick={() => handleSelect(w.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "#6B6B62",
                        textDecoration: "none",
                        padding: "8px 4px",
                      }}
                    >
                      War room <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/clients")({
  head: () => ({ meta: [{ title: "Client Workspaces — RevenuAD Signal" }] }),
  component: ClientsPage,
});
