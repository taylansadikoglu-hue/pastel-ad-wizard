import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, ArrowRight, Plus } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { displayBrand } from "@/utils/brandDisplay";

type ClientRow = {
  client_name: string;
  client_domain: string | null;
  category: string | null;
  country: string | null;
};

function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("ra_client_watchlist")
        .select("client_name, client_domain, category, country");
      if (!active) return;
      const seen = new Set<string>();
      const unique: ClientRow[] = [];
      for (const r of (data ?? []) as ClientRow[]) {
        const key = (r.client_name ?? "").trim().toLowerCase();
        if (!key) continue;
        // Hide placeholder/demo seed rows.
        if (key === "demo client" || key === "demo" || r.client_domain === "bendigo.com.au") continue;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(r);
      }
      unique.sort((a, b) => a.client_name.localeCompare(b.client_name));
      setRows(unique);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.client_name?.toLowerCase().includes(term) ||
        r.client_domain?.toLowerCase().includes(term) ||
        r.category?.toLowerCase().includes(term),
    );
  }, [rows, q]);

  return (
    <WorkspaceShell
      title="My clients"
      subtitle="Brands you actively manage. Open the war room for spend, channels and flight timing."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {rows.length > 0 && (
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
            <span
              style={{
                fontSize: 10,
                color: "#9E9D94",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {filtered.length}/{rows.length}
            </span>
          </div>
        )}

        {loading ? (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: 48,
              textAlign: "center",
              color: "#6B6B62",
              fontSize: 13,
            }}
          >
            Reading signal…
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #EBE9E4",
              borderRadius: 10,
              padding: "64px 24px",
              textAlign: "center",
            }}
          >
            <Users size={24} style={{ color: "#C4C2BA", margin: "0 auto 12px" }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A" }}>
              No clients yet.
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#9E9D94",
                marginTop: 6,
                maxWidth: 360,
                margin: "6px auto 0",
                lineHeight: 1.5,
              }}
            >
              Add a client to track their competitors and generate pitch briefs.
            </div>
            <Link
              to="/app/advertisers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 20,
                background: "#C9963A",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 20px",
                borderRadius: 7,
                textDecoration: "none",
              }}
            >
              <Plus size={14} /> Add your first client
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((r) => (
              <Link
                key={r.client_name}
                to="/app/advertiser/$domain"
                params={{ domain: r.client_domain ?? r.client_name }}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #EBE9E4",
                  borderRadius: 10,
                  padding: "16px 20px",
                  textDecoration: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  transition: "border-color 120ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C9963A"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#EBE9E4"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1C1C1A" }}>
                    {displayBrand(r.client_name)}
                  </div>
                  {r.country && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "#9E9D94",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      {r.country}
                    </span>
                  )}
                </div>
                {r.client_domain && (
                  <div style={{ fontSize: 12, color: "#9E9D94" }}>{r.client_domain}</div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 6,
                  }}
                >
                  {r.category ? (
                    <span
                      style={{
                        background: "#FDF6E8",
                        border: "1px solid #E8D5A0",
                        color: "#A07830",
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "3px 10px",
                        borderRadius: 999,
                      }}
                    >
                      {r.category}
                    </span>
                  ) : <span />}
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#C9963A",
                    }}
                  >
                    Open war room <ArrowRight size={12} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/clients")({
  head: () => ({ meta: [{ title: "My clients — RevenuAD Signal" }] }),
  component: ClientsPage,
});
