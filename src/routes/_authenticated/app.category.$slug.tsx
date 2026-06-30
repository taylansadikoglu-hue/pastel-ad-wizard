import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUp, ArrowDown, Lock, CheckCircle2 } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { SpendIndex } from "@/components/adpalette/SpendIndex";
import {
  CORE_CATEGORY_SEED_BRANDS,
  CORE_FALLBACKS,
  resolveCoreCategorySlug,
} from "@/lib/categoryCatalog";
import { displayBrand, spendLevel } from "@/utils/brandDisplay";

export const Route = createFileRoute("/_authenticated/app/category/$slug")({
  head: () => ({
    meta: [
      { title: "Category Intelligence — RevenuAD Signal" },
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
  return displayBrand(d);
}
function normalizeDomain(d: string | null | undefined): string {
  return (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

const SUB_MAP: Record<string, string> = {
  automotive: "Automotive",
  superannuation: "Superannuation",
  travel: "Travel",
  energy: "Energy",
  property: "Property",
  fmcg: "FMCG",
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
  telco: "Telco",
  telecommunications: "Telecommunications",
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

  const { categoryName, domains, coreSlug, isPreview } = useMemo(() => {
    const allCategories = Array.from(new Set(registry.map((r) => r.category).filter(Boolean) as string[]));
    const matchByCat = allCategories.find((c) => slugify(c) === slug);
    const core = resolveCoreCategorySlug(slug) ?? resolveCoreCategorySlug(parentCategory ?? "");
    const resolved = matchByCat ?? parentCategory ?? (core ? CORE_FALLBACKS[core].name : slug);
    let list = registry.filter((r) => r.category === resolved).map((r) => normalizeDomain(r.domain));
    let preview = false;
    if (list.length === 0 && core) {
      list = CORE_CATEGORY_SEED_BRANDS[core].map((b) => normalizeDomain(b.domain));
      preview = true;
    }
    return { categoryName: resolved, domains: list, coreSlug: core, isPreview: preview };
  }, [registry, slug, parentCategory]);

  const brandRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of domains) counts.set(d, 0);
    for (const p of placements) {
      const dom = normalizeDomain(p.domain);
      if (counts.has(dom)) counts.set(dom, (counts.get(dom) ?? 0) + 1);
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const seedWeights = coreSlug ? CORE_CATEGORY_SEED_BRANDS[coreSlug] : null;
    const rows = Array.from(counts.entries()).map(([dom, count], index) => {
      const seed = seedWeights?.find((b) => normalizeDomain(b.domain) === dom);
      const sov =
        total > 0
          ? (count / total) * 100
          : seedWeights
            ? Math.max(8, 32 - index * 5)
            : 100 / Math.max(1, domains.length);
      const spend = Math.round(count * 850 + (count === 0 ? (isPreview ? 12000 - index * 1500 : 0) : 1500));
      const dnaRow = dna.find((d) => d.brand && normalizeDomain(d.brand) === dom);
      const brandLabel = dnaRow?.brand ?? seed?.name ?? brandFromDomain(dom);
      return {
        domain: dom,
        brand: brandLabel,
        sov,
        spend,
        count,
        theme: dnaRow?.dominant_emotion ?? (index === 0 ? "Trust" : index === 1 ? "Value" : "Innovation"),
        trendUp: (count % 2) === 0 || (isPreview && index % 2 === 0),
        preview: isPreview && count === 0,
      };
    });
    rows.sort((a, b) => b.sov - a.sov);
    return rows;
  }, [domains, placements, dna, coreSlug, isPreview]);

  const totalAds = brandRows.reduce((a, b) => a + b.count, 0);
  const totalSpend = brandRows.reduce((a, b) => a + b.spend, 0);

  const themeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of brandRows) m.set(r.theme, (m.get(r.theme) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [brandRows]);

  const dominantTheme = themeCounts[0];
  const contestedTheme = themeCounts.find(([, n]) => n >= 2) ?? themeCounts[0];
  const openAngleTheme = themeCounts.filter(([, n]) => n === 1).slice(-1)[0];

  const trackedRows = brandRows.filter((r) => r.count > 0);
  const blurredCount = brandRows.filter((r) => !subscribed.has(r.domain)).length;

  return (
    <WorkspaceShell
      title={`${categoryName} — Category intel`}
      subtitle={
        trackedRows.length > 0
          ? `${trackedRows.length} brands with activity · ${totalAds.toLocaleString()} ads tracked · Est. $${totalSpend.toLocaleString()}/mo total`
          : isPreview
            ? `${brandRows.length} benchmark brands · category preview until ads are indexed`
            : `${categoryName} category — add brands to your watchlist to start benchmarking`
      }
    >
      {!loaded ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading category intel…</div>
      ) : brandRows.length === 0 ? (
        <div className="card-flat p-12 text-center max-w-lg mx-auto">
          <div className="text-base font-semibold text-foreground mb-2">Category intel builds as you track brands</div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            We don&apos;t have enough indexed ads in {categoryName} yet. Add competitors from this category to your client watchlist and run a scan — you&apos;ll get share of activity, messaging patterns, and open angles here.
          </p>
          <Link
            to="/app/clients"
            className="btn-flat bg-primary text-primary-foreground border-ink hover:opacity-90 inline-flex items-center gap-2 px-4 py-2 text-sm"
          >
            Go to client workspaces <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {isPreview && (
            <div className="mb-4 card-flat p-4 bg-amber-50 border-amber-200 text-sm text-amber-950">
              <strong>Category preview</strong> — benchmark brands for {categoryName}. Share and spend are directional until ads are indexed for this category.
            </div>
          )}
          <div className="card-flat overflow-hidden">
            <div className="px-5 py-3 border-b-2 border-ink bg-secondary/40 flex items-center justify-between">
              <div className="font-bold tracking-tight">Share of observed activity</div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {subscribed.size > 0 ? `${brandRows.filter((r) => subscribed.has(r.domain)).length} on your watchlist` : "Add brands to unlock detail"}
              </div>
            </div>
            <div className="divide-y divide-ink/10">
              <div className="grid grid-cols-[60px_2fr_1fr_1fr_80px_1.5fr] gap-3 px-5 py-2 mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <div>Rank</div>
                <div>Brand</div>
                <div>Share</div>
                <div>Est spend</div>
                <div>Trend</div>
                <div>Top message</div>
              </div>
              {brandRows.map((r, i) => {
                const sub = subscribed.has(r.domain);
                return (
                  <div
                    key={r.domain}
                    className={`grid grid-cols-[60px_2fr_1fr_1fr_80px_1.5fr] gap-3 px-5 py-3 items-center text-sm ${
                      sub ? "hover:bg-secondary/40 cursor-pointer" : ""
                    } ${r.preview ? "opacity-90" : ""}`}
                  >
                    <div className="mono font-bold">#{i + 1}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      {sub ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="On watchlist" />
                          <Link
                            to="/app/advertiser/$domain"
                            params={{ domain: r.domain }}
                            className="font-semibold hover:underline truncate"
                          >
                            {displayBrand(r.brand)}
                          </Link>
                        </>
                      ) : (
                        <>
                          <span className="font-semibold truncate text-muted-foreground">{displayBrand(r.brand)}</span>
                          <Link
                            to="/app/clients"
                            className="mono text-[10px] inline-flex items-center gap-1 text-primary hover:underline shrink-0"
                          >
                            <Lock size={11} /> Add to watchlist
                          </Link>
                        </>
                      )}
                    </div>
                    <div className="font-semibold">{r.sov.toFixed(1)}%</div>
                    <div>
                      {sub ? <SpendIndex level={spendLevel(r.spend)} label="" /> : <span className="text-muted-foreground text-xs">Add to view</span>}
                    </div>
                    <div className={r.trendUp ? "text-emerald-700" : "text-rose-700"}>
                      {r.trendUp ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </div>
                    <div>
                      {sub ? (
                        <span className="mono text-[11px] px-2 py-0.5 border-2 border-ink rounded-[3px] bg-paper capitalize">
                          {r.theme}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground capitalize">{r.theme}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <InsightCard
              label="What everyone says"
              value={dominantTheme ? dominantTheme[0] : "—"}
              detail={dominantTheme ? `${dominantTheme[1]} brands lead with this message` : "Patterns appear as more brands are tracked"}
              tone="bg-violet-50 border-violet-300"
            />
            <InsightCard
              label="Where they're fighting"
              value={contestedTheme ? contestedTheme[0] : "—"}
              detail={contestedTheme ? `${contestedTheme[1]} brands competing on the same angle` : "Add competitors to see contested ground"}
              tone="bg-amber-50 border-amber-300"
            />
            <InsightCard
              label="Open angle"
              value={openAngleTheme ? openAngleTheme[0] : "—"}
              detail={openAngleTheme ? `Only ${openAngleTheme[1]} brand uses this — room to own it` : "Unclaimed messages surface with more data"}
              tone="bg-emerald-50 border-emerald-300"
            />
          </div>

          {blurredCount > 0 && (
            <div className="mt-6 card-flat p-5 bg-secondary/30 border border-border flex items-center gap-4">
              <div className="flex-1">
                <div className="font-bold tracking-tight">
                  {blurredCount} competitor{blurredCount === 1 ? "" : "s"} in this category not on your watchlist
                </div>
                <div className="text-sm text-muted-foreground">
                  Add them to a client workspace for full ad library detail — spend signals, creative themes, and channel mix.
                </div>
              </div>
              <Link
                to="/app/clients"
                className="btn-flat bg-primary text-primary-foreground border-ink hover:opacity-90 inline-flex items-center gap-2 px-4 py-2 shrink-0"
              >
                Add brands <ArrowRight size={14} />
              </Link>
            </div>
          )}

          {subscribed.size > 0 && blurredCount === 0 && (
            <div className="mt-6 card-flat p-4 flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Every active brand in this category is on your watchlist.
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
      <div className="text-xl font-bold tracking-tight mt-1 capitalize">{value}</div>
      <div className="text-[12px] text-muted-foreground mt-1">{detail}</div>
    </div>
  );
}
