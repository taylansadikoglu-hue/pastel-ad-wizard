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

/** Dark strategist deck — client-ready, no internal field names. */
const THEME = {
  bg: "0A0A0A",
  surface: "171717",
  border: "262626",
  text: "F5F5F5",
  textSecondary: "A3A3A3",
  textMuted: "737373",
  accent: "FBBF24",
  accentEmerald: "34D399",
  channelBar: "C9963A",
  fontTitle: "Segoe UI",
  fontBody: "Calibri",
  fontMono: "Courier New",
} as const;

const SLIDE_LABEL = "Market Intel · RevenuAD Signal";

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
};

  if (value == null || value === "") return "—";
  return String(value);
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cell(text: unknown, opts: pptxgen.TableCellProps = {}): TableCell {
  return {
    text: str(text),
    options: {
      color: THEME.textSecondary,
      fontFace: THEME.fontBody,
      fontSize: 9,
      valign: "middle",
      ...opts,
    },
  };
}

function slideBackground(slide: pptxgen.Slide) {
  slide.background = { color: THEME.bg };
}

function addSlideLabel(slide: pptxgen.Slide, label: string, y = 0.35) {
  slide.addText(label.toUpperCase(), {
    x: 0.55,
    y,
    w: 8.9,
    h: 0.25,
    fontFace: THEME.fontMono,
    fontSize: 8,
    color: THEME.textMuted,
    charSpacing: 1.2,
  });
}

function addSlideTitle(slide: pptxgen.Slide, title: string, y = 0.62) {
  slide.addText(title, {
    x: 0.55,
    y,
    w: 8.9,
    h: 0.45,
    fontFace: THEME.fontTitle,
    fontSize: 22,
    bold: true,
    color: THEME.text,
  });
}

function addSubtitle(slide: pptxgen.Slide, text: string, y = 1.05) {
  slide.addText(text, {
    x: 0.55,
    y,
    w: 8.9,
    h: 0.25,
    fontFace: THEME.fontBody,
    fontSize: 9,
    color: THEME.textMuted,
  });
}

function addBodyText(slide: pptxgen.Slide, text: string, y: number, h = 0.8, bold = false) {
  slide.addText(text, {
    x: 0.55,
    y,
    w: 8.9,
    h,
    fontFace: THEME.fontBody,
    fontSize: 11,
    color: bold ? THEME.text : THEME.textSecondary,
    bold,
    valign: "top",
  });
}

function addBulletList(slide: pptxgen.Slide, items: string[], y: number, h = 3.5) {
  if (!items.length) {
    addBodyText(slide, "Not enough indexed signal yet — run a scan and refresh the brief.", y, 0.5);
    return;
  }
  slide.addText(
    items.map((item) => ({ text: item, options: { bullet: true, breakLine: true } })),
    {
      x: 0.65,
      y,
      w: 8.7,
      h,
      fontFace: THEME.fontBody,
      fontSize: 11,
      color: THEME.textSecondary,
      valign: "top",
    },
  );
}

function addNumberedActions(slide: pptxgen.Slide, items: string[], y = 1.35) {
  if (!items.length) {
    addBodyText(slide, "Recommendations will populate once market signal is available.", y, 0.5);
    return;
  }
  items.forEach((item, i) => {
    const rowY = y + i * 0.95;
    slide.addText(String(i + 1), {
      x: 0.55,
      y: rowY,
      w: 0.35,
      h: 0.35,
      fontFace: THEME.fontTitle,
      fontSize: 14,
      bold: true,
      color: THEME.accent,
      align: "center",
    });
    slide.addText(item, {
      x: 1.05,
      y: rowY,
      w: 8.35,
      h: 0.85,
      fontFace: THEME.fontBody,
      fontSize: 11,
      color: THEME.text,
      valign: "top",
    });
  });
}

