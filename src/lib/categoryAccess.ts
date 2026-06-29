/** Accounts with full category pack access (no locked blur on Categories page). */
export const FULL_CATEGORY_ACCESS_EMAILS = new Set([
  "hello@revenuad.com",
  "taylan.sadikoglu@gmail.com",
]);

export function hasFullCategoryAccess(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return FULL_CATEGORY_ACCESS_EMAILS.has(email.trim().toLowerCase());
}
