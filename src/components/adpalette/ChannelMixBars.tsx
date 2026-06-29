import { useEffect, useMemo, useState } from "react";
import {
  Facebook,
  Image as ImageIcon,
  Info,
  Music2,
  Search as SearchIcon,
  Youtube,
} from "lucide-react";
import type { ChannelConfidence } from "@/lib/radAdvertiserBrief";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ChannelMixBarRow = {
  channel: string;
  pct: number;
  ads?: number;
};

type ChannelVisual = {
  label: string;
  colour: string;
  Icon: typeof SearchIcon;
};

const CHANNEL_VISUAL: ChannelVisual[] = [
  { label: "Display", colour: "#C9963A", Icon: ImageIcon },
  { label: "YouTube", colour: "#FF0000", Icon: Youtube },
  { label: "Search", colour: "#4285F4", Icon: SearchIcon },
  { label: "Meta", colour: "#1877F2", Icon: Facebook },
  { label: "TikTok", colour: "#25F4EE", Icon: Music2 },
  { label: "Other", colour: "#6B6B62", Icon: ImageIcon },
];

function lookupChannel(channel: string): ChannelVisual {
  return CHANNEL_VISUAL.find((c) => c.label === channel) ?? {
    label: channel,
    colour: "#6B6B62",
    Icon: ImageIcon,
  };
}

function sortRows(rows: ChannelMixBarRow[]): ChannelMixBarRow[] {
  return [...rows].sort((a, b) => {
    const aActive = a.pct > 0 || (a.ads ?? 0) > 0;
    const bActive = b.pct > 0 || (b.ads ?? 0) > 0;
    if (aActive !== bActive) return aActive ? -1 : 1;
    return b.pct - a.pct || (b.ads ?? 0) - (a.ads ?? 0);
  });
}

const CHANNEL_ORDER = ["Display", "YouTube", "Search", "Meta", "TikTok", "Other"] as const;

function orderRows(rows: ChannelMixBarRow[], sortMode: "fixed" | "activity"): ChannelMixBarRow[] {
  if (sortMode === "activity") return sortRows(rows);
  const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r]));
  return CHANNEL_ORDER.map((channel) => byChannel[channel] ?? { channel, pct: 0, ads: 0 });
}

const CONFIDENCE_STYLES: Record<ChannelConfidence, { light: { bg: string; color: string }; dark: { bg: string; color: string } }> = {
  Observed: {
    light: { bg: "#F0F9F4", color: "#2D7D46" },
    dark: { bg: "rgba(45,125,70,0.2)", color: "#7DCE9A" },
  },
  Modelled: {
    light: { bg: "#FDF6E8", color: "#A07830" },
    dark: { bg: "rgba(201,150,58,0.2)", color: "#E8C47A" },
  },
  "Partial coverage": {
    light: { bg: "#F0EDE8", color: "#6B6B62" },
    dark: { bg: "rgba(255,255,255,0.08)", color: "#C4C2BA" },
  },
  "No signal detected": {
    light: { bg: "#F7F6F3", color: "#C4C2BA" },
    dark: { bg: "rgba(255,255,255,0.05)", color: "#8A8980" },
  },
};

export type ChannelMixBarsProps = {
  rows: ChannelMixBarRow[];
  overallConfidence?: ChannelConfidence;
  sourceLabel?: string;
  estimationTooltip?: string;
  available?: boolean;
  variant?: "light" | "dark";
  animate?: boolean;
  emptyMessage?: string;
  sortMode?: "fixed" | "activity";
  className?: string;
};

