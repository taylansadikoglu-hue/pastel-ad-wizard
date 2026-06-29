import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url) {
    throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL)");
  }

  if (serviceKey) {
    cached = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
  }

  if (anonKey) {
    console.warn(
      "[adlibrary] SUPABASE_SERVICE_ROLE_KEY not set — using anon key (writes may fail due to RLS).",
    );
    cached = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return cached;
  }

  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY");
}
