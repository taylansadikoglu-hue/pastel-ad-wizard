import type { ReactNode } from "react";
import { ChevronRight, PanelRightOpen, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { PanelFocus } from "./data-module-types";
import { MODULE_META } from "./data-module-types";
import { renderHardDataBody, type HardDataPayload } from "./render-hard-data";

type HardDataPanelProps = {
  focus: PanelFocus | null;
  onClose: () => void;
  data: HardDataPayload;
};

export function HardDataPanel({ focus, onClose, data }: HardDataPanelProps) {
  const open = focus != null;
  const meta = focus ? MODULE_META[focus.moduleId] : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          "dark-dense w-full sm:max-w-xl md:max-w-2xl",
          "bg-neutral-950 border-neutral-800 text-neutral-100",
          "p-0 gap-0 overflow-hidden font-mono",
          "[&>button.absolute]:hidden",
        )}
      >
        {focus && meta && (
          <div className="flex flex-col h-full">
            <SheetHeader className="shrink-0 px-4 py-3 border-b border-neutral-800 bg-neutral-900 text-left space-y-1">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <div className="dense-meta uppercase tracking-wider text-neutral-500">
                    Hard Data · {meta.index} · {meta.source}
                  </div>
                  <SheetTitle className="text-sm font-semibold text-neutral-100">
                    {meta.title}
                    {focus.rowLabel ? ` · ${focus.rowLabel}` : ""}
                  </SheetTitle>
                  <SheetDescription className="dense-meta text-neutral-500">
                    agency_id={data.agencyId ?? "—"} · granular tables & trend proxy
                  </SheetDescription>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="dense-chip text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                  aria-label="Close hard data panel"
                >
                  <X size={12} /> Esc
                </button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {renderHardDataBody(focus, data)}
            </div>

            <div className="shrink-0 px-4 py-2 border-t border-neutral-800 bg-neutral-900 dense-meta text-neutral-500">
              {">"} press Esc or click backdrop to return to cockpit · scroll position preserved
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

type DataUtilitySectionProps = {
  index: string;
  title: string;
  subtitle: string;
  aggregateLabel: string;
  aggregateValue: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  sparklineValues: number[];
  onExpand: () => void;
  children: ReactNode;
};

/** Compact module shell — sparkline + aggregate; rows expand hard data. */
export function DataUtilitySection({
  index,
  title,
  subtitle,
  aggregateLabel,
  aggregateValue,
  secondaryLabel,
  secondaryValue,
  sparklineValues,
  onExpand,
  children,
}: DataUtilitySectionProps) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onExpand}
        className={cn(
          "w-full text-left card-dense py-2 px-3",
          "hover:border-neutral-600 hover:bg-neutral-900/80 transition-colors",
          "group cursor-pointer",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="dense-label tracking-widest">{index}</div>
            <div className="text-sm font-semibold text-neutral-100">{title}</div>
            <div className="dense-meta uppercase truncate">{subtitle}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <div className="dense-label">{aggregateLabel}</div>
              <div className="text-base font-semibold tabular-nums text-neutral-50">{aggregateValue}</div>
              {secondaryLabel && (
                <div className="dense-meta">
                  {secondaryLabel}: <span className="text-neutral-300">{secondaryValue}</span>
                </div>
              )}
            </div>
            <SparklineInline values={sparklineValues} />
            <span className="dense-chip text-neutral-500 group-hover:text-amber-400/90 flex items-center gap-1">
              <PanelRightOpen size={11} /> Data
              <ChevronRight size={11} />
            </span>
          </div>
        </div>
      </button>
      <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function SparklineInline({ values }: { values: number[] }) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const w = 72;
  const h = 24;
  const step = w / (pts.length - 1);
  const d = pts
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 opacity-80" aria-hidden>
      <path d={d} fill="none" stroke="#737373" strokeWidth={1.25} />
    </svg>
  );
}

type CompactRowProps = {
  onOpen: () => void;
  children: ReactNode;
  className?: string;
};

export function CompactDataRow({ onOpen, children, className }: CompactRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "card-dense-sm text-left w-full py-2 px-2.5",
        "hover:border-neutral-600 hover:bg-neutral-900/90 transition-colors cursor-pointer",
        className,
      )}
    >
      {children}
    </button>
  );
}
