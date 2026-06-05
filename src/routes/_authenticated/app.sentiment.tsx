import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronDown, Radio } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  const root =
    domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0] ?? domain;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function SocialListeningPanel({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(true);
  const brand = brandFromDomain(insight.domain);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="card-flat overflow-hidden">
      <CollapsibleTrigger className="w-full px-4 py-3 border-b-2 border-ink bg-secondary flex items-center justify-between cursor-pointer hover:bg-secondary/80 transition-colors">
        <div className="flex items-center gap-2 font-bold">
          <Radio size={16} />
          <span>📡 Social Listening for {brand}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] px-1.5 py-0.5 border-2 border-ink rounded-[3px] bg-paper">
            {insight.domain}
          </span>
          <ChevronDown
            size={18}
            className={`transition-transform duration-300 ${open ? "rotate-180" : "rotate-0"}`}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="p-4 border-r-2 border-ink last:border-r-0">
            <div className="mono text-[10px] uppercase font-bold mb-3">Brand Signals</div>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] mono uppercase text-muted-foreground mb-1">
                  🟢 The Good
                </div>
                <p className="text-sm leading-relaxed">
                  <span className="bg-green-100 dark:bg-green-900/40 text-green-950 dark:text-green-100 px-1 rounded-[2px] box-decoration-clone">
                    {insight.good ?? "Awaiting signal…"}
                  </span>
                </p>
              </div>
              <div>
                <div className="text-[11px] mono uppercase text-muted-foreground mb-1">
                  🔴 The Friction
                </div>
                <p className="text-sm leading-relaxed">
                  <span className="bg-red-100 dark:bg-red-900/40 text-red-950 dark:text-red-100 px-1 rounded-[2px] box-decoration-clone">
                    {insight.friction ?? "Awaiting signal…"}
                  </span>
                </p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-canvas border-t-2 md:border-t-0 border-ink">
            <div className="mono text-[10px] uppercase font-bold mb-3">Active Ad Angles</div>
            <p className="text-sm leading-relaxed font-medium">
              <span className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-950 dark:text-yellow-100 px-1 rounded-[2px] box-decoration-clone">
                {insight.blueprint ?? "Awaiting signal…"}
              </span>
            </p>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SocialListeningPage() {
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
      .channel("social-listening")
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
      title="Social Listening"
      subtitle="Live audience signal compiled per tracked advertiser — what they love, where they friction, and the ad angle to weaponize."
    >
      {loading ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">
          No data found, please add a domain under the Advertisers tab.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((s, i) => (
            <SocialListeningPanel key={`${s.domain}-${i}`} insight={s} />
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/sentiment")({
  head: () => ({ meta: [{ title: "Social Listening — RevenueAd" }] }),
  component: SocialListeningPage,
});
