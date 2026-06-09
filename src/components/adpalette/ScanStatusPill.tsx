import { CheckCircle2, Loader2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ScanStage = "queued" | "scraping" | "enriching" | "ready" | "error";

/**
 * Normalize any backend status string into one of four stable UI stages.
 * Backend writers (Apify worker, AI enrichment step) may emit varying labels;
 * the pill is the single source of truth for what the user sees.
 */
export function toScanStage(raw: string | null | undefined): ScanStage {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s || s === "pending" || s === "queued" || s === "waiting") return "queued";
  if (s === "processing" || s === "scraping" || s === "running" || s === "fetching") return "scraping";
  if (s === "enriching" || s === "analyzing" || s === "scoring" || s === "ai") return "enriching";
  if (s === "ready" || s === "done" || s === "complete" || s === "completed" || s === "success") return "ready";
  if (s === "error" || s === "failed" || s === "failure") return "error";
  // Unknown statuses are treated as in-flight rather than misleadingly "ready".
  return "scraping";
}

const STAGE_META: Record<ScanStage, { label: string; classes: string; Icon: typeof Clock; spin?: boolean }> = {
  queued:    { label: "Queued",    classes: "bg-secondary text-foreground/70 border-ink/30",                 Icon: Clock },
  scraping:  { label: "Scraping",  classes: "bg-amber-50 text-amber-900 border-amber-600/60",               Icon: Loader2, spin: true },
  enriching: { label: "Enriching", classes: "bg-sky-50 text-sky-900 border-sky-600/60",                     Icon: Loader2, spin: true },
  ready:     { label: "Ready",     classes: "bg-emerald-50 text-emerald-900 border-emerald-700/60",         Icon: CheckCircle2 },
  error:     { label: "Error",     classes: "bg-rose-50 text-rose-900 border-rose-700/60",                   Icon: AlertCircle },
};

interface ScanStatusPillProps {
  status: string | null | undefined;
  className?: string;
  size?: "xs" | "sm";
}

export function ScanStatusPill({ status, className, size = "xs" }: ScanStatusPillProps) {
  const stage = toScanStage(status);
  const meta = STAGE_META[stage];
  const Icon = meta.Icon;
  const sizeCls = size === "xs"
    ? "h-5 px-1.5 text-[10px] gap-1"
    : "h-6 px-2 text-[11px] gap-1.5";
  const iconSize = size === "xs" ? 10 : 12;
  return (
    <span
      className={cn(
        "mono uppercase font-bold inline-flex items-center rounded-[3px] border",
        sizeCls,
        meta.classes,
        className,
      )}
      aria-label={`Status: ${meta.label}`}
      role="status"
    >
      <Icon size={iconSize} className={meta.spin ? "animate-spin" : undefined} aria-hidden />
      {meta.label}
    </span>
  );
}
