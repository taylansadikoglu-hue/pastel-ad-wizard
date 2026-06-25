export function formatTimeAgo(dateString: string | Date | null | undefined): string {
  if (!dateString) return "";
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const hour = date.getHours();

  if (diffHrs < 1) return "Just now";
  if (diffHrs < 24) return `${Math.floor(diffHrs)}h ago`;
  if (diffDays < 1.5) {
    if (hour < 12) return "This morning";
    if (hour < 17) return "This afternoon";
    return "Yesterday evening";
  }
  if (diffDays < 2) return "Yesterday";
  if (diffDays < 7) return `${Math.floor(diffDays)} days ago`;
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
