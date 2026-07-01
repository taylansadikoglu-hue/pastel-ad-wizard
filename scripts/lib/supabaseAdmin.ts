import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminCached: SupabaseClient | null = null;
let readCached: SupabaseClient | null = null;

export type SupabaseKeyKind = "service_role" | "publishable" | "legacy_jwt" | "unknown";

export function classifySupabaseKey(key: string): SupabaseKeyKind {
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(Buffer.from(key.split(".")[1]!, "base64url").toString()) as {
        role?: string;
      };
      if (payload.role === "service_role") return "service_role";
      if (payload.role === "anon") return "publishable";
    } catch {
      /* fall through */
    }
    return "legacy_jwt";
  }
  return "unknown";
}

export function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL)");
  return url;
}

/** Read-only client — publishable/anon key. Works for normalized_ad_placements + audits. */
export function getSupabaseRead(): SupabaseClient {
  if (readCached) return readCached;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing Supabase publishable key");
  readCached = createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return readCached;
}

/** Admin client — requires real service_role key for writes / raw ad_placements reads. */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminCached) return adminCached;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (serviceKey) {
    const kind = classifySupabaseKey(serviceKey);
    if (kind === "publishable") {
      console.warn(
        "[supabase] SUPABASE_SERVICE_ROLE_KEY is a publishable key — raw ad_placements reads/writes will fail. " +
          "Use the service_role secret from Supabase dashboard for ingest scripts.",
      );
    }
    adminCached = createClient(supabaseUrl(), serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return adminCached;
  }

  if (anonKey) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY not set — using publishable key (writes will fail due to RLS).",
    );
    adminCached = createClient(supabaseUrl(), anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return adminCached;
  }

  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY");
}

export function hasWritableSupabase(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return false;
  const kind = classifySupabaseKey(key);
  return kind === "service_role" || kind === "legacy_jwt" || kind === "unknown";
}

export function hasAdlibraryKey(): boolean {
  return Boolean(process.env.ADLIBRARY_API_KEY?.trim());
}

export function requireWritableSupabase(): SupabaseClient {
  if (!hasWritableSupabase()) {
    throw new Error(
      "Writable Supabase access required. Set SUPABASE_SERVICE_ROLE_KEY to the service_role secret " +
        "(not sb_publishable_…). Find it in Supabase dashboard → Settings → API.",
    );
  }
  return getSupabaseAdmin();
}
