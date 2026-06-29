/**
 * Resilient Supabase reads — optional tables must never crash the UI.
 */
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export type SafeQueryResult<T> = {
  data: T;
  error: PostgrestError | null;
  /** False when the table/view is missing (PGRST205) or the query threw. */
  available: boolean;
};

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "PGRST205" ||
    e.code === "42P01" ||
    /could not find the table/i.test(e.message ?? "") ||
    /relation .* does not exist/i.test(e.message ?? "")
  );
}

export async function safeQuery<T>(
  label: string,
  queryFn: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
): Promise<SafeQueryResult<T | null>> {
  try {
    const res = await queryFn();
    if (res.error) {
      if (isMissingTableError(res.error)) {
        console.warn(`[safeQuery] optional unavailable (${label}):`, res.error.message);
        return { data: null, error: res.error, available: false };
      }
      console.warn(`[safeQuery] ${label}:`, res.error.message);
      return { data: res.data ?? null, error: res.error, available: true };
    }
    return { data: res.data ?? null, error: null, available: true };
  } catch (err) {
    console.warn(`[safeQuery] ${label} threw:`, err);
    return { data: null, error: null, available: false };
  }
}

export async function safeCount(
  supabase: SupabaseClient,
  table: string,
): Promise<{ count: number; available: boolean }> {
  const res = await safeQuery<number>(table, async () => {
    const r = await supabase.from(table).select("id", { count: "exact", head: true });
    return { data: r.count ?? 0, error: r.error };
  });
  return { count: res.available ? (res.data ?? 0) : 0, available: res.available };
}

/** Run optional fetches; failures resolve to fallback instead of rejecting. */
export async function safeOptional<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[safeOptional] ${label}:`, err);
    return fallback;
  }
}
