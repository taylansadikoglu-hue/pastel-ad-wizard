import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

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
        if (!r.client_name || seen.has(r.client_name)) continue;
        seen.add(r.client_name);
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
    <WorkspaceShell title="My Clients" subtitle="Brands you actively manage. Click any client to drill into spend, channels and flight timing.">
      <div className="space-y-6">
        <div className="card-flat p-3 flex items-center gap-2">
          <Search size={15} className="text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search clients…"
            className="border-0 focus-visible:ring-0 shadow-none px-0"
          />
          <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {filtered.length}/{rows.length}
          </span>
        </div>

        {loading ? (
          <div className="card-flat p-12 text-center text-sm text-muted-foreground">Reading signal…</div>
        ) : filtered.length === 0 ? (
          <div className="card-flat p-12 text-center">
            <Users size={28} className="mx-auto text-muted-foreground mb-3" />
            <div className="text-base font-semibold tracking-tight">No clients on your watchlist</div>
            <p className="text-sm text-muted-foreground mt-2">Add brands via onboarding to populate this view.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => (
              <Link
                key={r.client_name}
                to="/app/advertiser/$domain"
                params={{ domain: r.client_name }}
                className="card-flat p-4 hover:bg-secondary transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-bold text-base tracking-tight truncate">{r.client_name}</div>
                  {r.country && (
                    <span className="mono text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">
                      {r.country}
                    </span>
                  )}
                </div>
                {r.client_domain && (
                  <div className="mono text-[11px] text-muted-foreground truncate mt-0.5">{r.client_domain}</div>
                )}
                {r.category && (
                  <div className="mt-3 inline-block px-2 py-0.5 border border-ink rounded-[3px] text-[11px] font-medium">
                    {r.category}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/clients")({
  head: () => ({ meta: [{ title: "My Clients — RevenueAd" }] }),
  component: ClientsPage,
});