function addAggregateRow(slide: pptxgen.Slide, items: { label: string; value: string }[], y = 1.2) {
  const colW = 8.9 / Math.max(items.length, 1);
  items.forEach((item, i) => {
    const x = 0.55 + i * colW;
    slide.addText(item.label.toUpperCase(), {
      x,
      y,
      w: colW - 0.1,
      h: 0.2,
      fontFace: THEME.fontMono,
      fontSize: 7,
      color: THEME.textMuted,
    });
    slide.addText(item.value, {
      x,
      y: y + 0.22,
      w: colW - 0.1,
      h: 0.35,
      fontFace: THEME.fontTitle,
      fontSize: 15,
      bold: true,
      color: THEME.text,
    });
  });
}

function addChannelMixBars(slide: pptxgen.Slide, pptx: pptxgen, rows: ChannelMixRow[], y = 1.45) {
  if (!rows.length) {
    addBodyText(
      slide,
      "Channel mix unavailable for this market view. Check individual advertiser war rooms for stronger channel coverage.",
      y,
      0.6,
    );
    return;
  }

  rows.slice(0, 6).forEach((row, i) => {
    const rowY = y + i * 0.48;
    const pct = Math.max(0, Math.min(100, row.pct));
    slide.addText(row.channel, {
      x: 0.55,
      y: rowY,
      w: 1.15,
      h: 0.28,
      fontFace: THEME.fontBody,
      fontSize: 10,
      color: THEME.text,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 1.8,
      y: rowY + 0.1,
      w: 5.8,
      h: 0.12,
      fill: { color: THEME.surface },
      line: { color: THEME.border, width: 0.5 },
    });
    if (pct > 0) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 1.8,
        y: rowY + 0.1,
        w: 5.8 * (pct / 100),
        h: 0.12,
        fill: { color: THEME.channelBar },
      });
    }
    slide.addText(`${Math.round(pct)}%`, {
      x: 7.75,
      y: rowY,
      w: 0.7,
      h: 0.28,
      fontFace: THEME.fontTitle,
      fontSize: 11,
      bold: true,
      color: THEME.text,
      align: "right",
    });
  });
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

function buildDeckWhatThisMeans(input: {
  clientName: string;
  category: string;
  dominantTheme?: string | null;
  openTheme?: string | null;
}): string {
  const client = input.clientName.trim() || "Your client";
  const category = input.category.trim() || "This category";
  const dominant = plainThemePhrase(input.dominantTheme ?? "trust");
  const open = plainThemePhrase(input.openTheme ?? "curiosity");

  return (
    `${category} activity is crowded, but most brands are still competing on ${dominant}. ` +
    `That makes it harder for ${client} to stand out with generic confidence messaging. ` +
    `The clearest opening is to test a more distinctive angle around ${open}, flexibility, and customer control.`
  );
}

function buildMeetingTalkingPoints(bundle: StrategistIntelBundle, clientName: string): string[] {
  const brief = resolveBrief(bundle);
  const exec = bundle.executive.data as Record<string, unknown> | null;
  const channelMix = parseMarketChannelMix(bundle.brief.data as Record<string, unknown> | null);
  const moves = plainDeckMoves(clientName);
  const challengers = bundle.challengers.data ?? [];
  const dominantMessage = selectDominantTheme(
    challengers.map((c) => ({ keyword: c.keyword, creative_volume: c.creative_volume })),
    exec?.dominant_emotion ? String(exec.dominant_emotion) : null,
  );
  const whitespace = [...(bundle.whitespace.data ?? [])]
    .filter((r) => !r.emotion || isThemeAllowed(String(r.emotion)))
    .slice(0, 1);

  const points: string[] = [];

  if (brief?.headline) {
    points.push(toDeckCopy(brief.headline));
  } else if (brief?.summary) {
    points.push(toDeckCopy(brief.summary.split(".")[0] + "."));
  }

  if (exec?.strongest_brand) {
    const market = exec.dominant_market ? String(exec.dominant_market) : "the category";
    points.push(`${brandLabel(String(exec.strongest_brand))} is leading observed activity in ${market}.`);
  }

  if (channelMix[0]) {
    points.push(
      `Most observed activity is showing up on ${channelMix[0].channel} (${Math.round(channelMix[0].pct)}% share).`,
    );
  } else if (dominantMessage) {
    points.push(`Competitors keep returning to ${toDeckCopy(dominantMessage)} messaging.`);
  }

  if (whitespace[0]?.emotion) {
    const title = openAngleTitle(String(whitespace[0].emotion));
    points.push(`${clientName} could test ${title.toLowerCase()} before the category crowds it.`);
  }

  if (moves[0]) points.push(moves[0]);

  if (points.length < 3) {
    points.push(
      `Walk in with one channel read, one message angle, and one concrete test for ${clientName}.`,
    );
  }

  return points.slice(0, 5);
}

