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
  buildUnlockedPackCategories,
  parseCategoriesApiPayload,
  type CategoryIntel,
} from "@/lib/categoryCatalog";
import { hasFullCategoryAccess } from "@/lib/categoryAccess";
import { supabase } from "@/integrations/supabase/client";

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
  const [fullAccess, setFullAccess] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [{ data: userRes }, apiRes] = await Promise.all([
          supabase.auth.getUser(),
          fetch(`${API_BASE}/api/categories`),
        ]);
        if (active) {
          setFullAccess(hasFullCategoryAccess(userRes.user?.email));
        }
        const raw: unknown = apiRes.ok ? await apiRes.json() : null;
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

  const unlocked = useMemo(() => {
    if (fullAccess) {
      return [...coreCategories, ...buildUnlockedPackCategories()];
    }
    return coreCategories;
  }, [coreCategories, fullAccess]);

  const locked = useMemo(() => (fullAccess ? [] : LOCKED_CATEGORY_ORDER), [fullAccess]);

  return (
    <WorkspaceShell
      title="Categories"
      subtitle={
        fullAccess
          ? "All verticals unlocked on your account — browse any Australian category"
          : "Core verticals included in your plan — expand with category packs when you need more markets"
      }
    >
      {loading ? (
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Loading categories…</div>
      ) : (
        <>
          <section>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1A" }}>
                {fullAccess ? "All categories" : "Core categories"}
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B6B62" }}>
                {fullAccess
                  ? "Banking through FMCG — full intelligence paths for your pitches."
                  : "Banking, Insurance, Telco, and Retail — live benchmarks for your pitches."}
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

          {locked.length > 0 ? (
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
                {locked.map((category) => (
                  <LockedCategoryCard key={category.slug} category={category} />
                ))}
              </div>
            </section>
          ) : null}

          {!fullAccess ? <CategoryPackPricing /> : null}
        </>
      )}
    </WorkspaceShell>
  );
}
