import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";

type Insight = {
  domain: string;
  good: string | null;
  friction: string | null;
  blueprint: string | null;
  created_at: string;
};

function brandFromDomain(domain: string) {
  const root = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function SentimentRadarPage() {
  const [rows, setRows] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("sentiment_insights")
        .select("domain, good, friction, blueprint, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      if (!active) return;
      // Keep newest per domain
      const seen = new Set<string>();
      const unique: Insight[] = [];
      for (const r of data ?? []) {
        if (!seen.has(r.domain)) {
          seen.add(r.domain);
          unique.push(r as Insight);
        }
      }
      setRows(unique);
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel("sentiment-radar")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sentiment_insights" },
        () => load(),
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <WorkspaceShell
      title="Sentiment Radar"
      subtitle="Live audience signal compiled per tracked advertiser — what they love, where they friction, and the ad angle to weaponize."
    >
      {loading ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">
          No data found, please add a domain under the Advertisers tab.
        </div>
      ) : (
        <div className="space-y-5">
          {rows.map((s, i) => (
            <div key={`${s.domain}-${i}`} className="card-flat overflow-hidden">
              <div className="px-4 py-3 border-b-2 border-ink bg-secondary flex items-center justify-between">
                <div className="font-bold">{brandFromDomain(s.domain)}</div>
                <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
                  {s.domain}
                </span>
              </div>
              <div className="grid md:grid-cols-3 gap-0">
                <div className="p-4 border-r-2 border-ink last:border-r-0">
                  <div className="mono text-[10px] uppercase font-bold mb-2">🟢 The Good</div>
                  <p className="text-sm leading-relaxed">
                    <span className="bg-green-100 dark:bg-green-900/40 text-green-950 dark:text-green-100 px-1 rounded-[2px] box-decoration-clone">
                      {s.good ?? "Awaiting signal…"}
                    </span>
                  </p>
                </div>
                <div className="p-4 border-r-2 border-ink last:border-r-0 border-t-2 md:border-t-0">
                  <div className="mono text-[10px] uppercase font-bold mb-2">🔴 The Friction</div>
                  <p className="text-sm leading-relaxed">
                    <span className="bg-red-100 dark:bg-red-900/40 text-red-950 dark:text-red-100 px-1 rounded-[2px] box-decoration-clone">
                      {s.friction ?? "Awaiting signal…"}
                    </span>
                  </p>
                </div>
                <div className="p-4 border-t-2 md:border-t-0 bg-canvas">
                  <div className="mono text-[10px] uppercase font-bold mb-2">🟡 The Ad Angle Blueprint</div>
                  <p className="text-sm leading-relaxed font-medium">
                    <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-950 dark:text-yellow-100 px-1 rounded-[2px] box-decoration-clone">
                      {s.blueprint ?? "Awaiting signal…"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/sentiment")({
  head: () => ({ meta: [{ title: "Sentiment Radar — RevenueAd" }] }),
  component: SentimentRadarPage,
});
