import pptxgen from "pptxgenjs";
import {
  normalizeRadBrief,
  normalizeRadConfidence,
  type StrategistIntelBundle,
} from "@/lib/api-gateway";
import type { AgencyContext } from "@/lib/agency-watchlist";
import { watchlistDisplayName } from "@/lib/agency-watchlist";
import {
  buildOpenAngleCopy,
  buildRecommendedMoves,
  isThemeAllowed,
  parseMarketChannelMix,
  parseSpendRange,
  sanitizeInsightCopy,
  selectDominantTheme,
  selectSurfacedThemes,
  type ChannelMixRow,
} from "@/lib/radInsightTranslator";

/** Consultant deck theme — spacious, callout-led, directional language only. */
const THEME = {
  bg: "0A0A0A",
  surface: "171717",
  surfaceRaised: "1F1F1F",
  border: "333333",
  text: "F5F5F5",
  textSecondary: "B8B8B8",
  textMuted: "737373",
  accent: "FBBF24",
  accentEmerald: "34D399",
  accentBlue: "60A5FA",
  accentRose: "F87171",
  channelBar: "C9963A",
  fontTitle: "Segoe UI",
  fontBody: "Calibri",
  fontMono: "Courier New",
} as const;

const SLIDE_LABEL = "Market Intel · RevenuAD Signal";
const MARGIN = 0.65;

export type PitchExportOptions = {
  agencyContext?: AgencyContext | null;
};

type BriefShape = {
  client_name: string | null;
  category: string | null;
  headline: string | null;
  summary: string | null;
  strategic_opening: string | null;
  recommended_action: string | null;
  strongest_threat: string | null;
  fastest_mover: string | null;
  emerging_challenger: string | null;
  whitespace_emotion: string | null;
};

type ConfidenceShape = {
  ads_analysed: number | null;
  brands_tracked: number | null;
  classification_coverage: number | null;
};

type DeckContext = {
  brand: string;
  clientName: string;
  category: string;
  brief: BriefShape | null;
  exec: Record<string, unknown> | null;
  confidence: ConfidenceShape | null;
  channelMix: ChannelMixRow[];
  spendRange: ReturnType<typeof parseSpendRange>;
  leaders: Record<string, unknown>[];
  fastestGrowing: Record<string, unknown> | null;
  challengers: Record<string, unknown>[];
  whitespace: Record<string, unknown>[];
  dominantMessage: string | null;
  marketMessages: string[];
  competingThemes: string[];
  moves: string[];
  confidenceLabel: string;
  dominantPhrase: string;
  openPhrase: string;
};

type CalloutVariant = "gold" | "emerald" | "blue" | "rose" | "neutral";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function str(value: unknown): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function slideBackground(slide: pptxgen.Slide) {
  slide.background = { color: THEME.bg };
}

function addSlideLabel(slide: pptxgen.Slide, y = 0.32) {
  slide.addText(SLIDE_LABEL.toUpperCase(), {
    x: MARGIN,
    y,
    w: 9.0,
    h: 0.22,
    fontFace: THEME.fontMono,
    fontSize: 7,
    color: THEME.textMuted,
    charSpacing: 1.4,
  });
}

function addSlideTitle(slide: pptxgen.Slide, title: string, y = 0.58) {
  slide.addText(title, {
    x: MARGIN,
    y,
    w: 9.0,
    h: 0.55,
    fontFace: THEME.fontTitle,
    fontSize: 26,
    bold: true,
    color: THEME.text,
  });
}

function addSubtitle(slide: pptxgen.Slide, text: string, y = 1.12) {
  slide.addText(text, {
    x: MARGIN,
    y,
    w: 9.0,
    h: 0.28,
    fontFace: THEME.fontBody,
    fontSize: 10,
    color: THEME.textMuted,
    italic: true,
  });
}

function addSectionLabel(slide: pptxgen.Slide, text: string, y: number, color = THEME.accent) {
  slide.addText(text.toUpperCase(), {
    x: MARGIN,
    y,
    w: 9.0,
    h: 0.2,
    fontFace: THEME.fontMono,
    fontSize: 7,
    color,
    charSpacing: 1,
  });
}

function variantAccent(variant: CalloutVariant): string {
  switch (variant) {
    case "emerald": return THEME.accentEmerald;
    case "blue": return THEME.accentBlue;
    case "rose": return THEME.accentRose;
    case "gold": return THEME.accent;
    default: return THEME.textMuted;
  }
}

