import pptxgen from "pptxgenjs";
import {
  normalizeRadBrief,
  normalizeRadConfidence,
  type StrategistIntelBundle,
} from "@/lib/api-gateway";
import type { AgencyContext } from "@/lib/agency-watchlist";
import { watchlistDisplayName } from "@/lib/agency-watchlist";
import {
  buildRecommendedMoves,
  buildWhatThisMeans,
  sanitizeInsightCopy,
  translateTerritory,
} from "@/lib/radInsightTranslator";
import {
  MODULE_META,
  type DataModuleId,
} from "@/components/adpalette/strategist/data-module-types";

/** Dark-dense deck theme — mirrors cockpit surfaces without leaking internals. */
const THEME = {
  bg: "0A0A0A",
  surface: "171717",
  border: "262626",
  text: "F5F5F5",
  textSecondary: "A3A3A3",
  textMuted: "737373",
  accent: "FBBF24",
  accentEmerald: "34D399",
  fontTitle: "Segoe UI",
  fontBody: "Calibri",
  fontMono: "Courier New",
} as const;

const MODULE_ORDER: DataModuleId[] = [
  "executive",
  "competitors",
  "momentum",
  "challengers",
  "whitespace",
  "pitch",
];

/** Client-facing module copy — excludes internal view/table names from MODULE_META.source. */
const MODULE_EXPORT_COPY: Record<DataModuleId, { subtitle: string }> = {
  executive: { subtitle: "What's happening in the market" },
  competitors: { subtitle: "Who is leading — share of observed activity" },
  momentum: { subtitle: "Who is getting louder" },
  challengers: { subtitle: "What the market keeps saying" },
  whitespace: { subtitle: "What nobody owns yet — open angles" },
  pitch: { subtitle: "What I'd recommend tomorrow" },
};

export type PitchExportOptions = {
  agencyContext?: AgencyContext | null;
  /** Defaults to modules with data in the bundle. */
  modules?: DataModuleId[];
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
  whitespace_category: string | null;
  whitespace_emotion: string | null;
  whitespace_score: number | null;
};

type ConfidenceShape = {
  ads_analysed: number | null;
  brands_tracked: number | null;
  trend_points: number | null;
  classification_coverage: number | null;
};

type TableCell = pptxgen.TableCell;

function str(value: unknown): string {
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

function headerCell(text: string): TableCell {
  return cell(text, {
    color: THEME.textMuted,
    bold: true,
    fontFace: THEME.fontMono,
    fontSize: 8,
  });
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
      fontSize: 16,
      bold: true,
      color: THEME.text,
    });
  });
}

