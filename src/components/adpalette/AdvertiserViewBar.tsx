import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ADVERTISER_INSIGHT_SECTIONS,
  applyAdvertiserPreset,
  toggleAdvertiserSection,
  type AdvertiserInsightSectionId,
  type AdvertiserViewPreset,
  type AdvertiserViewState,
} from "@/lib/dashboardViewPrefs";

const PRESET_META: Record<AdvertiserViewPreset, { label: string; description: string; icon: string }> = {
  essentials: { label: "Scan only", description: "Dashboard + 4 creatives", icon: "⚡" },
  pitch: { label: "Pitch prep", description: "Deck-ready narrative", icon: "📽" },
  full: { label: "Full depth", description: "Every insight block", icon: "📊" },
  custom: { label: "Custom", description: "Your own mix", icon: "✦" },
};

const PRESET_ORDER: AdvertiserViewPreset[] = ["essentials", "pitch", "full", "custom"];

export function AdvertiserViewBar({
  state,
  onChange,
  className,
}: {
  state: AdvertiserViewState;
  onChange: (next: AdvertiserViewState) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#E8D5A0]/60 bg-gradient-to-r from-[#FDF6E8] via-white to-[#F7F6F3] p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1C1C1A] text-[#FBBF24]">
          <LayoutGrid size={16} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[#A07830]">Insight view</div>
          <div className="text-sm font-semibold text-[#1C1C1A]">
            {state.sections.length} of {ADVERTISER_INSIGHT_SECTIONS.length} blocks
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-[#F0EDE8]/80 border border-[#EBE9E4] mb-2">
        {PRESET_ORDER.map((preset) => {
          const meta = PRESET_META[preset];
          const active = state.preset === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                if (preset === "custom") onChange({ preset: "custom", sections: state.sections });
                else onChange(applyAdvertiserPreset(preset));
              }}
              className={cn(
                "flex-1 min-w-[80px] rounded-md px-2 py-2 text-left transition-all",
                active ? "bg-[#1C1C1A] text-white shadow-md" : "text-[#6B6B62] hover:bg-white",
              )}
            >
              <div className="text-sm">{meta.icon}</div>
              <div className="text-[11px] font-bold mt-1">{meta.label}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ADVERTISER_INSIGHT_SECTIONS.map((section) => {
          const on = state.sections.includes(section.id);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(toggleAdvertiserSection(state, section.id))}
              className={cn(
                "text-[10px] font-semibold rounded-full px-2.5 py-1 border",
                on
                  ? "bg-[#C9963A] border-[#A07830] text-white"
                  : "bg-white border-[#EBE9E4] text-[#9E9D94]",
              )}
            >
              {section.short}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(applyAdvertiserPreset("full"))}
          className="text-[10px] font-bold rounded-full px-2.5 py-1 border border-dashed border-[#C9963A] text-[#A07830]"
        >
          Show all
        </button>
      </div>
    </div>
  );
}

export function showAdvertiserSection(state: AdvertiserViewState, id: AdvertiserInsightSectionId): boolean {
  return state.sections.includes(id);
}
