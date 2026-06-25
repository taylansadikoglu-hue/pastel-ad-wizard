import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Grid3x3, Layers } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { displayBrand } from "@/utils/brandDisplay";

export const Route = createFileRoute("/_authenticated/app/categories")({
  head: () => ({
    meta: [
      { title: "Categories — RevenuAD Signal" },
      { name: "description", content: "Browse Australian ad intelligence by market category." },
    ],
  }),
  component: CategoriesPage,
});

type RegRow = { domain: string; category: string | null };

const SUB_CATS: Record<string, string[]> = {
  Banking: ["General Banking", "Digital Banking", "Business Banking"],
  Insurance: ["Health Insurance", "Car Insurance", "Home Insurance"],
  Retail: ["Supermarkets", "Department Stores", "Specialty Retail"],
  Telecommunications: ["Mobile", "NBN & Internet"],
  Energy: ["Electricity", "Gas"],
  Travel: ["Airlines", "Booking Platforms"],
  Automotive: ["Passenger Vehicles", "EV"],
  Software: ["SaaS", "Productivity"],
  Property: ["Real Estate Listings", "Agencies"],
  Comparison: ["Finance Comparison", "Insurance Comparison"],
  Wagering: ["Sports Betting", "Racing"],
  Superannuation: ["Industry Funds", "Retail Funds"],
  Marketplace: ["Jobs", "Vehicles"],
};

export function categorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

import { displayBrand } from "@/utils/brandDisplay";
function brandFromDomain(d: string): string {
  const root = (d ?? "").replace(/^www\./, "").split(/[./]/)[0] ?? d;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function activity(n: number): { label: string; tone: string; dot: string } {
  if (n >= 10) return { label: "HIGH", tone: "bg-rose-50 text-rose-700 border-rose-300", dot: "🔴" };
  if (n >= 5) return { label: "MODERATE", tone: "bg-amber-50 text-amber-800 border-amber-300", dot: "🟡" };
  return { label: "LOW", tone: "bg-slate-50 text-slate-600 border-slate-300", dot: "⚪" };
}

function CategoriesPage() {
  const [rows, setRows] = useState<RegRow[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("advertiser_registry")
        .select("domain, category")
        .not("category", "is", null);
      if (!active) return;
      setRows((data ?? []) as RegRow[]);
    })();
    return () => { active = false; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of rows) {
      if (!r.category) continue;
      const arr = map.get(r.category) ?? [];
      arr.push(r.domain);
      map.set(r.category, arr);
    }
    return Array.from(map.entries())
      .map(([cat, domains]) => ({ cat, domains, leader: brandFromDomain(domains[0] ?? "") }))
      .sort((a, b) => b.domains.length - a.domains.length);
  }, [rows]);

  return (
    <WorkspaceShell
      title="Australian Ad Intelligence by Category"
      subtitle="See who dominates every market. Subscribe to competitors to unlock full intelligence."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {grouped.map(({ cat, domains, leader }) => {
          const act = activity(domains.length);
          const isOpen = !!open[cat];
          const subs = SUB_CATS[cat] ?? [`All ${cat}`];
          return (
            <div key={cat} className="card-flat p-5">
              <button
                onClick={() => setOpen((s) => ({ ...s, [cat]: !s[cat] }))}
                className="w-full text-left flex items-start gap-3"
              >
                <div className="w-10 h-10 rounded-[6px] border-2 border-ink bg-secondary grid place-items-center shrink-0">
                  <Layers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold tracking-tight truncate">{cat}</div>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`mono text-[10px] px-1.5 py-0.5 border rounded-[3px] uppercase ${act.tone}`}>
                      {act.dot} {act.label}
                    </span>
                    <span className="mono text-[10px] text-muted-foreground">
                      {domains.length} brand{domains.length === 1 ? "" : "s"} tracked
                    </span>
                  </div>
                  <div className="mt-2 text-[12px] text-muted-foreground">
                    <span className="mono text-[10px] uppercase">#1: </span>
                    <span className="font-semibold text-ink">{leader}</span>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="mt-4 pt-3 border-t-2 border-ink/10 space-y-1.5">
                  <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                    Subcategories
                  </div>
                  {subs.map((sub) => (
                    <Link
                      key={sub}
                      to="/app/category/$slug"
                      params={{ slug: categorySlug(sub === `All ${cat}` ? cat : sub) }}
                      className="flex items-center justify-between px-3 py-2 rounded-[3px] border-2 border-transparent hover:border-ink hover:bg-secondary/60 text-sm"
                    >
                      <span>{sub}</span>
                      <ChevronRight size={14} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {grouped.length === 0 && (
          <div className="col-span-full card-flat p-12 text-center">
            <Grid3x3 size={24} className="mx-auto mb-2 opacity-50" />
            <div className="text-sm text-muted-foreground">No categories indexed yet.</div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
