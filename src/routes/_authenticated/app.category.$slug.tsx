import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUp, ArrowDown, Lock, CheckCircle2 } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { ChannelMixBars } from "@/components/adpalette/ChannelMixBars";
import { supabase } from "@/integrations/supabase/client";
import { SpendIndex } from "@/components/adpalette/SpendIndex";
import { CORE_FALLBACKS } from "@/lib/categoryCatalog";
import {
  fetchCategoryIntel,
  normalizeDomain,
  type CategoryIntelSnapshot,
} from "@/lib/categoryIntel";
import { isDemoAdvertiserAllowed } from "@/lib/demo-account";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
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

function CategoryDetailPage() {
  const { slug } = Route.useParams();
  const { isDemo } = useDemoAccount();

  const [intel, setIntel] = useState<CategoryIntelSnapshot | null>(null);
  const [subscribed, setSubscribed] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: reg }, { data: ds }] = await Promise.all([
        supabase.from("advertiser_registry").select("category").not("category", "is", null),
        supabase.from("domain_scans").select("domain"),
      ]);
      const registryCategories = Array.from(
        new Set(((reg ?? []) as { category: string }[]).map((r) => r.category).filter(Boolean)),
      );
      const snapshot = await fetchCategoryIntel(supabase, slug, registryCategories);
      if (!active) return;
      setIntel(snapshot);
      setSubscribed(new Set(((ds ?? []) as { domain: string }[]).map((r) => normalizeDomain(r.domain))));
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const brandRows = intel?.brands ?? [];
  const categoryName = intel?.categoryName ?? slug.replace(/-/g, " ");
  const isPreview = intel?.isPreview ?? false;
  const totalAds = intel?.totalAds ?? 0;
  const totalSpend = intel?.totalSpend ?? 0;
  const channelMix = intel?.channelMix;
  const fallback = intel?.coreSlug ? CORE_FALLBACKS[intel.coreSlug] : null;

  const themeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of brandRows) m.set(r.theme, (m.get(r.theme) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [brandRows]);

  const dominantTheme = themeCounts[0];
  const contestedTheme = themeCounts.find(([, n]) => n >= 2) ?? themeCounts[0];
  const openAngleTheme = themeCounts.filter(([, n]) => n === 1).slice(-1)[0];

  const trackedRows = brandRows.filter((r) => r.adCount > 0);
  const canOpenBrand = (domain: string) =>
    subscribed.has(domain) || (isDemo && isDemoAdvertiserAllowed(domain));
  const unlockedCount = brandRows.filter((r) => canOpenBrand(r.domain)).length;
  const blurredCount = brandRows.length - unlockedCount;

  const subtitle =
    trackedRows.length > 0
      ? `${trackedRows.length} brands with indexed ads · ${totalAds.toLocaleString()} ads · Est. $${totalSpend.toLocaleString()}/mo`
      : isPreview
        ? `${brandRows.length} benchmark brands · category preview until ads are indexed`
        : `${categoryName} — add brands to your watchlist to start benchmarking`;

  return (
    <WorkspaceShell title={`${categoryName} — Category intel`} subtitle={subtitle}>
      {!loaded ? (
        <div className="card-flat p-8 text-center text-sm text-muted-foreground">Loading category intel…</div>
      ) : brandRows.length === 0 ? (
        <div className="card-flat p-12 text-center max-w-lg mx-auto">
          <div className="text-base font-semibold text-foreground mb-2">Category intel builds as you track brands</div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            We don&apos;t have enough indexed ads in {categoryName} yet. Add competitors from this category to your
            client watchlist and run a scan — you&apos;ll get share of activity, messaging patterns, and open angles
            here.
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
              <strong>Category preview</strong> — benchmark brands for {categoryName}. Share and spend are directional
              until ads are indexed for this category.
            </div>
          )}

          <div className="mb-6 grid gap-3 md:grid-cols-4">
            <SummaryCard label="Category leader" value={intel?.leading ?? fallback?.leading ?? "—"} />
            <SummaryCard label="Fastest mover" value={intel?.rising ?? fallback?.rising ?? "—"} />
            <SummaryCard label="Biggest threat" value={intel?.threat ?? fallback?.threat ?? "—"} />
            <SummaryCard
              label="Top opportunity"
              value={intel?.topOpportunity ?? fallback?.topOpportunity ?? "—"}
              detail="Unclaimed positioning angle"
            />
          </div>

          <div className="card-flat overflow-hidden">
            <div className="px-5 py-3 border-b-2 border-ink bg-secondary/40 flex items-center justify-between">
              <div className="font-bold tracking-tight">Share of observed activity</div>
              <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {unlockedCount > 0
                  ? `${unlockedCount} brand${unlockedCount === 1 ? "" : "s"} unlocked`
                  : "Add brands to unlock detail"}
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
                const unlocked = canOpenBrand(r.domain);
                return (
                  <div
                    key={r.domain}
                    className={`grid grid-cols-[60px_2fr_1fr_1fr_80px_1.5fr] gap-3 px-5 py-3 items-center text-sm ${
                      unlocked ? "hover:bg-secondary/40 cursor-pointer" : ""
                    } ${r.preview ? "opacity-90" : ""}`}
                  >
                    <div className="mono font-bold">#{i + 1}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      {unlocked ? (
                        <>
                          <span
                            className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                            title={subscribed.has(r.domain) ? "On watchlist" : "Demo showcase"}
                          />
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
                      {unlocked ? (
                        <SpendIndex level={spendLevel(r.spend)} label="" />
                      ) : (
                        <span className="text-muted-foreground text-xs">Add to view</span>
                      )}
                    </div>
                    <div className={r.trendUp ? "text-emerald-700" : "text-rose-700"}>
                      {r.trendUp ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                    </div>
                    <div>
                      {unlocked ? (
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

          {channelMix ? (
            <div className="mt-6 card-flat p-5">
              <div className="font-bold tracking-tight mb-3">Category channel mix</div>
              <ChannelMixBars
                rows={channelMix.rows}
                overallConfidence={channelMix.overallConfidence}
                sourceLabel={channelMix.sourceLabel}
                estimationTooltip={channelMix.estimationTooltip}
                available={channelMix.available}
              />
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <InsightCard
              label="What everyone says"
              value={dominantTheme ? dominantTheme[0] : "—"}
              detail={
                dominantTheme
                  ? `${dominantTheme[1]} brands lead with this message`
                  : "Patterns appear as more brands are tracked"
              }
              tone="bg-violet-50 border-violet-300"
            />
            <InsightCard
              label="Where they're fighting"
              value={contestedTheme ? contestedTheme[0] : "—"}
              detail={
                contestedTheme
                  ? `${contestedTheme[1]} brands competing on the same angle`
                  : "Add competitors to see contested ground"
              }
              tone="bg-amber-50 border-amber-300"
            />
            <InsightCard
              label="Open angle"
              value={openAngleTheme ? openAngleTheme[0] : intel?.topOpportunity ?? "—"}
              detail={
                openAngleTheme
                  ? `Only ${openAngleTheme[1]} brand uses this — room to own it`
                  : intel?.topOpportunity
                    ? "Positioning gap surfaced from category scan"
                    : "Unclaimed messages surface with more data"
              }
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
                  Add them to a client workspace for full ad library detail — spend signals, creative themes, and channel
                  mix.
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

          {unlockedCount > 0 && blurredCount === 0 && (
            <div className="mt-6 card-flat p-4 flex items-center gap-2 text-sm">
              <CheckCircle2 size={16} className="text-emerald-600" />
              Every brand in this category is unlocked on your account.
            </div>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card-flat p-4 border-2 border-ink/10">
      <div className="mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tracking-tight mt-1">{displayBrand(value)}</div>
      {detail ? <div className="text-[11px] text-muted-foreground mt-0.5">{detail}</div> : null}
    </div>
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
