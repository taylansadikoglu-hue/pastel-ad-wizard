import { useEffect, useMemo, useState } from "react";
import {
  Facebook,
  Image as ImageIcon,
  Info,
  Linkedin,
  Music2,
  Search as SearchIcon,
  Youtube,
} from "lucide-react";
import type { ChannelConfidence } from "@/lib/channelMix";
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
  { label: "LinkedIn", colour: "#0A66C2", Icon: Linkedin },
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

const CONFIDENCE_STYLES: Record<ChannelConfidence, { light: { bg: string; color: string }; dark: { bg: string; color: string } }> = {
  High: {
    light: { bg: "#F0F9F4", color: "#2D7D46" },
    dark: { bg: "rgba(45,125,70,0.2)", color: "#7DCE9A" },
  },
  Medium: {
    light: { bg: "#FDF6E8", color: "#A07830" },
    dark: { bg: "rgba(201,150,58,0.2)", color: "#E8C47A" },
  },
  Low: {
    light: { bg: "#F7F6F3", color: "#6B6B62" },
    dark: { bg: "rgba(255,255,255,0.08)", color: "#C4C2BA" },
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
  className?: string;
};

export function ChannelMixBars({
  rows,
  overallConfidence = "Low",
  sourceLabel,
  estimationTooltip,
  available: _available = true,
  variant = "light",
  animate = true,
  emptyMessage: _emptyMessage,
  className,
}: ChannelMixBarsProps) {
  const [mounted, setMounted] = useState(!animate);
  const isLight = variant === "light";
  const displayRows = useMemo(() => sortRows(rows), [rows]);
  const hasActive = useMemo(
    () => displayRows.some((r) => r.pct > 0 || (r.ads ?? 0) > 0),
    [displayRows],
  );
  const emptyMessage =
    _emptyMessage ??
    "Channel mix will appear after creatives are indexed with platform tags.";

  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animate, rows]);

  const barFill = isLight ? "#C9963A" : "rgba(245,158,11,0.85)";
  const barTrack = isLight ? "#F0EDE8" : "rgba(38,38,36,0.9)";
  const labelColor = isLight ? "#1C1C1A" : "#E8E6E0";
  const pctColor = isLight ? "#1C1C1A" : "#C4C2BA";
  const mutedColor = isLight ? "#9E9D94" : "#8A8980";
  const confidenceStyle =
    overallConfidence != null ? CONFIDENCE_STYLES[overallConfidence][isLight ? "light" : "dark"] : null;

  return (
    <div className={cn("channel-mix-bars", className)} data-export-block="channel-mix">
      {hasActive ? (
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
                  <Icon
                    size={16}
                    style={{
                      color: empty ? (isLight ? "#C4C2BA" : "#6B6B62") : visual.colour,
                      flexShrink: 0,
                    }}
                  />
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
      ) : (
        <div
          className={cn(
            "rounded-md border p-3 text-xs leading-relaxed",
            isLight ? "border-[#EBE9E4] bg-[#F7F6F3] text-[#6B6B62]" : "border-neutral-800 bg-neutral-900/40 text-neutral-400",
          )}
        >
          {emptyMessage}
        </div>
      )}

      {(sourceLabel || estimationTooltip || overallConfidence) && (
        <div
          className={cn(
            "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-[11px] leading-snug",
            isLight ? "border-[#EBE9E4]" : "border-neutral-800",
          )}
          style={{ color: mutedColor }}
        >
          <span
            className="inline-flex items-center rounded px-2 py-0.5 font-semibold"
            style={{ background: confidenceStyle?.bg, color: confidenceStyle?.color }}
          >
            Confidence: {overallConfidence}
          </span>
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
    </div>
  );
}
