import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Grid3x3, Lock } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { displayBrand } from "@/utils/brandDisplay";
import { isLaunchCategory } from "@/lib/pricing-plans";

const API_BASE = "https://api.revenuad.com";

export const Route = createFileRoute("/_authenticated/app/categories")({
  head: () => ({
    meta: [
      { title: "Categories — RevenuAD Signal" },
      { name: "description", content: "Browse Australian ad intelligence by market category." },
    ],
  }),
  component: CategoriesPage,
});

export function categorySlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function humanise(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type CatRow = {
  slug: string;
  name: string;
  brandCount: number;
  leader: string | null;
  leaderSov: number | null;
};

function CategoriesPage() {
  const [rows, setRows] = useState<CatRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/categories`);
        const raw: unknown = r.ok ? await r.json() : null;

        let items: Array<Record<string, unknown> | string> = [];
        if (Array.isArray(raw)) items = raw;
        else if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          if (Array.isArray(o.categories)) items = o.categories as typeof items;
          else if (Array.isArray(o.data)) items = o.data as typeof items;
          else items = Object.entries(o).map(([k, v]) => ({ slug: k, ...(typeof v === "object" && v ? v : {}) }));
        }

        const parsed: CatRow[] = items.map((it) => {
          if (typeof it === "string") {
            return { slug: it, name: humanise(it), brandCount: 0, leader: null, leaderSov: null };
          }
          const slug = String(it.slug ?? it.category ?? it.name ?? "").toLowerCase();
          const name = String(it.name ?? it.label ?? it.category ?? slug);
          const brandCount = Number(it.brand_count ?? it.brands ?? it.count ?? 0);
          let leader: string | null = null;
          let leaderSov: number | null = null;
          const top = it.top_brand ?? it.leader ?? (Array.isArray(it.leaderboard) ? (it.leaderboard as unknown[])[0] : null);
          if (typeof top === "string") leader = top;
          else if (top && typeof top === "object") {
            const t = top as Record<string, unknown>;
            leader = (t.brand ?? t.name ?? t.advertiser ?? null) as string | null;
            const s = Number(t.sov_sightings_pct ?? t.sov ?? t.share);
            if (Number.isFinite(s)) leaderSov = s;
          }
          return { slug: slug || categorySlug(name), name: humanise(name), brandCount, leader, leaderSov };
        }).filter((r) => r.slug);

        parsed.sort((a, b) => b.brandCount - a.brandCount);
        if (active) setRows(parsed);
      } catch (e) {
        console.error("categories fetch failed", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const { unlocked, lockedPreview } = useMemo(() => {
    const unlockedRows = rows.filter((c) => isLaunchCategory(c.slug) || isLaunchCategory(c.name));
    const lockedRows = rows.filter((c) => !isLaunchCategory(c.slug) && !isLaunchCategory(c.name));
    return {
      unlocked: unlockedRows,
      lockedPreview: lockedRows.slice(0, 3),
    };
  }, [rows]);

  return (
    <WorkspaceShell
      title="Categories"
      subtitle="Category benchmarks for Banking, Retail, Insurance, and Telco — included in your plan"
    >
      {loading ? (
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">
          Loading categories…
        </div>
      ) : rows.length === 0 ? (
        <div className="card-flat p-12 text-center max-w-lg mx-auto">
          <Grid3x3 size={24} className="mx-auto mb-3 opacity-50" />
          <div className="text-base font-semibold text-foreground mb-2">Category benchmarks not indexed yet</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Add competitors to a client watchlist and run a scan. Category cards appear once enough brands are tracked in the market.
          </p>
        </div>
      ) : unlocked.length === 0 ? (
        <div className="card-flat p-12 text-center max-w-lg mx-auto">
          <Grid3x3 size={24} className="mx-auto mb-3 opacity-50" />
          <div className="text-base font-semibold text-foreground mb-2">Your plan categories are ready</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Banking, Retail, Insurance, and Telco unlock automatically. Additional verticals need a category pack — contact us to add one.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {unlocked.map((c) => (
              <Link
                key={c.slug}
                to="/app/category/$slug"
                params={{ slug: c.slug }}
                style={{
                  display: "block",
                  background: "#FFFFFF",
                  border: "1px solid #EBE9E4",
                  borderRadius: 10,
                  padding: 20,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "border-color 120ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D4C4A0"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#EBE9E4"; }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A" }}>{c.name}</div>
                <div style={{ fontSize: 13, color: "#9E9D94", marginTop: 4 }}>
                  {c.brandCount > 0
                    ? `${c.brandCount} brands tracked`
                    : "Add brands to your watchlist to populate this category"}
                </div>
                {c.leader && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1C1C1A", marginTop: 12 }}>
                      Leading: {displayBrand(c.leader)}
                    </div>
                    {c.leaderSov != null && (
                      <div style={{ height: 3, background: "#F0EDE8", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, c.leaderSov)}%`, height: "100%", background: "#C9963A" }} />
                      </div>
                    )}
                  </>
                )}
              </Link>
            ))}
          </div>

          {lockedPreview.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A", marginBottom: 12 }}>
                More categories
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {lockedPreview.map((c) => (
                  <div
                    key={c.slug}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: "#F7F6F3",
                      border: "1px solid #EBE9E4",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#6B6B62",
                    }}
                  >
                    <Lock size={13} />
                    <span>{c.name}</span>
                    <span style={{ fontSize: 11, color: "#9E9D94" }}>Category pack</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: "#9E9D94", marginTop: 10 }}>
                Additional verticals unlock with a category pack. Your core categories above are ready to use today.
              </p>
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
