/** Australia/Sydney scheduler window helpers. */

export const SCHEDULER_TIMEZONE = "Australia/Sydney";

export function sydneyLocalHour(date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-AU", {
      timeZone: SCHEDULER_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
}

/** True when local time in Australia/Sydney is 07:00–07:59. */
export function isAustraliaSydneySevenAm(date = new Date()): boolean {
  return sydneyLocalHour(date) === 7;
}

export function sydneyLocalTimestamp(date = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: SCHEDULER_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}
