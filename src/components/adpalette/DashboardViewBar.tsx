import { LayoutGrid, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MARKET_INTEL_SECTIONS,
  VIEW_PRESET_META,
  applyPreset,
  toggleSection,
  type DashboardViewPreset,
  type DashboardViewState,
  type MarketIntelSectionId,
} from "@/lib/dashboardViewPrefs";

type SectionDef = { id: string; label: string; short: string };

type Props = {
  state: DashboardViewState;
  onChange: (next: DashboardViewState) => void;
  sectionDefs?: SectionDef[];
  pptxModuleCount?: number;
  className?: string;
};

const PRESET_ORDER: DashboardViewPreset[] = ["essentials", "meeting", "pptx", "full", "custom"];

export function DashboardViewBar({
  state,
  onChange,
  sectionDefs = MARKET_INTEL_SECTIONS,
  pptxModuleCount,
  className,
}: Props) {
  const isCustom = state.preset === "custom";
  const visibleCount = state.sections.length;
  const totalCount = sectionDefs.length;

  return (
    <div
      className={cn(
        "rounded-xl border border-[#E8D5A0]/60 bg-gradient-to-r from-[#FDF6E8] via-white to-[#F7F6F3] p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1C1A] text-[#FBBF24] shrink-0">
            <LayoutGrid size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-[#A07830]">View mode</div>
            <div className="text-sm font-semibold text-[#1C1C1A] truncate">
              {visibleCount} of {totalCount} sections · {isCustom ? "Custom mix" : VIEW_PRESET_META[state.preset].label}
            </div>
          </div>
        </div>
        {pptxModuleCount != null && (
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6B6B62] bg-white/80 border border-[#EBE9E4] rounded-full px-2.5 py-1">
            <Sparkles size={12} className="text-[#C9963A]" />
            PPTX: {pptxModuleCount} slides
          </div>
        )}
      </div>

      {/* Preset segmented control */}
      <div
        className="flex flex-wrap gap-1 p-1 rounded-lg bg-[#F0EDE8]/80 border border-[#EBE9E4] mb-2"
        role="radiogroup"
        aria-label="Dashboard view preset"
      >
        {PRESET_ORDER.map((preset) => {
          const meta = VIEW_PRESET_META[preset];
          const active = state.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (preset === "custom") {
                  onChange({ preset: "custom", sections: state.sections });
                  return;
                }
                onChange(applyPreset(preset));
              }}
              className={cn(
                "flex-1 min-w-[88px] rounded-md px-2 py-2 text-left transition-all duration-200",
                active
                  ? "bg-[#1C1C1A] text-white shadow-md scale-[1.02]"
                  : "text-[#6B6B62] hover:bg-white hover:text-[#1C1C1A]",
              )}
            >
              <div className="text-sm leading-none">{meta.icon}</div>
              <div className="text-[11px] font-bold mt-1">{meta.label}</div>
              <div className={cn("text-[9px] mt-0.5 leading-tight", active ? "text-neutral-300" : "text-[#9E9D94]")}>
                {meta.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* Section chips — always visible for quick toggles */}
      <div className="flex flex-wrap gap-1.5">
        {sectionDefs.map((section) => {
          const on = state.sections.includes(section.id as MarketIntelSectionId);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(toggleSection(state, section.id as MarketIntelSectionId))}
              className={cn(
                "text-[10px] font-semibold rounded-full px-2.5 py-1 border transition-all",
                on
                  ? "bg-[#C9963A] border-[#A07830] text-white shadow-sm"
                  : "bg-white border-[#EBE9E4] text-[#9E9D94] hover:border-[#C9963A]/50 hover:text-[#1C1C1A]",
              )}
            >
              {section.short}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(applyPreset("full"))}
          className="text-[10px] font-bold rounded-full px-2.5 py-1 border border-dashed border-[#C9963A] text-[#A07830] hover:bg-[#FDF6E8]"
        >
          Show all
        </button>
      </div>
    </div>
  );
}
