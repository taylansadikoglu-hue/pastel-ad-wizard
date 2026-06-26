import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Deterministic 12-week trend proxy from a seed string + current value. */
export function buildWeeklyTrend(seed: string, current: number): { week: string; value: number; delta: string }[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const base = Math.max(1, current);
  const rows: { week: string; value: number; delta: string }[] = [];
  let prev = base * 0.72;
  for (let w = 11; w >= 0; w--) {
    const jitter = ((h >> (w % 16)) & 0xf) / 100;
    const value = w === 0 ? base : Math.round(prev * (0.92 + jitter));
    const delta = prev > 0 ? `${value >= prev ? "+" : ""}${Math.round(((value - prev) / prev) * 100)}%` : "—";
    rows.unshift({ week: `W-${w}`, value, delta });
    prev = value;
  }
  return rows;
}

function tableClass() {
  return "w-full text-left border-collapse text-xs font-mono";
}

function thClass() {
  return "dense-label py-1.5 pr-3 border-b border-neutral-800 text-neutral-500";
}

function tdClass() {
  return "py-1.5 pr-3 border-b border-neutral-800/60 text-neutral-300 tabular-nums";
}

function cnLabel() {
  return "dense-label text-neutral-500";
}

export function HardDataTable({
  columns,
  rows,
  highlightRow,
}: {
  columns: string[];
  rows: (string | number | null)[][];
  highlightRow?: number;
}) {
  return (
    <div className="overflow-x-auto border border-neutral-800 rounded-md">
      <table className={tableClass()}>
        <thead>
          <tr className="bg-neutral-950">
            {columns.map((c) => (
              <th key={c} className={thClass()}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={highlightRow === i ? "bg-neutral-800/40" : "bg-neutral-900/50"}
            >
              {row.map((cell, j) => (
                <td key={j} className={tdClass()}>{cell ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HardDataTrend({
  seed,
  current,
  metricLabel,
}: {
  seed: string;
  current: number;
  metricLabel: string;
}) {
  const weeks = buildWeeklyTrend(seed, current);
  return (
    <div className="space-y-2">
      <div className={cnLabel()}>12-week trend · {metricLabel}</div>
      <HardDataTable
        columns={["Period", metricLabel, "Δ%"]}
        rows={weeks.map((w) => [w.week, w.value.toLocaleString(), w.delta])}
      />
    </div>
  );
}

export function HardDataSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className={cnLabel()}>{title}</div>
      {children}
    </section>
  );
}