function addDataTable(
  slide: pptxgen.Slide,
  headers: string[],
  rows: (string | number | null)[][],
  y = 1.85,
) {
  const tableRows: TableCell[][] = [
    headers.map((h) => headerCell(h)),
    ...rows.map((row) =>
      row.map((c) =>
        cell(c, {
          fontFace: THEME.fontMono,
          fontSize: 8,
          color: THEME.text,
        }),
      ),
    ),
  ];

  slide.addTable(tableRows, {
    x: 0.55,
    y,
    w: 8.9,
    colW: headers.map(() => 8.9 / headers.length),
    border: { type: "solid", pt: 0.5, color: THEME.border },
    fill: { color: THEME.surface },
    fontFace: THEME.fontBody,
    fontSize: 8,
    color: THEME.textSecondary,
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

function activeModules(bundle: StrategistIntelBundle): DataModuleId[] {
  const brief = resolveBrief(bundle);
  const exec = bundle.executive.data as Record<string, unknown> | null;

  const hasExec = Boolean(
    exec &&
      (exec.dominant_market || exec.strongest_brand || exec.dominant_emotion || exec.top_opportunity_category),
  );

  const flags: Record<DataModuleId, boolean> = {
    competitors: (bundle.threats.data ?? []).length > 0,
    challengers: (bundle.challengers.data ?? []).length > 0,
    whitespace: (bundle.whitespace.data ?? []).length > 0,
    momentum: (bundle.momentum.data ?? []).length > 0,
    executive: hasExec || Boolean(brief),
    pitch: Boolean(brief),
  };

  return MODULE_ORDER.filter((id) => flags[id]);
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
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

function buildExecutiveSlide(pptx: pptxgen, bundle: StrategistIntelBundle) {
  const brief = resolveBrief(bundle);
  const confidence = resolveConfidence(bundle);
  const exec = bundle.executive.data as Record<string, unknown> | null;
  if (!brief) return;

  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, "Market Intel · RevenuAD Signal");
  addSlideTitle(slide, sanitizeInsightCopy(brief.headline) ?? "Market intelligence brief");

  let y = 1.25;
  const clientName = brief.client_name ?? "Your client";
  const whatThisMeans = buildWhatThisMeans({
    clientName,
    category: brief.category ?? String(exec?.dominant_market ?? "This category"),
    dominantTheme: exec?.dominant_emotion ? String(exec.dominant_emotion) : "trust",
    openTheme: brief.whitespace_emotion ?? (exec?.top_opportunity_emotion ? String(exec.top_opportunity_emotion) : null),
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
  slide.addText(whatThisMeans, {
    x: 0.55,
    y: y + 0.22,
    w: 8.9,
    h: 0.65,
    fontFace: THEME.fontBody,
    fontSize: 10,
    color: THEME.textSecondary,
    valign: "top",
  });
  y += 0.95;

  if (brief.summary) {
    slide.addText(sanitizeInsightCopy(brief.summary), {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.75,
      fontFace: THEME.fontBody,
      fontSize: 11,
      color: THEME.textSecondary,
      valign: "top",
    });
    y += 0.9;
  }

  const pillars: { label: string; value: string }[] = [];
  if (brief.strongest_threat) pillars.push({ label: "Pressure on client", value: brief.strongest_threat });
  if (brief.emerging_challenger) pillars.push({ label: "Brand to watch", value: brief.emerging_challenger });
  if (brief.strategic_opening || brief.whitespace_emotion) {
    pillars.push({
      label: "Open angle",
      value: brief.whitespace_emotion
        ? translateTerritory(brief.whitespace_emotion)
        : sanitizeInsightCopy(brief.strategic_opening ?? "—"),
    });
  }

  if (pillars.length) {
    addAggregateRow(slide, pillars, y);
    y += 0.85;
  }

  if (brief.recommended_action || buildRecommendedMoves(clientName).length) {
    slide.addText("RECOMMENDED NEXT MOVES", {
      x: 0.55,
      y,
      w: 8.9,
      h: 0.2,
      fontFace: THEME.fontMono,
      fontSize: 7,
      color: THEME.accent,
    });
    const moves = buildRecommendedMoves(clientName);
    slide.addText(
      moves.map((m, i) => `${i + 1}. ${m}`).join("\n"),
      {
      x: 0.55,
      y: y + 0.22,
      w: 8.9,
      h: 0.75,
      fontFace: THEME.fontBody,
      fontSize: 10,
      bold: true,
      color: THEME.text,
      valign: "top",
    });
    y += 1.0;
  }

  if (confidence) {
    const confItems: { label: string; value: string }[] = [];
    if (confidence.ads_analysed != null) {
      confItems.push({ label: "Creatives analysed", value: num(confidence.ads_analysed).toLocaleString() });
    }
    if (confidence.brands_tracked != null) {
      confItems.push({ label: "Brands tracked", value: num(confidence.brands_tracked).toLocaleString() });
    }
    if (confidence.trend_points != null) {
      confItems.push({ label: "Trend points", value: num(confidence.trend_points).toLocaleString() });
    }
    if (confidence.classification_coverage != null) {
      confItems.push({
        label: "Coverage",
        value: `${num(confidence.classification_coverage).toFixed(0)}%`,
      });
    }
    if (confItems.length) addAggregateRow(slide, confItems, y);
  }
}

function buildModuleSlide(pptx: pptxgen, moduleId: DataModuleId, bundle: StrategistIntelBundle) {
  const meta = MODULE_META[moduleId];
  const copy = MODULE_EXPORT_COPY[moduleId];
  const slide = pptx.addSlide();
  slideBackground(slide);
  addSlideLabel(slide, `${meta.index} · Evidence`);
  addSlideTitle(slide, meta.title);

  slide.addText(copy.subtitle, {
    x: 0.55,
    y: 1.05,
    w: 8.9,
    h: 0.25,
    fontFace: THEME.fontMono,
    fontSize: 8,
    color: THEME.textMuted,
  });

  switch (moduleId) {
    case "competitors": {
      const rows = [...(bundle.threats.data ?? [])]
        .sort((a, b) => num(b.threat_score) - num(a.threat_score))
        .slice(0, 8);
      const scores = rows.map((r) => num(r.threat_score));
      addAggregateRow(slide, [
        { label: "Tracked competitors", value: String(rows.length) },
        { label: "Avg observed pressure", value: scores.length ? avg(scores).toFixed(1) : "—" },
        { label: "Peak observed pressure", value: scores.length ? String(Math.max(...scores)) : "—" },
      ]);
      addDataTable(
        slide,
        ["Brand", "Observed pressure", "Observed demand", "Creatives"],
        rows.map((r) => [
          str(r.competitor_domain),
          str(r.threat_score),
          num(r.demand).toLocaleString(),
          num(r.creative_volume).toLocaleString(),
        ]),
      );
      break;
    }
    case "challengers": {
      const rows = [...(bundle.challengers.data ?? [])]
        .sort((a, b) => num(b.opportunity_score) - num(a.opportunity_score))
        .slice(0, 8);
      const scores = rows.map((r) => num(r.opportunity_score));
      addAggregateRow(slide, [
        { label: "Messages tracked", value: String(rows.length) },
        { label: "Avg signal strength", value: scores.length ? avg(scores).toFixed(1) : "—" },
        { label: "Strongest signal", value: scores.length ? String(Math.max(...scores)) : "—" },
      ]);
      addDataTable(
        slide,
        ["Brand", "Keyword", "Signal strength", "Observed demand", "Trend"],
        rows.map((r) => [
          str(r.brand_domain),
          str(r.keyword),
          str(r.opportunity_score),
          num(r.latest_interest).toLocaleString(),
          str(r.momentum),
        ]),
      );
      break;
    }
    case "whitespace": {
      const rows = [...(bundle.whitespace.data ?? [])]
        .sort((a, b) => num(b.opportunity_score) - num(a.opportunity_score))
        .slice(0, 8);
      const scores = rows.map((r) => num(r.opportunity_score));
      addAggregateRow(slide, [
        { label: "Open angles", value: String(rows.length) },
        { label: "Strongest signal", value: scores.length ? String(Math.max(...scores)) : "—" },
        { label: "Avg signal", value: scores.length ? avg(scores).toFixed(1) : "—" },
      ]);
      addDataTable(
        slide,
        ["Category", "Emotion", "Priority", "Competition", "Signal strength"],
        rows.map((r) => [
          str(r.category),
          translateTerritory(str(r.emotion)),
          str(r.strategic_priority),
          str(r.market_density),
          str(r.opportunity_score),
        ]),
      );
      break;
    }
    case "momentum": {
      const rows = [...(bundle.momentum.data ?? [])]
        .sort((a, b) => num(b.latest_interest) - num(a.latest_interest))
        .slice(0, 8);
      const interests = rows.map((r) => num(r.latest_interest));
      addAggregateRow(slide, [
        { label: "Brands tracked", value: String(rows.length) },
        { label: "Peak observed demand", value: interests.length ? String(Math.max(...interests)) : "—" },
        { label: "Avg observed demand", value: interests.length ? Math.round(avg(interests)).toLocaleString() : "—" },
      ]);
      addDataTable(
        slide,
        ["Brand", "Keyword", "Observed demand", "Creatives", "Trend"],
        rows.map((r) => [
          str(r.brand_domain),
          str(r.keyword),
          num(r.latest_interest).toLocaleString(),
          num(r.creative_volume).toLocaleString(),
          str(r.momentum),
        ]),
      );
      break;
    }
    case "executive": {
      const exec = bundle.executive.data as Record<string, unknown> | null;
      if (!exec) break;
      addAggregateRow(slide, [
        { label: "Category", value: str(exec.dominant_market) },
        { label: "Market leader", value: str(exec.strongest_brand) },
        { label: "Dominant message", value: translateTerritory(str(exec.dominant_emotion)) },
      ]);
      addDataTable(slide, ["Field", "Value"], [
        ["Category", str(exec.dominant_market)],
        ["Market leader", str(exec.strongest_brand)],
        ["Dominant message", translateTerritory(str(exec.dominant_emotion))],
        ["Top open category", str(exec.top_opportunity_category)],
        ["Top open message", translateTerritory(str(exec.top_opportunity_emotion))],
      ]);
      break;
    }
    case "pitch": {
      const brief = resolveBrief(bundle);
      const moves = buildRecommendedMoves(brief?.client_name);
      addAggregateRow(slide, [
        { label: "Actions", value: String(moves.length) },
        { label: "Ready to pitch", value: moves.length ? "Yes" : "—" },
      ]);
      addDataTable(
        slide,
        ["#", "Recommended move"],
        moves.map((m, i) => [String(i + 1), m]),
      );
      break;
    }
    default:
      break;
  }
}

/**
 * Build and download a R-AD pitch deck from the strategist intelligence bundle.
 * Exports only normalized intelligence fields — no API keys, agency IDs, or internal source paths.
 */
export async function generatePitchDeck(
  bundle: StrategistIntelBundle,
  options: PitchExportOptions = {},
): Promise<void> {
  const brand = resolveAgencyBrand(bundle, options.agencyContext);
  const brief = resolveBrief(bundle);
  const modules = options.modules ?? activeModules(bundle);

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "RevenuAD Signal";
  pptx.subject = "R-AD Intelligence Brief";
  pptx.title = `${brand} · R-AD Brief`;

  buildTitleSlide(pptx, brand, brief?.category ?? null);

  if (brief && (brief.headline || brief.summary)) {
    buildExecutiveSlide(pptx, bundle);
  }

  for (const moduleId of modules) {
    buildModuleSlide(pptx, moduleId, bundle);
  }

  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `rad-pitch-${fileSlug(brand)}-${datePart}.pptx`;
  await pptx.writeFile({ fileName });
}
