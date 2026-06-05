import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { startScan } from "@/lib/scan.functions";

const MAX_BRANDS = 7;

type Row = { id: string; domain: string; status: string; created_at: string };
type MatrixRow = { id?: string | number; domain?: string; brand?: string; channel?: string; spend?: number; created_at?: string; [k: string]: unknown };

function AdvertisersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data } = await supabase
      .from("domain_scans")
      .select("id, domain, status, created_at")
      .order("created_at", { ascending: false });
    // De-dupe by domain — keep newest
    const seen = new Set<string>();
    const unique: Row[] = [];
    for (const r of data ?? []) {
      if (!seen.has(r.domain)) {
        seen.add(r.domain);
        unique.push(r as Row);
      }
    }
    setRows(unique);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("advertisers-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "domain_scans" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const normalize = (raw: string) =>
    raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  const addDomain = async () => {
    const domain = normalize(input);
    if (!domain || !/\.[a-z]{2,}$/.test(domain)) {
      toast.error("Enter a valid domain (e.g. target.com)");
      return;
    }
    if (rows.length >= MAX_BRANDS) {
      toast.error(`Maximum ${MAX_BRANDS} tracked brands on Agency tier`);
      return;
    }
    if (rows.some((r) => r.domain === domain)) {
      toast.error("Domain already tracked");
      return;
    }
    setBusy(true);
    try {
      await startScan({ data: { domain } });
      setInput("");
      toast.success(`Tracking ${domain}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add domain");
    } finally {
      setBusy(false);
    }
  };

  const removeDomain = async (id: string, domain: string) => {
    const { error } = await supabase.from("domain_scans").delete().eq("domain", domain);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast(`${domain} removed`);
    load();
  };

  return (
    <WorkspaceShell
      title="Advertisers"
      subtitle={`Tracked competitor domains and their fingerprints (${rows.length}/${MAX_BRANDS}).`}
    >
      <div className="space-y-5">
        <div className="card-flat p-4">
          <label className="mono text-[10px] uppercase font-bold block mb-2">
            Add Competitor Domain (e.g., target.com)
          </label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDomain()}
              placeholder="competitor.com"
              className="input-flat mono flex-1"
              disabled={busy || rows.length >= MAX_BRANDS}
            />
            <button
              onClick={addDomain}
              disabled={busy || rows.length >= MAX_BRANDS}
              className="btn-flat btn-primary"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add brand
            </button>
          </div>
          {rows.length >= MAX_BRANDS && (
            <p className="text-xs text-muted-foreground mt-2">
              Agency 7-Pack limit reached. Remove a brand to add a new one.
            </p>
          )}
        </div>

        <div className="card-flat overflow-hidden">
          <div className="px-4 py-3 border-b-2 border-ink bg-secondary mono text-[10px] uppercase font-bold">
            Tracked brands
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No brands tracked yet. Add a competitor domain above to begin.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b-2 border-ink bg-secondary">
                <tr className="text-left">
                  {["Domain", "Status", "Added", ""].map((h) => (
                    <th key={h} className="px-3 py-2 mono text-[10px] uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-ink/30 last:border-0">
                    <td className="px-3 py-2.5 font-semibold">{r.domain}</td>
                    <td className="px-3 py-2.5">
                      <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 mono text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => removeDomain(r.id, r.domain)}
                        className="btn-flat text-[11px] px-2 py-1"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/advertisers")({
  head: () => ({ meta: [{ title: "Advertisers — RevenueAd" }] }),
  component: AdvertisersPage,
});
