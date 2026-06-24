import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUp, ArrowDown, Lock, CheckCircle2, Sparkles } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/category/$slug")({
  head: () => ({
    meta: [
      { title: "Category Intelligence — RevenueAd" },
      { name: "description", content: "Share of voice and competitive intelligence for an Australian ad category." },
    ],
  }),
  component: CategoryDetailPage,
});

type Reg = { domain: string; category: string | null };
type Placement = { domain: string; created_at: string | null };
type DNA = { brand: string | null; primary_category: string | null; dominant_emotion: string | null };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function brandFromDomain(d: string): string {
  const root = (d ?? "").replace(/^www\./, "").split(/[./]/)[0] ?? d;
  return root.charAt(0).toUpperCase() + root.slice(1);
}
function normalizeDomain(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

const SUB_MAP: Record<string, string> = {
  "general-banking": "Banking",
  "digital-banking": "Banking",
  "business-banking": "Banking",
  "health-insurance": "Insurance",
  "car-insurance": "Insurance",
  "home-insurance": "Insurance",
  "supermarkets": "Retail",
  "department-stores": "Retail",
  "specialty-retail": "Retail",
  "mobile": "Telecommunications",
  "nbn-internet": "Telecommunications",
  "electricity": "Energy",
  "gas": "Energy",
  "airlines": "Travel",
  "booking-platforms": "Travel",
  "passenger-vehicles": "Automotive",
  "ev": "Automotive",
  "saas": "Software",
  "productivity": "Software",
  "real-estate-listings": "Property",
  "agencies": "Property",
  "finance-comparison": "Comparison",
  "insurance-comparison": "Comparison",
  "sports-betting": "Wagering",
  "racing": "Wagering",
  "industry-funds": "Superannuation",
  "retail-funds": "Superannuation",
  "jobs": "Marketplace",
  "vehicles": "Marketplace",
};

function CategoryDetailPage() {
  const { slug } = Route.useParams();
  const parentCategory = SUB_MAP[slug] ?? null;

  const [registry, setRegistry] = useState<Reg[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [dna, setDna] = useState<DNA[]>([]);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: reg }, { data: pl }, { data: d }, { data: ds }] = await Promise.all([
        supabase.from("advertiser_registry").select("domain, category").not("category", "is", null),
        supabase.from("ad_placements").select("domain, created_at").order("created_at", { ascending: false }).limit(2000),
        supabase.from("brand_dna_v2").select("brand, primary_category, dominant_emotion"),
        supabase.from("domain_scans").select("domain"),
      ]);
      if (!active) return;
      setRegistry((reg ?? []) as Reg[]);
      setPlacements((pl ?? []) as Placement[]);
      setDna((d ?? []) as DNA[]);
      setSubscribed(new Set(((ds ?? []) as { domain: string }[]).map((r) => normalizeDomain(r.domain))));
      setLoaded(true);
    })();
    return () => { active = false; };
  }, []);

  // Resolve category name + brand domain list
  const { categoryName, domains } = useMemo(() => {
    const allCategories = Array.from(new Set(registry.map((r) => r.category).filter(Boolean) as string[]));
    const matchByCat = allCategories.find((c) => slugify(c) === slug);
    const resolved = matchByCat ?? parentCategory ?? slug;
    const list = registry.filter((r) => r.category === resolved).map((r) => normalizeDomain(r.domain));
    return { categoryName: resolved, domains: list };
  }, [registry, slug, parentCategory]);

  // Brand-level rows: SOV from placement counts (fallback even distribution), spend proxy
  const brandRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of domains) counts.set(d, 0);
    for (const p of placements) {
      const dom = normalizeDomain(p.domain);
      if (counts.has(dom)) counts.set(dom, (counts.get(dom) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const rows = Array.from(counts.entries()).map(([dom, count]) => {
      const sov = total > 0 ? (count / total) * 100 : 100 / Math.max(1, domains.length);
      const spend = Math.round(count * 850 + (count === 0 ? 0 : 1500));
      const dnaRow = dna.find((d) => d.brand && normalizeDomain(d.brand) === dom);
      const brandLabel = dnaRow?.brand ?? brandFromDomain(dom);
      return {
        domain: dom,
        brand: brandLabel,
        sov,
        spend,
        count,
        theme: dnaRow?.dominant_emotion ?? "Trust",
        trendUp: (count % 2) === 0,
      };
    });
    rows.sort((a, b) => b.sov - a.sov);
    return rows;
  }, [domains, placements, dna]);

  const totalAds = brandRows.reduce((a, b) => a + b.count, 0);
  const totalSpend = brandRows.reduce((a, b) => a + b.spend, 0);

  // Insights
  const themeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of brandRows) m.set(r.theme, (m.get(r.theme) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [brandRows]);

  const dominantTheme = themeCounts[0];
  const contestedTheme = themeCounts.find(([, n]) => n >= 2) ?? themeCounts[0];
  const whitespaceTheme = themeCounts.filter(([, n]) => n === 1).slice(-1)[0];

  const blurredCount = brandRows.filter((r) => !subscribed.has(r.domain)).length;

  return (
    <WorkspaceShell
      title={`${categoryName} — Market Intelligence`}
      subtitle={`${brandRows.length} brands competing · ${totalAds.toLocaleString()} ads tracked · Est. $${totalSpend.toLocaleString()}/mo total`}
    >
      {!loaded ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading market intelligence…</div>
      ) : brandRows.length === 0 ? (
        <div className="card-flat p-12 text-center">
          <div className="text-sm text-muted-foreground">No brands indexed for this category yet.</div>
        </div>
      ) : (
        <>
          {/* SOV LEADERBOARD */}
          <div className="card-flat overflow-hidden">
            <div className="px-5 py-3 border-b-2 border-ink bg-secondary/40 flex items-center justify-between">
              <div className="font-bold tracking-tight">Share of Voice Leaderboard</div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {subscribed.size > 0 ? `${brandRows.filter((r) => subscribed.has(r.domain)).length} subscribed` : "Subscribe to unlock"}
              </div>
            </div>
            <div className="divide-y divide-ink/10">
              <div className="grid grid-cols-[60px_2fr_1fr_1fr_80px_1.5fr] gap-3 px-5 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <div>Rank</div>
                <div>Brand</div>
                <div>SOV%</div>
                <div>Est Spend</div>
                <div>Trend</div>
                <div>Dominant Theme</div>
              </div>
              {brandRows.map((r, i) => {
                const sub = subscribed.has(r.domain);
                return (
                  <div
                    key={r.domain}
                    className={`grid grid-cols-[60px_2fr_1fr_1fr_80px_1.5fr] gap-3 px-5 py-3 items-center text-sm ${
                      sub ? "hover:bg-secondary/40 cursor-pointer" : ""
                    }`}
                  >
                    <div className="mono font-bold">#{i + 1}</div>

                    {/* BRAND */}
                    <div className="flex items-center gap-2 min-w-0">
                      {sub ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Subscribed" />
                          <Link
                            to="/app/advertiser/$domain"
                            params={{ domain: r.brand }}
                            className="font-semibold hover:underline truncate"
                          >
                            {r.brand}
                          </Link>
                        </>
                      ) : (
                        <span className="font-semibold truncate select-none" style={{ filter: "blur(4px)" }}>
                          {r.brand}
                        </span>
                      )}
                    </div>

                    {/* SOV — always visible */}
                    <div className="font-semibold">{r.sov.toFixed(1)}%</div>

                    {/* SPEND */}
                    <div className="mono text-[12px]">
                      {sub ? `$${r.spend.toLocaleString()}` : <span style={{ filter: "blur(4px)" }}>██████</span>}
                    </div>

                    {/* TREND */}
                    <div className={r.trendUp ? "text-emerald-700" : "text-rose-700"}>
                      {r.trendUp ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </div>

                    {/* THEME */}
                    <div className="flex items-center justify-between gap-2">
                      {sub ? (
                        <span className="mono text-[11px] px-2 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                          {r.theme}
                        </span>
                      ) : (
                        <>
                          <span className="mono text-[11px]" style={{ filter: "blur(4px)" }}>██████</span>
                          <Link
                            to="/app/advertisers"
                            className="mono text-[10px] inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Lock size={11} /> Add to watchlist
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INSIGHT CARDS */}
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <InsightCard
              label="Dominant message"
              value={dominantTheme ? dominantTheme[0] : "—"}
              detail={dominantTheme ? `${dominantTheme[1]} brands using it` : "No data"}
              tone="bg-emerald-50 border-emerald-300"
            />
            <InsightCard
              label="Most contested"
              value={contestedTheme ? contestedTheme[0] : "—"}
              detail={contestedTheme ? `${contestedTheme[1]} brands fighting for it` : "No data"}
              tone="bg-amber-50 border-amber-300"
            />
            <InsightCard
              label="Whitespace"
              value={whitespaceTheme ? whitespaceTheme[0] : "—"}
              detail={whitespaceTheme ? `Only ${whitespaceTheme[1]} brand uses this` : "No data"}
              tone="bg-violet-50 border-violet-300"
            />
          </div>

          {/* CTA BANNER */}
          {blurredCount > 0 && (
            <div className="mt-6 card-flat p-5 bg-primary/10 border-primary/30 flex items-center gap-4">
              <Sparkles size={22} className="text-primary shrink-0" />
              <div className="flex-1">
                <div className="font-bold tracking-tight">
                  {blurredCount} competitor{blurredCount === 1 ? "" : "s"} in this category {blurredCount === 1 ? "is" : "are"} hidden.
                </div>
                <div className="text-sm text-muted-foreground">
                  Subscribe to reveal their full intelligence — spend, themes, and live creative.
                </div>
              </div>
              <Link
                to="/app/advertisers"
                className="btn-flat bg-primary text-primary-foreground border-ink hover:opacity-90 inline-flex items-center gap-2 px-4 py-2"
              >
                Upgrade Plan <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {subscribed.size > 0 && blurredCount === 0 && (
            <div className="mt-6 card-flat p-4 flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-emerald-600" />
              You're subscribed to every brand in this category.
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}

function InsightCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className={`card-flat p-5 border-2 ${tone}`}>
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tracking-tight mt-1">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{detail}</div>
    </div>
  );
}