function buildTitleSlide(pptx: pptxgen, brand: string, category: string | null) {
  const slide = pptx.addSlide();
  slideBackground(slide);

  slide.addText("Morning Signal", {
    x: 0.55,
    y: 2.1,
    w: 8.9,
    h: 0.35,
    fontFace: THEME.fontMono,
    fontSize: 10,
    color: THEME.accent,
    charSpacing: 2,
  });

  slide.addText(brand, {
    x: 0.55,
    y: 2.55,
    w: 8.9,
    h: 0.9,
    fontFace: THEME.fontTitle,
    fontSize: 36,
    bold: true,
    color: THEME.text,
  });

  if (category) {
    slide.addText(category, {
      x: 0.55,
      y: 3.45,
      w: 8.9,
      h: 0.4,
      fontFace: THEME.fontBody,
      fontSize: 14,
      color: THEME.textSecondary,
    });
  }

  slide.addText(formatTimestamp(), {
    x: 0.55,
    y: 4.85,
    w: 8.9,
    h: 0.35,
    fontFace: THEME.fontMono,
    fontSize: 9,
    color: THEME.textMuted,
  });

  slide.addText("RevenuAD Signal · Confidential", {
    x: 0.55,
    y: 5.2,
    w: 8.9,
    h: 0.3,
    fontFace: THEME.fontMono,
    fontSize: 8,
    color: THEME.textMuted,
    italic: true,
  });
}

function buildExecutiveSummarySlide(pptx: pptxgen, bundle: StrategistIntelBundle, clientName: string) {
  const brief = resolveBrief(bundle);
  const exec = bundle.executive.data as Record<string, unknown> | null;
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "Executive Summary");
  addSubtitle(slide, "Headline read for tomorrow's client conversation");

  let y = 1.35;
  const headline = toDeckCopy(brief?.headline) || "Market intelligence brief";
  slide.addText(headline, {
    x: 0.55,
    y,
    w: 8.9,
    h: 0.55,
    fontFace: THEME.fontTitle,
    fontSize: 16,
    bold: true,
    color: THEME.text,
    valign: "top",
  });
  y += 0.7;

  const whatThisMeans = buildDeckWhatThisMeans({
    clientName,
    category: brief?.category ?? String(exec?.dominant_market ?? "This category"),
    dominantTheme: exec?.dominant_emotion ? String(exec.dominant_emotion) : "trust",
    openTheme: brief?.whitespace_emotion ?? (exec?.top_opportunity_emotion ? String(exec.top_opportunity_emotion) : null),
  });

  slide.addText("WHAT THIS MEANS", {
    x: 0.55,
    y,
    w: 8.9,
    h: 0.2,
    fontFace: THEME.fontMono,
    fontSize: 7,
    color: THEME.accent,
  });
  addBodyText(slide, whatThisMeans, y + 0.22, 0.75);
  y += 1.05;

  if (brief?.summary) {
    addBodyText(slide, toDeckCopy(brief.summary), y, 0.85);
    y += 0.95;
  }

  if (brief?.recommended_action) {
    slide.addText("PRIORITY ACTION", {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.2,
      fontFace: THEME.fontMono,
      fontSize: 7,
      color: THEME.accentEmerald,
    });
    addBodyText(slide, toDeckCopy(brief.recommended_action), y + 0.22, 0.55, true);
  }
}