export function ChannelMixBars({
  rows,
  overallConfidence,
  sourceLabel,
  estimationTooltip,
  available = rows.length > 0,
  variant = "light",
  animate = true,
  sortMode = "fixed",
  emptyMessage = "Channel mix unavailable for this view.",
  className,
}: ChannelMixBarsProps) {
  const [mounted, setMounted] = useState(!animate);
  const isLight = variant === "light";
  const displayRows = useMemo(() => orderRows(rows, sortMode), [rows, sortMode]);
  const hasActivity = rows.some((r) => r.pct > 0 || (r.ads ?? 0) > 0);

  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animate, rows]);

  if (!available) {
    return (
      <p
        className={cn("m-0 text-sm leading-relaxed", isLight ? "text-[#6B6B62]" : "text-neutral-300", className)}
      >
        {emptyMessage}
      </p>
    );
  }

  const barFill = isLight ? "#C9963A" : "rgba(245,158,11,0.85)";
  const barTrack = isLight ? "#F0EDE8" : "rgba(38,38,36,0.9)";
  const labelColor = isLight ? "#1C1C1A" : "#E8E6E0";
  const pctColor = isLight ? "#1C1C1A" : "#C4C2BA";
  const mutedColor = isLight ? "#9E9D94" : "#8A8980";
  const confidenceStyle =
    overallConfidence != null ? CONFIDENCE_STYLES[overallConfidence][isLight ? "light" : "dark"] : null;

  return (
    <div className={cn("channel-mix-bars", className)} data-export-block="channel-mix">
      <div className="flex flex-col gap-2.5 sm:gap-3">
        {displayRows.map((row) => {
          const pct = Math.max(0, Math.min(100, row.pct));
          const empty = pct <= 0 && (row.ads ?? 0) <= 0;
          const visual = lookupChannel(row.channel);
          const Icon = visual.Icon;

          return (
            <div
              key={row.channel}
              className={cn(
                "grid items-center gap-x-3 gap-y-1",
                "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(88px,28%)_1fr_minmax(40px,auto)]",
              )}
              style={{ opacity: empty ? 0.45 : 1 }}
            >
              <div
                className="col-span-2 flex min-w-0 items-center gap-2 text-[13px] font-medium sm:col-span-1"
                style={{ color: empty ? (isLight ? "#C4C2BA" : "#6B6B62") : labelColor }}
              >
                <Icon size={16} style={{ color: empty ? (isLight ? "#C4C2BA" : "#6B6B62") : visual.colour, flexShrink: 0 }} />
                <span className="truncate">{row.channel}</span>
              </div>

              <div
                className="col-span-1 min-w-0 h-2 rounded overflow-hidden sm:col-span-1"
                style={{ background: barTrack }}
                aria-hidden
              >
                <div
                  className="h-full rounded"
                  style={{
                    width: mounted ? `${pct}%` : "0%",
                    background: barFill,
                    transition: animate ? "width 600ms ease-out" : undefined,
                  }}
                />
              </div>

              <div
                className="col-span-1 text-right text-sm font-semibold tabular-nums sm:col-span-1"
                style={{ color: empty ? (isLight ? "#C4C2BA" : "#6B6B62") : pctColor }}
              >
                {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {(overallConfidence || sourceLabel || estimationTooltip) && (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-[11px] leading-snug",
            isLight ? "border-[#EBE9E4]" : "border-neutral-800",
          )}
          style={{ color: mutedColor }}
        >
          {overallConfidence && confidenceStyle && (
            <span
              className="inline-flex items-center rounded px-2 py-0.5 font-semibold"
              style={{ background: confidenceStyle.bg, color: confidenceStyle.color }}
            >
              Confidence: {overallConfidence}
            </span>
          )}
          {sourceLabel && <span>Source: {sourceLabel}</span>}
          {estimationTooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1 rounded border-0 bg-transparent p-0 font-medium underline-offset-2 hover:underline",
                      isLight ? "text-[#6B6B62]" : "text-neutral-400",
                    )}
                    title={estimationTooltip}
                    aria-label="How channel mix was estimated"
                  >
                    <Info size={13} aria-hidden />
                    <span>How this was estimated</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                  {estimationTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      {!hasActivity && (
        <p className={cn("mt-2 mb-0 text-[11px] leading-snug", isLight ? "text-[#9E9D94]" : "text-neutral-500")}>
          No channel activity indexed yet — run a scan to populate observed mix.
        </p>
      )}
    </div>
  );
}
