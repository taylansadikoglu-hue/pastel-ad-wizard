import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientWorkspaceEmptyState } from "@/components/adpalette/ClientWorkspaceEmptyState";
import { MarketIntelReport } from "@/components/adpalette/market-intel/MarketIntelReport";
import { useClientWorkspace } from "@/contexts/ClientWorkspaceContext";
import { WorkspaceShell } from "./WorkspaceShell";
import { supabase } from "@/integrations/supabase/client";
import {
  loadStrategistIntelligence,
  normalizeRadBrief,
  normalizeRadConfidence,
  type StrategistIntelBundle,
} from "@/lib/api-gateway";
import { getAgencyContext, type AgencyContext } from "@/lib/agency-watchlist";
import { generatePitchDeck } from "@/lib/export-pptx";
import { buildMarketChannelMix } from "@/lib/channelMix";
import { fetchAdlibraryCoverage, EMPTY_COVERAGE, type AdlibraryCoverage } from "@/lib/adlibraryCoverage";
import { safeOptional } from "@/lib/safeQuery";
import { useDemoAccount } from "@/contexts/DemoAccountContext";
import { withTimeout } from "@/lib/withTimeout";
import { fetchMarketStrategistIntel, type MarketStrategistIntel } from "@/lib/marketStrategistIntel";
import {
  buildProductThemes,
  detectSeasonalTheme,
} from "@/lib/marketCampaignThemes";
import {
  buildCategoryKpis,
  buildHeroPulse,
  enrichCompetitorRisers,
  enrichProductThemes,
  enrichWeeklyChanges,
} from "@/lib/marketPulseMetrics";
import { radChannelBite } from "@/lib/radReportVoice";
import {
  buildRecommendedMoves,
  isThemeAllowed,
  translateTerritory,
} from "@/lib/radInsightTranslator";
import { displayBrand } from "@/utils/brandDisplay";
import type { DataModuleId, PanelFocus } from "./strategist/data-module-types";
import { HardDataPanel } from "./strategist/HardDataPanel";

type Brief = {
  client_name: string | null;
  category: string | null;
  headline: string | null;
  recommended_action: string | null;
  strongest_threat: string | null;
  whitespace_emotion: string | null;
};

type Threat = {
  competitor_domain: string | null;
  creative_volume: number | null;
  threat_score: number | null;
};

type Challenger = {
  brand_domain: string | null;
  keyword: string | null;
  creative_volume: number | null;
};

type Whitespace = {
  category: string | null;
  emotion: string | null;
  recommendation: string | null;
  opportunity_score: number | null;
};

type Momentum = {
  brand_domain: string | null;
  momentum: string | null;
  pressure: string | null;
};

type Exec = {
  dominant_market: string | null;
  strongest_brand: string | null;
  top_opportunity_emotion: string | null;
};

function categoryMatches(workspaceCategory: string, rowCategory: string | null | undefined): boolean {
  if (!rowCategory?.trim()) return true;
  const ws = workspaceCategory.toLowerCase();
  const row = rowCategory.toLowerCase();
  if (ws.includes(row) || row.includes(ws)) return true;
  const wsRoot = ws.split(/\s+/)[0] ?? ws;
  return row.includes(wsRoot) || ws.includes(row.split(/\s+/)[0] ?? row);
}

const EMPTY_AGENCY: AgencyContext = { agencyId: null, entries: [], domains: new Set() };