function addCalloutBox(
  slide: pptxgen.Slide,
  pptx: pptxgen,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    body: string;
    variant?: CalloutVariant;
    icon?: string;
  },
) {
  const accent = variantAccent(opts.variant ?? "neutral");
  slide.addShape(pptx.ShapeType.rect, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fill: { color: THEME.surfaceRaised },
    line: { color: THEME.border, width: 0.75 },
  });
  slide.addShape(pptx.ShapeType.rect, {
    x: opts.x,
    y: opts.y,
    w: 0.06,
    h: opts.h,
    fill: { color: accent },
  });
  const icon = opts.icon ? `${opts.icon}  ` : "";
  slide.addText(`${icon}${opts.label}`, {
    x: opts.x + 0.18,
    y: opts.y + 0.12,
    w: opts.w - 0.3,
    h: 0.22,
    fontFace: THEME.fontMono,
    fontSize: 7,
    bold: true,
    color: accent,
  });
  slide.addText(opts.body, {
    x: opts.x + 0.18,
    y: opts.y + 0.34,
    w: opts.w - 0.3,
    h: opts.h - 0.42,
    fontFace: THEME.fontBody,
    fontSize: 10,
    color: THEME.textSecondary,
    valign: "top",
  });
}

function addIconBullet(
  slide: pptxgen.Slide,
  items: string[],
  y: number,
  h: number,
  icon = "▸",
) {
  if (!items.length) return;
  slide.addText(
    items.map((item) => ({
      text: `${icon}  ${item}`,
      options: { breakLine: true, paraSpaceAfter: 6 },
    })),
    {
      x: MARGIN + 0.05,
      y,
      w: 8.85,
      h,
      fontFace: THEME.fontBody,
      fontSize: 11,
      color: THEME.textSecondary,
      valign: "top",
    },
  );
}

function addStatTiles(slide: pptxgen.Slide, pptx: pptxgen, items: { label: string; value: string }[], y: number) {
  const count = Math.min(items.length, 4);
  const gap = 0.12;
  const tileW = (9.0 - gap * (count - 1)) / count;
  items.slice(0, 4).forEach((item, i) => {
    const x = MARGIN + i * (tileW + gap);
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w: tileW,
      h: 0.72,
      fill: { color: THEME.surface },
      line: { color: THEME.border, width: 0.5 },
    });
    slide.addText(item.label.toUpperCase(), {
      x: x + 0.12,
      y: y + 0.1,
      w: tileW - 0.24,
      h: 0.18,
      fontFace: THEME.fontMono,
      fontSize: 6.5,
      color: THEME.textMuted,
    });
    slide.addText(item.value, {
      x: x + 0.12,
      y: y + 0.28,
      w: tileW - 0.24,
      h: 0.36,
      fontFace: THEME.fontTitle,
      fontSize: 13,
      bold: true,
      color: THEME.text,
      valign: "top",
    });
  });
}

function addChannelMixBars(slide: pptxgen.Slide, pptx: pptxgen, rows: ChannelMixRow[], y: number): number {
  if (!rows.length) {
    slide.addText(
      "Channel mix unavailable for this market view — directional reads are stronger on individual advertiser pages.",
      { x: MARGIN, y, w: 9.0, h: 0.5, fontSize: 10, color: THEME.textMuted, fontFace: THEME.fontBody },
    );
    return y + 0.6;
  }

  rows.slice(0, 5).forEach((row, i) => {
    const rowY = y + i * 0.44;
    const pct = Math.max(0, Math.min(100, row.pct));
    slide.addText(row.channel, {
      x: MARGIN,
      y: rowY,
      w: 1.1,
      h: 0.26,
      fontFace: THEME.fontBody,
      fontSize: 10,
      color: THEME.text,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.85,
      y: rowY + 0.09,
      w: 5.9,
      h: 0.11,
      fill: { color: THEME.surface },
      line: { color: THEME.border, width: 0.5 },
    });
    if (pct > 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 1.85,
        y: rowY + 0.09,
        w: 5.9 * (pct / 100),
        h: 0.11,
        fill: { color: THEME.channelBar },
      });
    }
    slide.addText(`${Math.round(pct)}%`, {
      x: 7.9,
      y: rowY,
      w: 0.75,
      h: 0.26,
      fontFace: THEME.fontTitle,
      fontSize: 11,
      bold: true,
      color: THEME.text,
      align: "right",
    });
  });
  return y + rows.slice(0, 5).length * 0.44 + 0.15;
}

