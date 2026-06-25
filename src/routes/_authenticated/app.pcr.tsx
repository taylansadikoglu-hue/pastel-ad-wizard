import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import { displayBrand } from "@/utils/brandDisplay";

type CategoryOwnership = {
  category: string | null;
  domain: string | null;
  placements: number | null;
  share_of_voice: number | null;
};
type CompetitivePressure = {
  category: string | null;
  competitors: number | null;
  total_creatives: number | null;
  avg_creatives_per_brand: number | null;
};

function MarketIntelligencePage() {
  const [ownership, setOwnership] = useState<CategoryOwnership[]>([]);
  const [pressure, setPressure] = useState<CompetitivePressure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from("category_ownership").select("category, domain, placements, share_of_voice"),
        supabase
          .from("competitive_pressure")
          .select("category, competitors, total_creatives, avg_creatives_per_brand"),
      ]);
      if (!active) return;
      setOwnership((a.data ?? []) as CategoryOwnership[]);
      setPressure((b.data ?? []) as CompetitivePressure[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const leadersByCategory = (() => {
    const map = new Map<string, CategoryOwnership[]>();
    for (const r of ownership) {
      const k = r.category ?? "Unclassified";
      if (k === "Unknown" || k === "Unclassified") continue;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries())
      .map(([category, rows]) => ({
        category,
        rows: rows
          .sort((a, b) => (Number(b.share_of_voice) || 0) - (Number(a.share_of_voice) || 0))
          .slice(0, 5),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  })();

  const filteredPressure = pressure
    .filter((p) => p.category && p.category.toLowerCase() !== "unknown")
    .sort((a, b) => (Number(b.competitors) || 0) - (Number(a.competitors) || 0));

  if (loading) {
    return (
      <WorkspaceShell title="Market signal" subtitle="Category leaders and competitive pressure — live.">
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
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      title="Market signal"
      subtitle="Category leaders and competitive pressure — live."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Section 1 — Category leaders */}
        {leadersByCategory.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1C1C1A",
                marginBottom: 12,
                letterSpacing: "-0.01em",
              }}
            >
              Category leaders
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 16,
              }}
            >
              {leadersByCategory.map((g) => (
                <div
                  key={g.category}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #EBE9E4",
                    borderRadius: 10,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1C1C1A",
                      marginBottom: 12,
                    }}
                  >
                    {g.category}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {g.rows.map((r, i) => {
                      const sov = Math.min(100, Number(r.share_of_voice) || 0);
                      return (
                        <div key={i}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 4,
                              gap: 12,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                color: "#1C1C1A",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                flex: 1,
                              }}
                            >
                              {displayBrand(r.domain ?? "")}
                            </span>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#1C1C1A",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {sov.toFixed(1)}%
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: "#F0EDE8",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${sov}%`,
                                height: "100%",
                                background: "#1C1C1A",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Section 2 — Competitive pressure */}
        {filteredPressure.length > 0 && (
          <section>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#1C1C1A",
                marginBottom: 12,
                letterSpacing: "-0.01em",
              }}
            >
              Competitive pressure
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {filteredPressure.map((p, i) => (
                <div
                  key={i}
                  style={{
                    background: "#F0EDE8",
                    borderRadius: 8,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#9E9D94",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {p.category}
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      color: "#1C1C1A",
                      marginTop: 6,
                      lineHeight: 1,
                    }}
                  >
                    {Number(p.competitors) || 0}
                  </div>
                  <div style={{ fontSize: 11, color: "#9E9D94", marginTop: 4 }}>
                    competitors
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6B6B62",
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Creatives</span>
                      <span style={{ fontWeight: 600, color: "#1C1C1A" }}>
                        {Number(p.total_creatives) || 0}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Avg / brand</span>
                      <span style={{ fontWeight: 600, color: "#1C1C1A" }}>
                        {(Number(p.avg_creatives_per_brand) || 0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {leadersByCategory.length === 0 && filteredPressure.length === 0 && (
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
            Signal incoming. R-AD is on it.
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/pcr")({
  head: () => ({ meta: [{ title: "Market signal — RevenuAD Signal" }] }),
  component: MarketIntelligencePage,
});