export function StrategistDashboard() {
  const { activeWorkspace, loading: workspaceLoading } = useClientWorkspace();
  const { canExport, loading: demoLoading } = useDemoAccount();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [challengers, setChallengers] = useState<Challenger[]>([]);
  const [whitespace, setWhitespace] = useState<Whitespace[]>([]);
  const [momentum, setMomentum] = useState<Momentum[]>([]);
  const [exec, setExec] = useState<Exec | null>(null);
  const [confidence, setConfidence] = useState<{ ads_analysed: number | null; brands_tracked: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [agencyCtx, setAgencyCtx] = useState<AgencyContext | null>(null);
  const [intelBundle, setIntelBundle] = useState<StrategistIntelBundle | null>(null);
  const [marketIntel, setMarketIntel] = useState<MarketStrategistIntel | null>(null);
  const [adlibraryCoverage, setAdlibraryCoverage] = useState<AdlibraryCoverage | null>(null);
  const [panelFocus, setPanelFocus] = useState<PanelFocus | null>(null);

  const openPanel = (moduleId: DataModuleId, rowIndex?: number, rowLabel?: string) => {
    setPanelFocus({ moduleId, rowIndex, rowLabel });
  };

  const handleExportPitch = useCallback(async () => {
    if (!intelBundle) return;
    await generatePitchDeck(intelBundle, { agencyContext: agencyCtx });
  }, [intelBundle, agencyCtx]);

  useEffect(() => {
    if (workspaceLoading || demoLoading) return;
    if (!activeWorkspace) {
      setLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      const workspace = activeWorkspace;
      try {
        await withTimeout(
          (async () => {
            const ctx = await withTimeout(
              getAgencyContext(),
              8_000,
              EMPTY_AGENCY,
              "getAgencyContext",
            );
            const bundle = await loadStrategistIntelligence(ctx, workspace);
            const deepIntel = await safeOptional(
              "marketStrategistIntel",
              () =>
                withTimeout(
                  fetchMarketStrategistIntel(supabase, workspace),
                  8_000,
                  {
                    available: false,
                    executivePack: null,
                    competitiveGap: null,
                    dashboardHero: null,
                    territories: [],
                    risks: [],
                    meetingPrep: [],
                    dailyChanges: [],
                    positioningMap: [],
                    evidencePack: [],
                    strategicActions: [],
                  },
                  "fetchMarketStrategistIntel",
                ),
              {
                available: false,
                executivePack: null,
                competitiveGap: null,
                dashboardHero: null,
                territories: [],
                risks: [],
                meetingPrep: [],
                dailyChanges: [],
                positioningMap: [],
                evidencePack: [],
                strategicActions: [],
              },
            );
            const coverage = await safeOptional(
              "adlibraryCoverage",
              () => withTimeout(fetchAdlibraryCoverage(supabase), 6_000, EMPTY_COVERAGE, "adlibraryCoverage"),
              EMPTY_COVERAGE,
            );

            if (!alive) return;

            setAgencyCtx(ctx);
            setIntelBundle(bundle);
            setMarketIntel(deepIntel);
            setAdlibraryCoverage(coverage);

            const normalizedBrief = normalizeRadBrief(bundle.brief.data as Record<string, unknown> | null, null) as Brief | null;
            setBrief(
              normalizedBrief ?? {
                client_name: workspace.client_name,
                category: workspace.category,
                headline: `${workspace.category} market intel`,
                recommended_action: null,
                strongest_threat: null,
                whitespace_emotion: null,
              },
            );
            setThreats((bundle.threats.data ?? []) as Threat[]);
            setChallengers((bundle.challengers.data ?? []) as Challenger[]);
            setWhitespace((bundle.whitespace.data ?? []) as Whitespace[]);
            setMomentum((bundle.momentum.data ?? []) as Momentum[]);
            setExec((bundle.executive.data ?? null) as Exec | null);
            setConfidence(
              normalizeRadConfidence(
                bundle.pulse.data as Record<string, unknown> | null,
                bundle.confidence.data as Record<string, unknown> | null,
              ) as { ads_analysed: number | null; brands_tracked: number | null } | null,
            );
          })(),
          18_000,
          undefined,
          "market-intel-load",
        );
      } catch (err) {
        console.error("[Market Intel] required load failed:", err);
        if (alive) {
          setBrief({
            client_name: workspace.client_name,
            category: workspace.category,
            headline: `${workspace.category} market intel`,
            recommended_action: null,
            strongest_threat: null,
            whitespace_emotion: null,
          });
          setMarketIntel(null);
          setAdlibraryCoverage(EMPTY_COVERAGE);
        }
      } finally {
        if (alive) {
          setBrief((prev) =>
            prev ??
            (workspace
              ? {
                  client_name: workspace.client_name,
                  category: workspace.category,
                  headline: `${workspace.category} market intel`,
                  recommended_action: null,
                  strongest_threat: null,
                  whitespace_emotion: null,
                }
              : null),
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeWorkspace, workspaceLoading, demoLoading]);

  const category = activeWorkspace?.category ?? brief?.category ?? "Banking";
  const clientName = activeWorkspace?.client_name ?? brief?.client_name ?? "Your client";

  const scopedWhitespace = useMemo(
    () =>
      whitespace.filter(
        (r) => categoryMatches(category, r.category) && (!r.emotion || isThemeAllowed(r.emotion)),
      ),
    [whitespace, category],
  );

  const channelMixResult = useMemo(
    () => buildMarketChannelMix(intelBundle?.brief.data as Record<string, unknown> | null),
    [intelBundle],
  );

  const productThemes = useMemo(() => buildProductThemes(challengers, category), [challengers, category]);
  const enrichedProductThemes = useMemo(
    () => enrichProductThemes(productThemes, category),
    [productThemes, category],
  );
  const seasonalTheme = useMemo(() => detectSeasonalTheme(challengers, category), [challengers, category]);

  const marketTemperature =
    marketIntel?.executivePack?.marketTemperature ??
    (marketIntel?.dashboardHero?.marketStory ? "Heating up" : "Stable");

  const pulseData = (intelBundle?.pulse.data ?? null) as Record<string, unknown> | null;

  const categoryKpis = useMemo(
    () =>
      buildCategoryKpis({
        brandsTracked: confidence?.brands_tracked,
        adsIndexed: confidence?.ads_analysed,
        marketTemperature,
        pulse: pulseData,
        category,
      }),
    [confidence, marketTemperature, pulseData, category],
  );

  const heroPulse = useMemo(
    () => buildHeroPulse(marketTemperature, pulseData, category),
    [marketTemperature, pulseData, category],
  );

  const weeklyChanges = useMemo(
    () => enrichWeeklyChanges(marketIntel?.dailyChanges ?? [], clientName, pulseData),
    [marketIntel?.dailyChanges, clientName, pulseData],
  );

  const competitorRisers = useMemo(
    () => enrichCompetitorRisers(threats, momentum, pulseData),
    [threats, momentum, pulseData],
  );

  const recommendedMoves = useMemo(
    () =>
      [
        ...(marketIntel?.executivePack?.recommendedAction ? [marketIntel.executivePack.recommendedAction] : []),
        ...(marketIntel?.strategicActions.map((a) => a.action) ?? []),
        ...(brief?.recommended_action ? [brief.recommended_action] : []),
        ...buildRecommendedMoves(clientName),
      ]
        .filter((v, i, arr) => v && arr.indexOf(v) === i)
        .slice(0, 3),
    [marketIntel, brief, clientName],
  );

  const whitespaceCards = useMemo(
    () =>
      [...scopedWhitespace]
        .sort((a, b) => (Number(b.opportunity_score) || 0) - (Number(a.opportunity_score) || 0))
        .slice(0, 3)
        .map((r) => ({
          title: translateTerritory(r.emotion),
          score: r.opportunity_score,
          action: r.recommendation ?? `Test creative around ${translateTerritory(r.emotion).toLowerCase()}.`,
        })),
    [scopedWhitespace],
  );

  const topOpportunity =
    translateTerritory(exec?.top_opportunity_emotion ?? brief?.whitespace_emotion ?? scopedWhitespace[0]?.emotion) ||
    productThemes[0]?.label ||
    "Savings messaging";

  const biggestThreat =
    displayBrand(
      marketIntel?.competitiveGap?.strongestThreat ??
        marketIntel?.risks[0]?.competitorDomain ??
        brief?.strongest_threat ??
        threats[0]?.competitor_domain,
    ) || "Westpac";

  const channelBite = useMemo(() => {
    const active = channelMixResult.rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
    if (active.length >= 2) return radChannelBite(active[0].channel, active[1].channel);
    return "Search dominates while video remains under-invested across Banking.";
  }, [channelMixResult.rows]);

  const hardDataPayload = {
    threats,
    challengers,
    whitespace: scopedWhitespace,
    momentum,
    exec,
    pitch: [],
    agencyId: agencyCtx?.agencyId ?? null,
    marketIntel,
    channelMix: channelMixResult,
    adlibraryCoverage,
    confidence,
    brief,
    workspace: activeWorkspace
      ? {
          client_name: activeWorkspace.client_name,
          client_domain: activeWorkspace.client_domain,
          competitor_domains: activeWorkspace.competitor_domains,
          category: activeWorkspace.category,
        }
      : null,
    recommendedMoves,
    intelBundle,
  };

  if (workspaceLoading || demoLoading || loading) {
    return (
      <WorkspaceShell title="Market Intel" subtitle="Loading your R-AD report…">
        <div className="card-flat p-12 text-center text-sm text-muted-foreground">Pulling signal for your watchlist…</div>
      </WorkspaceShell>
    );
  }

  if (!activeWorkspace) {
    return (
      <WorkspaceShell title="Market Intel">
        <ClientWorkspaceEmptyState />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      title="Market Intel"
      subtitle={`${clientName} · ${category}`}
      onExportPitch={canExport ? handleExportPitch : undefined}
      exportPitchDisabled={!canExport || !intelBundle}
    >
      <MarketIntelReport
        clientName={clientName}
        category={category}
        competitorDomains={activeWorkspace.competitor_domains}
        marketTemperature={marketTemperature}
        biggestThreat={biggestThreat}
        biggestOpportunity={topOpportunity}
        recommendedMove={recommendedMoves[0] ?? null}
        categoryKpis={categoryKpis}
        heroPulse={heroPulse}
        weeklyChanges={weeklyChanges}
        competitorRisers={competitorRisers}
        channelMix={channelMixResult}
        channelBite={channelBite}
        productThemes={enrichedProductThemes}
        seasonalTheme={seasonalTheme}
        whitespaceCards={whitespaceCards}
        recommendedActions={recommendedMoves}
        confidence={{ ads: confidence?.ads_analysed, brands: confidence?.brands_tracked }}
        marketIntel={marketIntel}
        adlibraryCoverage={adlibraryCoverage}
        onEvidence={openPanel}
      />

      <HardDataPanel focus={panelFocus} onClose={() => setPanelFocus(null)} data={hardDataPayload} />
    </WorkspaceShell>
  );
}