function resolveBrief(bundle: StrategistIntelBundle): BriefShape | null {
  if (!bundle.brief.data) return null;
  return normalizeRadBrief(bundle.brief.data as Record<string, unknown>, null) as BriefShape;
}

function resolveConfidence(bundle: StrategistIntelBundle): ConfidenceShape | null {
  return normalizeRadConfidence(
    bundle.pulse.status === "ok" ? (bundle.pulse.data as Record<string, unknown>) : null,
    bundle.confidence.data as Record<string, unknown> | null,
  ) as ConfidenceShape | null;
}

function resolveAgencyBrand(bundle: StrategistIntelBundle, ctx?: AgencyContext | null): string {
  const brief = resolveBrief(bundle);
  if (brief?.client_name?.trim()) return brief.client_name.trim();
  const fromWatchlist = ctx?.entries.find((e) => e.label?.trim() || e.domain);
  if (fromWatchlist) return watchlistDisplayName(fromWatchlist);
  return "Intelligence Brief";
}

function formatTimestamp(date = new Date()): string {
  return date.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "brief";
}

function brandLabel(domain: string | null | undefined): string {
  if (!domain) return "Unknown brand";
  return domain
    .replace(/^www\./, "")
    .split(".")[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function plainThemePhrase(raw: string | null | undefined): string {
  if (!raw?.trim()) return "trust and reliability";
  const key = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    trust: "security and confidence",
    curiosity: "discovery and smarter choices",
    greed: "value and savings",
    aspiration: "progress and future goals",
    fear: "risk reduction",
    belonging: "community and support",
  };
  return map[key] ?? sanitizeInsightCopy(raw).replace(/\s+territory$/i, "").toLowerCase();
}

function openAngleTitle(emotion: string | null | undefined): string {
  const key = (emotion ?? "").trim().toLowerCase();
  const titles: Record<string, string> = {
    curiosity: "Discovery-led messaging",
    greed: "Value and savings",
    aspiration: "Progress and future goals",
    trust: "Security and confidence",
    fear: "Risk reduction",
    belonging: "Community and support",
  };
  return titles[key] ?? sanitizeInsightCopy(emotion ?? "Open positioning").replace(/\s+territory$/i, "");
}

function toDeckCopy(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  return sanitizeInsightCopy(text)
    .replace(/smarter-choice campaign territory/gi, "a discovery-led campaign angle")
    .replace(/campaign territory/gi, "campaign angle")
    .replace(/\bstrategic whitespace\b/gi, "open positioning")
    .replace(/\bterritory\b/gi, "angle")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function plainDeckMoves(clientName?: string | null): string[] {
  return buildRecommendedMoves(clientName).map((m) => toDeckCopy(m));
}

function buildConfidenceLabel(confidence: ConfidenceShape | null): string {
  const ads = num(confidence?.ads_analysed);
  const brands = num(confidence?.brands_tracked);
  const coverage = num(confidence?.classification_coverage);
  if (ads >= 50 && brands >= 5 && coverage >= 60) {
    return "Observed — solid indexed coverage";
  }
  if (ads >= 15 || brands >= 3) {
    return "Directional — useful for planning, not budget sign-off";
  }
  return "Partial coverage — treat reads as early signal";
}

function competingThemeBullets(
  marketMessages: string[],
  dominantPhrase: string,
): string[] {
  const themes = new Set<string>();
  for (const msg of marketMessages) {
    const lower = msg.toLowerCase();
    if (lower.includes("trust") || lower.includes("security") || lower.includes("confidence")) {
      themes.add("trust and security");
    }
    if (lower.includes("value") || lower.includes("saving")) themes.add("value and savings");
    if (lower.includes("progress") || lower.includes("future") || lower.includes("goal")) {
      themes.add("progress and future goals");
    }
    if (lower.includes("community") || lower.includes("belong")) themes.add("community and support");
    if (lower.includes("discovery") || lower.includes("smarter") || lower.includes("choice")) {
      themes.add("discovery and smarter choices");
    }
  }
  if (!themes.size) {
    const parts = dominantPhrase.split(/\s+and\s+/).map((p) => p.trim()).filter(Boolean);
    parts.forEach((p) => themes.add(p));
    if (!themes.size) themes.add("trust and reliability");
  }
  return [...themes].slice(0, 4);
}

function buildChannelMixSuggestion(channelMix: ChannelMixRow[]): string {
  if (!channelMix.length) {
    return "Observed channel data is limited — validate mix on individual advertiser pages before reallocating spend.";
  }
  const active = channelMix.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct);
  const top = active.slice(0, 2).map((r) => `${r.channel} (${Math.round(r.pct)}%)`);
  const light = active.find((r) => r.channel === "Meta" && r.pct < 10)
    ?? active.find((r) => r.channel === "Search" && r.pct < 10)
    ?? active.find((r) => r.pct > 0 && r.pct < 8);

  let suggestion = `The category appears heavily weighted toward ${top.join(" and ")} activity based on observed placements.`;
  if (light) {
    suggestion += ` ${light.channel} shows limited observed presence — worth checking whether competitors are under-indexing or signal is partial.`;
  }
  return suggestion;
}

function buildExecutiveInsights(ctx: DeckContext): {
  takeaway: string;
  risk: string;
  opportunity: string;
  priority: string;
} {
  const { clientName, category, brief, exec, leaders, dominantPhrase, openPhrase, moves } = ctx;
  const leader = exec?.strongest_brand
    ? brandLabel(String(exec.strongest_brand))
    : leaders[0]
      ? brandLabel(String(leaders[0].competitor_domain))
      : "leading competitors";

  const takeaway =
    toDeckCopy(brief?.headline) ||
    `Observed activity suggests ${category} is crowded on ${dominantPhrase} messaging, with ${leader} among the most visible advertisers.`;

  const risk =
    brief?.strongest_threat
      ? `${brandLabel(brief.strongest_threat)} appears to be applying the most observed competitive pressure — ${clientName} risks blending in if messaging stays generic.`
      : `Most brands are competing on similar ${dominantPhrase} themes — ${clientName} risks being seen as interchangeable without a sharper angle.`;

  const opportunity =
    brief?.strategic_opening
      ? toDeckCopy(brief.strategic_opening)
      : `An estimated opening exists around ${openPhrase} before more competitors claim the same space.`;

  const priority =
    toDeckCopy(brief?.recommended_action) ||
    moves[0] ||
    `Run one directional test on ${openPhrase} messaging while monitoring observed competitor response.`;

  return { takeaway, risk, opportunity, priority };
}

function openOpportunityWhyItMatters(
  emotion: string,
  dominantPhrase: string,
  clientName: string,
): string {
  const title = openAngleTitle(emotion).toLowerCase();
  const key = emotion.trim().toLowerCase();
  if (key === "curiosity") {
    return `${title} may help ${clientName} differentiate from the category's heavy focus on ${dominantPhrase}.`;
  }
  if (key === "greed") {
    return `Offer-led messaging could cut through when most observed activity leans on ${dominantPhrase}.`;
  }
  return `${openAngleTitle(emotion)} appears less crowded in observed activity — ${clientName} could test it before the category converges on ${dominantPhrase}.`;
}

function actionExpectedOutcome(action: string, index: number): string {
  const lower = action.toLowerCase();
  if (lower.includes("discovery") || lower.includes("smarter")) {
    return "Differentiate from category norms and improve attention in observed channels.";
  }
  if (lower.includes("offer") || lower.includes("value") || lower.includes("saving")) {
    return "Give customers a concrete reason to respond while upper-funnel activity continues.";
  }
  if (lower.includes("meta") || lower.includes("search")) {
    return "Clarify whether to defend demand-capture channels or redirect estimated spend elsewhere.";
  }
  const defaults = [
    "Create a clearer point of difference in the next client conversation.",
    "Turn observed market signal into a testable campaign brief.",
    "Reduce guesswork on where competitors are investing attention.",
  ];
  return defaults[index] ?? defaults[defaults.length - 1];
}

function buildSalesQuestions(ctx: DeckContext): string[] {
  const { clientName, dominantPhrase, channelMix, openPhrase } = ctx;
  const topChannel = channelMix[0]?.channel ?? "upper-funnel";
  return [
    `How comfortable is ${clientName} with its current positioning versus observed competitor activity?`,
    `Is there appetite to test more distinctive messaging beyond ${dominantPhrase}?`,
    `Are you seeing enough value from current channel allocation — especially on ${topChannel}?`,
    `Would a directional test around ${openPhrase} fit your next planning cycle?`,
    `What would need to be true for ${clientName} to shift estimated spend toward an under-used channel?`,
  ].slice(0, 5);
}

function buildQuestionsToExplore(ctx: DeckContext): string[] {
  const { clientName, category, dominantPhrase, channelMix, whitespace } = ctx;
  const openTitle = whitespace[0]?.emotion
    ? openAngleTitle(String(whitespace[0].emotion)).toLowerCase()
    : openPhraseFromCtx(ctx);
  const channels = channelMix.slice(0, 2).map((r) => r.channel).join(" and ") || "observed channels";

  return [
    `Where does ${clientName} want to win in ${category} over the next 6–12 months?`,
    `How much of the current plan is defending ${dominantPhrase} versus testing ${openTitle}?`,
    `Is ${channels} the right observed mix, or is partial coverage hiding a channel gap?`,
    `Which competitor moves would concern you most if they accelerated?`,
    `What evidence would ${clientName} need before acting on these directional recommendations?`,
  ];
}

function openPhraseFromCtx(ctx: DeckContext): string {
  return ctx.openPhrase;
}

function buildDeckContext(bundle: StrategistIntelBundle, options: PitchExportOptions): DeckContext {
  const brand = resolveAgencyBrand(bundle, options.agencyContext);
  const brief = resolveBrief(bundle);
  const clientName = brief?.client_name?.trim() || brand;
  const exec = bundle.executive.data as Record<string, unknown> | null;
  const confidence = resolveConfidence(bundle);
  const category = brief?.category ?? String(exec?.dominant_market ?? "This category");
  const channelMix = parseMarketChannelMix(bundle.brief.data as Record<string, unknown> | null);
  const challengers = bundle.challengers.data ?? [];
  const dominantMessage = selectDominantTheme(
    challengers.map((c) => ({ keyword: c.keyword, creative_volume: c.creative_volume })),
    exec?.dominant_emotion ? String(exec.dominant_emotion) : null,
  );
  const marketMessages = selectSurfacedThemes(
    challengers.map((c) => ({ keyword: c.keyword, creative_volume: c.creative_volume })),
  ).map((m) => toDeckCopy(m));
  const dominantPhrase = plainThemePhrase(
    exec?.dominant_emotion ? String(exec.dominant_emotion) : "trust",
  );
  const openPhrase = plainThemePhrase(
    brief?.whitespace_emotion ??
      (exec?.top_opportunity_emotion ? String(exec.top_opportunity_emotion) : "curiosity"),
  );

  const leaders = [...(bundle.threats.data ?? [])]
    .sort(
      (a, b) =>
        num(b.creative_volume) - num(a.creative_volume) ||
        num(b.demand) - num(a.demand),
    )
    .slice(0, 5);

  const momentum = [...(bundle.momentum.data ?? [])].sort(
    (a, b) => num(b.latest_interest) - num(a.latest_interest),
  );
  const fastestGrowing =
    momentum.find((m) => String(m.momentum ?? "").toLowerCase().includes("ris")) ??
    momentum[0] ??
    null;

  return {
    brand,
    clientName,
    category,
    brief,
    exec,
    confidence,
    channelMix,
    spendRange: parseSpendRange(bundle.brief.data as Record<string, unknown> | null),
    leaders,
    fastestGrowing,
    challengers,
    whitespace: [...(bundle.whitespace.data ?? [])]
      .filter((r) => !r.emotion || isThemeAllowed(String(r.emotion)))
      .sort((a, b) => num(b.opportunity_score) - num(a.opportunity_score))
      .slice(0, 3),
    dominantMessage,
    marketMessages,
    competingThemes: competingThemeBullets(marketMessages, dominantPhrase),
    moves: plainDeckMoves(clientName),
    confidenceLabel: buildConfidenceLabel(confidence),
    dominantPhrase,
    openPhrase,
  };
}

// ─── Slides ──────────────────────────────────────────────────────────────────

function buildTitleSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);

  slide.addText("◆  MORNING SIGNAL", {
    x: MARGIN,
    y: 2.15,
    w: 9.0,
    h: 0.35,
    fontFace: THEME.fontMono,
    fontSize: 10,
    color: THEME.accent,
    charSpacing: 2,
  });

  slide.addText(ctx.brand, {
    x: MARGIN,
    y: 2.6,
    w: 9.0,
    h: 0.95,
    fontFace: THEME.fontTitle,
    fontSize: 38,
    bold: true,
    color: THEME.text,
  });

  slide.addText(ctx.category, {
    x: MARGIN,
    y: 3.55,
    w: 9.0,
    h: 0.4,
    fontFace: THEME.fontBody,
    fontSize: 14,
    color: THEME.textSecondary,
  });

  slide.addText(formatTimestamp(), {
    x: MARGIN,
    y: 4.9,
    w: 9.0,
    h: 0.35,
    fontFace: THEME.fontMono,
    fontSize: 9,
    color: THEME.textMuted,
  });

  slide.addText("RevenuAD Signal · Confidential · Directional intelligence", {
    x: MARGIN,
    y: 5.25,
    w: 9.0,
    h: 0.3,
    fontFace: THEME.fontMono,
    fontSize: 8,
    color: THEME.textMuted,
    italic: true,
  });
}

function buildExecutiveSummarySlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Executive Summary");
  addSubtitle(slide, "Directional read for your next client conversation");

  const insights = buildExecutiveInsights(ctx);
  const boxW = 4.35;
  const boxH = 1.05;
  const gap = 0.2;
  const startY = 1.45;

  const boxes: {
    label: string;
    body: string;
    variant: CalloutVariant;
    icon: string;
    col: number;
    row: number;
  }[] = [
    { label: "Key takeaway", body: insights.takeaway, variant: "gold", icon: "◆", col: 0, row: 0 },
    { label: "Risk", body: insights.risk, variant: "rose", icon: "!", col: 1, row: 0 },
    { label: "Opportunity", body: insights.opportunity, variant: "emerald", icon: "→", col: 0, row: 1 },
    { label: "Priority", body: insights.priority, variant: "blue", icon: "★", col: 1, row: 1 },
  ];

  boxes.forEach((box) => {
    addCalloutBox(slide, pptx, {
      x: MARGIN + box.col * (boxW + gap),
      y: startY + box.row * (boxH + gap),
      w: boxW,
      h: boxH,
      label: box.label,
      body: box.body,
      variant: box.variant,
      icon: box.icon,
    });
  });

  if (ctx.brief?.summary) {
    addCalloutBox(slide, pptx, {
      x: MARGIN,
      y: 3.85,
      w: 9.0,
      h: 0.95,
      label: "Observed context",
      body: toDeckCopy(ctx.brief.summary),
      variant: "neutral",
      icon: "◎",
    });
  }
}

function buildMarketSnapshotSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Market Snapshot");
  addSubtitle(slide, "Estimated category context from observed competitor activity");

  const mostActive = ctx.leaders[0]
    ? brandLabel(String(ctx.leaders[0].competitor_domain))
    : ctx.exec?.strongest_brand
      ? brandLabel(String(ctx.exec.strongest_brand))
      : "—";

  const fastest = ctx.fastestGrowing?.brand_domain
    ? brandLabel(String(ctx.fastestGrowing.brand_domain))
    : ctx.brief?.fastest_mover
      ? brandLabel(ctx.brief.fastest_mover)
      : "—";

  const dominantMsg = ctx.dominantMessage
    ? toDeckCopy(ctx.dominantMessage)
    : ctx.dominantPhrase;

  addStatTiles(slide, pptx, [
    { label: "Most active advertiser", value: mostActive },
    { label: "Fastest growing (observed)", value: fastest },
    { label: "Dominant message", value: dominantMsg.slice(0, 28) + (dominantMsg.length > 28 ? "…" : "") },
    { label: "Confidence", value: ctx.confidenceLabel.split(" — ")[0] },
  ], 1.42);

  let y = 2.35;
  slide.addText(ctx.confidenceLabel, {
    x: MARGIN,
    y,
    w: 9.0,
    h: 0.28,
    fontFace: THEME.fontBody,
    fontSize: 9,
    color: THEME.textMuted,
    italic: true,
  });
  y += 0.45;

  if (ctx.spendRange) {
    addCalloutBox(slide, pptx, {
      x: MARGIN,
      y,
      w: 4.4,
      h: 0.85,
      label: "Estimated activity band",
      body: ctx.spendRange.label,
      variant: "neutral",
      icon: "$",
    });
  }

  if (ctx.leaders.length) {
    const leaderLines = ctx.leaders.slice(0, 4).map((r) => {
      const name = brandLabel(String(r.competitor_domain));
      const vol = num(r.creative_volume);
      if (vol > 0) return `${name} — ${vol.toLocaleString()} observed creatives`;
      return `${name} — tracked in category`;
    });
    addCalloutBox(slide, pptx, {
      x: ctx.spendRange ? 5.25 : MARGIN,
      y,
      w: ctx.spendRange ? 4.4 : 9.0,
      h: 1.35,
      label: "Observed competitive set",
      body: leaderLines.join("\n"),
      variant: "neutral",
      icon: "◎",
    });
    y += 1.55;
  }

  addCalloutBox(slide, pptx, {
    x: MARGIN,
    y: Math.max(y, 3.35),
    w: 9.0,
    h: 0.85,
    label: "Category read",
    body: `Most observed messaging in ${ctx.category} leans on ${ctx.dominantPhrase}. Few advertisers appear to own a genuinely distinctive claim yet.`,
    variant: "gold",
    icon: "◆",
  });
}

function buildChannelMixSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Channel Mix");
  addSubtitle(slide, "Observed share of activity across channels — directional, not verified spend");

  const afterBars = addChannelMixBars(slide, pptx, ctx.channelMix, 1.42);

  addCalloutBox(slide, pptx, {
    x: MARGIN,
    y: afterBars + 0.15,
    w: 9.0,
    h: 0.95,
    label: "What this suggests",
    body: buildChannelMixSuggestion(ctx.channelMix),
    variant: "gold",
    icon: "→",
  });
}

function buildCompetitorsSayingSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "What Competitors Are Saying");
  addSubtitle(slide, "Themes repeated across indexed creatives");

  addSectionLabel(slide, "Most competitors are competing on:", 1.42, THEME.textMuted);
  addIconBullet(slide, ctx.competingThemes, 1.62, 1.1);

  const clientRead = ctx.dominantMessage
    ? `Observed activity suggests competitors keep returning to ${toDeckCopy(ctx.dominantMessage)}. ${ctx.clientName} will need a sharper angle to avoid sounding like everyone else.`
    : `Observed messaging clusters around ${ctx.dominantPhrase}. ${ctx.clientName} should pressure-test whether its current positioning is distinctive enough.`;

  addCalloutBox(slide, pptx, {
    x: MARGIN,
    y: 2.85,
    w: 9.0,
    h: 0.9,
    label: `What this means for ${ctx.clientName}`,
    body: clientRead,
    variant: "blue",
    icon: "◆",
  });

  if (ctx.marketMessages.length) {
    addSectionLabel(slide, "Messages in observed rotation", 3.95, THEME.textMuted);
    addIconBullet(slide, ctx.marketMessages.slice(0, 5), 4.15, 1.5, "·");
  }
}

function buildOpenOpportunitiesSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Open Opportunities");
  addSubtitle(slide, "Estimated angles with lighter observed competition");

  if (!ctx.whitespace.length) {
    addCalloutBox(slide, pptx, {
      x: MARGIN,
      y: 1.5,
      w: 9.0,
      h: 0.85,
      label: "Partial coverage",
      body: "No clear open angles in the current bundle. Refresh after more brands are scanned.",
      variant: "neutral",
      icon: "◎",
    });
    return;
  }

  ctx.whitespace.slice(0, 3).forEach((row, i) => {
    const y = 1.42 + i * 1.35;
    const emotion = String(row.emotion ?? "");
    const title = openAngleTitle(emotion);
    const saturated =
      String(row.market_density ?? "").toLowerCase() === "high" ||
      String(row.strategic_priority ?? "").toLowerCase() === "saturated";
    const angle = toDeckCopy(
      buildOpenAngleCopy({
        clientName: ctx.clientName,
        territoryRaw: emotion,
        saturated,
      }),
    );
    const why = openOpportunityWhyItMatters(emotion, ctx.dominantPhrase, ctx.clientName);

    slide.addText(title, {
      x: MARGIN,
      y,
      w: 9.0,
      h: 0.3,
      fontFace: THEME.fontTitle,
      fontSize: 14,
      bold: true,
      color: THEME.accentEmerald,
    });
    slide.addText(angle, {
      x: MARGIN,
      y: y + 0.32,
      w: 9.0,
      h: 0.45,
      fontFace: THEME.fontBody,
      fontSize: 10,
      color: THEME.textSecondary,
      valign: "top",
    });
    addCalloutBox(slide, pptx, {
      x: MARGIN,
      y: y + 0.78,
      w: 9.0,
      h: 0.48,
      label: "Why it matters",
      body: why,
      variant: "emerald",
      icon: "→",
    });
  });
}

function buildRecommendedActionsSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Recommended Actions");
  addSubtitle(slide, "Three directional moves — validate before committing budget");

  ctx.moves.slice(0, 3).forEach((move, i) => {
    const y = 1.42 + i * 1.38;
    slide.addText(String(i + 1), {
      x: MARGIN,
      y,
      w: 0.4,
      h: 0.4,
      fontFace: THEME.fontTitle,
      fontSize: 18,
      bold: true,
      color: THEME.accent,
      align: "center",
    });
    addCalloutBox(slide, pptx, {
      x: MARGIN + 0.5,
      y,
      w: 8.5,
      h: 0.58,
      label: "Action",
      body: move,
      variant: "gold",
      icon: "★",
    });
    addCalloutBox(slide, pptx, {
      x: MARGIN + 0.5,
      y: y + 0.65,
      w: 8.5,
      h: 0.58,
      label: "Expected outcome",
      body: actionExpectedOutcome(move, i),
      variant: "neutral",
      icon: "→",
    });
  });
}

function buildMeetingTalkingPointsSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Meeting Talking Points");
  addSubtitle(slide, "Questions to open the conversation — not statements to read aloud");

  const questions = buildSalesQuestions(ctx);
  questions.forEach((q, i) => {
    const y = 1.42 + i * 0.72;
    slide.addText("?", {
      x: MARGIN,
      y,
      w: 0.35,
      h: 0.35,
      fontFace: THEME.fontTitle,
      fontSize: 14,
      bold: true,
      color: THEME.accent,
      align: "center",
    });
    slide.addText(q, {
      x: MARGIN + 0.45,
      y,
      w: 8.5,
      h: 0.62,
      fontFace: THEME.fontBody,
      fontSize: 11,
      color: THEME.textSecondary,
      valign: "top",
    });
  });
}

function buildQuestionsToExploreSlide(pptx: pptxgen, ctx: DeckContext) {
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide);
  addSlideTitle(slide, "Questions to Explore");
  addSubtitle(slide, "Discussion prompts to leave the room with clear next steps");

  const prompts = buildQuestionsToExplore(ctx);
  prompts.forEach((prompt, i) => {
    const y = 1.42 + i * 0.78;
    addCalloutBox(slide, pptx, {
      x: MARGIN,
      y,
      w: 9.0,
      h: 0.62,
      label: `Prompt ${i + 1}`,
      body: prompt,
      variant: i % 2 === 0 ? "blue" : "neutral",
      icon: "◎",
    });
  });

  slide.addText("All reads are directional — validate against client data before acting.", {
    x: MARGIN,
    y: 5.35,
    w: 9.0,
    h: 0.3,
    fontFace: THEME.fontMono,
    fontSize: 8,
    color: THEME.textMuted,
    italic: true,
  });
}

/**
 * Build and download a strategist-ready pitch deck from the intelligence bundle.
 * Cover + 7 content slides + Questions to Explore — plain English, directional language.
 */
export async function generatePitchDeck(
  bundle: StrategistIntelBundle,
  options: PitchExportOptions = {},
): Promise<void> {
  const ctx = buildDeckContext(bundle, options);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "RevenuAD Signal";
  pptx.subject = "Market Intelligence Brief";
  pptx.title = `${ctx.brand} · Market Intel`;

  buildTitleSlide(pptx, ctx);
  buildExecutiveSummarySlide(pptx, ctx);
  buildMarketSnapshotSlide(pptx, ctx);
  buildChannelMixSlide(pptx, ctx);
  buildCompetitorsSayingSlide(pptx, ctx);
  buildOpenOpportunitiesSlide(pptx, ctx);
  buildRecommendedActionsSlide(pptx, ctx);
  buildMeetingTalkingPointsSlide(pptx, ctx);
  buildQuestionsToExploreSlide(pptx, ctx);

  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `market-intel-${fileSlug(ctx.brand)}-${datePart}.pptx`;
  await pptx.writeFile({ fileName });
}
