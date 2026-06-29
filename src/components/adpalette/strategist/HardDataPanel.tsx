import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight, PanelRightOpen, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { loadEvidenceSupport, type EvidenceSupportBundle } from "@/lib/evidence.functions";
import type { PanelFocus } from "./data-module-types";
import { MODULE_META } from "./data-module-types";
import { renderHardDataBody, type HardDataPayload } from "./render-hard-data";
import { resolveFocusDomain } from "./evidence-context";
import type { EvidenceDrawerExtras } from "./evidence-frame";

type HardDataPanelProps = {
  focus: PanelFocus | null;
  onClose: () => void;
  data: HardDataPayload;
};

export function HardDataPanel({ focus, onClose, data }: HardDataPanelProps) {
  const open = focus != null;
  const meta = focus ? MODULE_META[focus.moduleId] : null;
  const [support, setSupport] = useState<EvidenceSupportBundle | null>(null);
  const [supportLoading, setSupportLoading] = useState(false);

  useEffect(() => {
    if (!focus || !data.workspace) {
      setSupport(null);
      return;
    }

    let alive = true;
    const ctx = data;
    const focusDomain = resolveFocusDomain(
      ctx,
      focus.moduleId,
      focus.rowLabel,
      focus.rowIndex,
    );

    setSupportLoading(true);
    loadEvidenceSupport({
      data: {
        focusDomain,
        workspaceDomains: [
          ctx.workspace.client_domain,
          ...ctx.workspace.competitor_domains,
        ],
      },
    })
      .then((bundle) => {
        if (alive) setSupport(bundle);
      })
      .catch(() => {
        if (alive) setSupport({ creatives: [], marketSignal: null });
      })
      .finally(() => {
        if (alive) setSupportLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [focus, data]);

  const extras: EvidenceDrawerExtras | undefined = focus
    ? {
        creatives: support?.creatives ?? [],
        marketSignal: support?.marketSignal ?? null,
        creativesLoading: supportLoading,
      }
    : undefined;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          "dark-dense w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl",
          "bg-neutral-950 border-neutral-800 text-neutral-100",
          "p-0 gap-0 overflow-hidden",
          "[&>button.absolute]:hidden",
        )}
      >
        {focus && meta && (
          <div className="flex flex-col h-full">
            <SheetHeader className="shrink-0 px-4 py-3 border-b border-neutral-800 bg-neutral-900 text-left space-y-1">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <div className="dense-meta uppercase tracking-wider text-neutral-500">
                    Evidence
                  </div>
                  <SheetTitle className="text-sm font-semibold text-neutral-100">
                    {meta.title}
                    {focus.rowLabel ? ` · ${focus.rowLabel}` : ""}
                  </SheetTitle>
                  <SheetDescription className="dense-meta text-neutral-500 normal-case">
                    {meta.subtitle}
                  </SheetDescription>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="dense-chip text-neutral-400 hover:text-neutral-200 flex items-center gap-1"
                  aria-label="Close evidence panel"
                >
                  <X size={12} /> Close
                </button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {renderHardDataBody(focus, data, extras)}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

type IntelSectionProps = {
  index: string;
  title: string;
  subtitle: string;
  onExpand: () => void;
  children: ReactNode;
};

/** Legacy compact module shell — kept for any secondary surfaces. */
export function IntelSection({ index, title, subtitle, onExpand, children }: IntelSectionProps) {
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
            <div className="dense-meta normal-case truncate">{subtitle}</div>
          </div>
          <span className="dense-chip text-neutral-500 group-hover:text-amber-400/90 flex items-center gap-1 shrink-0">
            <PanelRightOpen size={11} /> Evidence
            <ChevronRight size={11} />
          </span>
        </div>
      </button>
      <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/** @deprecated Use IntelSection */
export const DataUtilitySection = IntelSection;

export function CompactDataRow({
  onOpen,
  children,
  className,
}: {
  onOpen: () => void;
  children: ReactNode;
  className?: string;
}) {
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