function buildMarketSnapshotSlide(pptx: pptxgen, bundle: StrategistIntelBundle) {
  const brief = resolveBrief(bundle);
  const confidence = resolveConfidence(bundle);
  const exec = bundle.executive.data as Record<string, unknown> | null;
  const spendRange = parseSpendRange(bundle.brief.data as Record<string, unknown> | null);
  const leaders = [...(bundle.threats.data ?? [])]
    .sort(
      (a, b) =>
        num(b.creative_volume) - num(a.creative_volume) ||
        num(b.demand) - num(a.demand),
    )
    .slice(0, 5);

  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "Market Snapshot");
  addSubtitle(slide, "Category context from observed competitor activity");

  const stats: { label: string; value: string }[] = [];
  if (brief?.category || exec?.dominant_market) {
    stats.push({ label: "Category", value: str(brief?.category ?? exec?.dominant_market) });
  }
  if (exec?.strongest_brand) {
    stats.push({ label: "Market leader", value: brandLabel(String(exec.strongest_brand)) });
  }
  if (confidence?.brands_tracked != null) {
    stats.push({ label: "Brands tracked", value: num(confidence.brands_tracked).toLocaleString() });
  }
  if (confidence?.ads_analysed != null) {
    stats.push({ label: "Ads analysed", value: num(confidence.ads_analysed).toLocaleString() });
  }
  if (stats.length) addAggregateRow(slide, stats.slice(0, 4), 1.25);

  let y = 2.05;
  if (spendRange) {
    slide.addText("DIRECTIONAL ACTIVITY BAND", {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.2,
      fontFace: THEME.fontMono,
      fontSize: 7,
      color: THEME.textMuted,
    });
    addBodyText(slide, spendRange.label, y + 0.22, 0.35, true);
    y += 0.75;
  }

  if (exec?.dominant_emotion) {
    const phrase = plainThemePhrase(String(exec.dominant_emotion));
    addBodyText(
      slide,
      `Most brands are leaning on ${phrase} messaging. Few are making a genuinely distinctive claim.`,
      y,
      0.55,
    );
    y += 0.7;
  }

  if (leaders.length) {
    slide.addText("MOST ACTIVE COMPETITORS", {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.2,
      fontFace: THEME.fontMono,
      fontSize: 7,
      color: THEME.textMuted,
    });
    const leaderLines = leaders.map((r) => {
      const name = brandLabel(String(r.competitor_domain));
      const vol = num(r.creative_volume);
      const demand = num(r.demand);
      if (vol > 0) return `${name} — ${vol.toLocaleString()} active creatives`;
      if (demand > 0) return `${name} — ${demand.toLocaleString()} observed demand signals`;
      return `${name} — tracked competitor`;
    });
    addBulletList(slide, leaderLines, y + 0.25, 2.2);
  }
}

function buildChannelMixSlide(pptx: pptxgen, bundle: StrategistIntelBundle) {
  const channelMix = parseMarketChannelMix(bundle.brief.data as Record<string, unknown> | null);
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "Channel Mix");
  addSubtitle(slide, "Where observed activity is concentrated across the category");
  addChannelMixBars(slide, pptx, channelMix);
}

function buildCompetitorsSayingSlide(pptx: pptxgen, bundle: StrategistIntelBundle) {
  const exec = bundle.executive.data as Record<string, unknown> | null;
  const challengers = bundle.challengers.data ?? [];
  const pitch = bundle.pitch.data ?? [];
  const marketMessages = selectSurfacedThemes(
    challengers.map((c) => ({
      keyword: c.keyword,
      creative_volume: c.creative_volume,
    })),
  ).map((m) => toDeckCopy(m));
  const dominantMessage = selectDominantTheme(
    challengers.map((c) => ({ keyword: c.keyword, creative_volume: c.creative_volume })),
    exec?.dominant_emotion ? String(exec.dominant_emotion) : null,
  );

  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "What Competitors Are Saying");
  addSubtitle(slide, "Repeated messages showing up across indexed creatives");

  let y = 1.35;
  if (dominantMessage) {
    const contested =
      pitch.map((p) => p.dominant_emotion).filter(Boolean).length >= 2;
    addBodyText(
      slide,
      `The market keeps coming back to ${toDeckCopy(dominantMessage)}.${
        contested ? " Most brands are fighting over the same angle." : " Few brands own a distinct message yet."
      }`,
      y,
      0.65,
    );
    y += 0.85;
  }

  if (marketMessages.length) {
    slide.addText("MESSAGES IN ROTATION", {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.2,
      fontFace: THEME.fontMono,
      fontSize: 7,
      color: THEME.textMuted,
    });
    addBulletList(slide, marketMessages, y + 0.25, 2.8);
  } else if (!dominantMessage) {
    addBodyText(
      slide,
      "Messaging themes will appear as more competitor creatives are indexed and classified.",
      y,
      0.6,
    );
  }
}

