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
        console.log("categories raw:", raw);

        // Try multiple shapes
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

  const grid = useMemo(() => rows, [rows]);

  return (
    <WorkspaceShell
      title="Categories"
      subtitle="Launch access: Banking, Retail, Insurance, Telco. Additional categories unlock with a category pack."
    >
      {loading ? (
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">
          Reading signal…
        </div>
      ) : grid.length === 0 ? (
        <div className="card-flat p-12 text-center">
          <Grid3x3 size={24} className="mx-auto mb-2 opacity-50" />
          <div className="text-sm text-muted-foreground">Signal incoming. R-AD is reading the market.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
          {grid.map((c) => {
            const unlocked = isLaunchCategory(c.slug) || isLaunchCategory(c.name);
            const inner = (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1C1C1A" }}>{c.name}</div>
                <div style={{ fontSize: 13, color: "#9E9D94", marginTop: 4 }}>
                  {c.brandCount > 0 ? `${c.brandCount} brands` : "Signal incoming"}
                </div>
                {c.leader && unlocked && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1C1C1A", marginTop: 12 }}>
                      Leader: {displayBrand(c.leader)}
                    </div>
                    {c.leaderSov != null && (
                      <div style={{ height: 3, background: "#F0EDE8", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, c.leaderSov)}%`, height: "100%", background: "#C9963A" }} />
                      </div>
                    )}
                  </>
                )}
                {!unlocked && (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#6B6B62",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    <Lock size={12} /> Add category pack · $199/mo
                  </div>
                )}
              </>
            );

            if (!unlocked) {
              return (
                <div
                  key={c.slug}
                  style={{
                    position: "relative",
                    background: "#FFFFFF",
                    border: "1px solid #EBE9E4",
                    borderRadius: 10,
                    padding: 20,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ filter: "blur(5px)", opacity: 0.55, pointerEvents: "none" }}>{inner}</div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      background: "rgba(255,255,255,0.72)",
                    }}
                  >
                    <div style={{ textAlign: "center", padding: 12 }}>
                      <Lock size={18} style={{ margin: "0 auto 8px", color: "#1C1C1A" }} />
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Upgrade to unlock</div>
                      <div style={{ fontSize: 11, color: "#6B6B62", marginTop: 4 }}>Category pack · $199/mo</div>
                    </div>
                  </div>
                </div>
              );
            }

            return (
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
                {inner}
              </Link>
            );
          })}
        </div>
      )}
    </WorkspaceShell>
  );
}
