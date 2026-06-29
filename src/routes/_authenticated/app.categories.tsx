import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import {
  CategoryPackPricing,
  LockedCategoryCard,
  UnlockedCategoryCard,
} from "@/components/adpalette/CategoryCards";
import {
  LOCKED_CATEGORY_ORDER,
  buildCoreCategories,
  parseCategoriesApiPayload,
  type CategoryIntel,
} from "@/lib/categoryCatalog";

const API_BASE = "https://api.revenuad.com";

export { categorySlug } from "@/lib/categoryCatalog";

export const Route = createFileRoute("/_authenticated/app/categories")({
  head: () => ({
    meta: [
      { title: "Categories — RevenuAD Signal" },
      { name: "description", content: "Browse Australian ad intelligence by market category." },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const [coreCategories, setCoreCategories] = useState<CategoryIntel[]>(() => buildCoreCategories([]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/categories`);
        const raw: unknown = r.ok ? await r.json() : null;
        const rows = parseCategoriesApiPayload(raw);
        if (active) setCoreCategories(buildCoreCategories(rows));
      } catch (e) {
        console.error("categories fetch failed", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const unlocked = useMemo(() => coreCategories, [coreCategories]);

  return (
    <WorkspaceShell
      title="Categories"
      subtitle="Core verticals included in your plan — expand with category packs when you need more markets"
    >
      {loading ? (
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading categories…</div>
      ) : (
        <>
          <section>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>Core categories</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6B62" }}>
                Banking, Insurance, Telco, and Retail — live benchmarks for your pitches.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {unlocked.map((category) => (
                <UnlockedCategoryCard key={category.slug} category={category} />
              ))}
            </div>
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>Locked categories</div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6B62" }}>
                Preview what unlocks with a category pack — full intelligence behind the blur.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
              {LOCKED_CATEGORY_ORDER.map((category) => (
                <LockedCategoryCard key={category.slug} category={category} />
              ))}
            </div>
          </section>

          <CategoryPackPricing />
        </>
      )}
    </WorkspaceShell>
  );
}