function buildOpenOpportunitiesSlide(pptx: pptxgen, bundle: StrategistIntelBundle, clientName: string) {
  const whitespace = [...(bundle.whitespace.data ?? [])]
    .filter((r) => !r.emotion || isThemeAllowed(String(r.emotion)))
    .sort((a, b) => num(b.opportunity_score) - num(a.opportunity_score))
    .slice(0, 4);

  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "Open Opportunities");
  addSubtitle(slide, "Angles competitors have not consistently owned");

  if (!whitespace.length) {
    addBodyText(
      slide,
      "No clear open angles yet. Refresh after more brands are scanned or check individual advertiser gaps.",
      1.4,
      0.7,
    );
    return;
  }

  whitespace.forEach((row, i) => {
    const y = 1.35 + i * 1.15;
    const title = openAngleTitle(row.emotion ? String(row.emotion) : null);
    const saturated =
      String(row.market_density ?? "").toLowerCase() === "high" ||
      String(row.strategic_priority ?? "").toLowerCase() === "saturated";
    const body = toDeckCopy(
      buildOpenAngleCopy({
        clientName,
        territoryRaw: String(row.emotion ?? ""),
        saturated,
      }),
    );

    slide.addText(title, {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.3,
      fontFace: THEME.fontTitle,
      fontSize: 13,
      bold: true,
      color: THEME.accentEmerald,
    });
    addBodyText(slide, body, y + 0.32, 0.72);
  });
}

function buildRecommendedActionsSlide(pptx: pptxgen, clientName: string) {
  const moves = plainDeckMoves(clientName);
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "Recommended Actions");
  addSubtitle(slide, "Three practical moves to take into the room");
  addNumberedActions(slide, moves);
}

function buildMeetingTalkingPointsSlide(pptx: pptxgen, bundle: StrategistIntelBundle, clientName: string) {
  const points = buildMeetingTalkingPoints(bundle, clientName);
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, SLIDE_LABEL);
  addSlideTitle(slide, "Meeting Talking Points");
  addSubtitle(slide, "Bullets to open tomorrow's client conversation");
  addBulletList(slide, points, 1.4, 3.8);
}

/**
 * Build and download a strategist-ready pitch deck from the intelligence bundle.
 * Fixed slide order — plain English only, no internal scores or engineer labels.
 */
export async function generatePitchDeck(
  bundle: StrategistIntelBundle,
  options: PitchExportOptions = {},
): Promise<void> {
  const brand = resolveAgencyBrand(bundle, options.agencyContext);
  const brief = resolveBrief(bundle);
  const clientName = brief?.client_name?.trim() || brand;

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "RevenuAD Signal";
  pptx.subject = "Market Intelligence Brief";
  pptx.title = `${brand} · Market Intel`;

  buildTitleSlide(pptx, brand, brief?.category ?? null);
  buildExecutiveSummarySlide(pptx, bundle, clientName);
  buildMarketSnapshotSlide(pptx, bundle);
  buildChannelMixSlide(pptx, bundle);
  buildCompetitorsSayingSlide(pptx, bundle);
  buildOpenOpportunitiesSlide(pptx, bundle, clientName);
  buildRecommendedActionsSlide(pptx, clientName);
  buildMeetingTalkingPointsSlide(pptx, bundle, clientName);

  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `market-intel-${fileSlug(brand)}-${datePart}.pptx`;
  await pptx.writeFile({ fileName });
}
