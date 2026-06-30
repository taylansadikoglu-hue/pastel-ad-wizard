import type { SupabaseClient } from "@supabase/supabase-js";

export type SuppressionReason = "bounce" | "complaint" | "manual" | "unsubscribe";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isEmailSuppressed(
  supabase: SupabaseClient,
  email: string,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const { data } = await supabase
    .from("email_suppressions")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();
  return Boolean(data?.email);
}

export async function addEmailSuppression(
  supabase: SupabaseClient,
  email: string,
  reason: SuppressionReason,
  meta?: { providerEventId?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  const normalized = normalizeEmail(email);
  const row = {
    email: normalized,
    reason,
    provider_event_id: meta?.providerEventId ?? null,
    metadata: meta?.metadata ?? {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("email_suppressions").upsert(row);
  if (error) throw new Error(`Suppression upsert failed: ${error.message}`);
}

export async function logEmailEvent(
  supabase: SupabaseClient,
  event: {
    eventType: string;
    email?: string | null;
    providerId?: string | null;
    payload?: unknown;
  },
): Promise<void> {
  const { error } = await supabase.from("email_events").insert({
    event_type: event.eventType,
    email: event.email ? normalizeEmail(event.email) : null,
    provider_id: event.providerId ?? null,
    payload: event.payload ?? null,
  });
  if (error) console.error("[email] event log failed", error.message);
}
