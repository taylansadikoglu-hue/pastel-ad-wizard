/** Human-readable duration from day counts (e.g. 1366 → "3.7 years"). */
export function formatActiveDuration(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "—";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${(days / 30.44).toFixed(1)} months`;
  const years = days / 365.25;
  return years >= 1.95 ? `${years.toFixed(1)} years` : `${(days / 30.44).toFixed(0)} months`;
}
