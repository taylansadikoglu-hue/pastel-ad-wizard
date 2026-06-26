import { cn } from "@/lib/utils";

type SparklineProps = {
  values: number[];
  className?: string;
  stroke?: string;
  height?: number;
  width?: number;
};

/** Minimal inline sparkline for dense cockpit aggregates. */
export function Sparkline({
  values,
  className,
  stroke = "#a3a3a3",
  height = 28,
  width = 96,
}: SparklineProps) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) {
    return (
      <svg width={width} height={height} className={cn("opacity-40", className)} aria-hidden>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={stroke} strokeWidth={1} />
      </svg>
    );
  }

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const step = width / (pts.length - 1);

  const d = pts
    .map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
