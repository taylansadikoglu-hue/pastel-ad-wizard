import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isDemoEmail, isDemoRole, resolveDemoUser } from "@/lib/demo-account";

export function claimsIndicateDemo(claims: Record<string, unknown>): boolean {
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const role =
    typeof claims.role === "string"
      ? claims.role
      : typeof claims.app_role === "string"
        ? claims.app_role
        : undefined;
  return isDemoEmail(email) || isDemoRole(role);
}

export async function assertWriteAllowedForSession(
  supabase: SupabaseClient<Database>,
  claims: Record<string, unknown>,
): Promise<void> {
  if (claimsIndicateDemo(claims)) {
    throw new Error("Demo accounts are read-only.");
  }
  const { data, error } = await supabase.auth.getUser();
  if (!error && resolveDemoUser(data.user)) {
    throw new Error("Demo accounts are read-only.");
  }
}

/** @deprecated Use assertWriteAllowedForSession */
export function assertWriteAllowedForClaims(claims: Record<string, unknown>): void {
  if (claimsIndicateDemo(claims)) {
    throw new Error("Demo accounts are read-only.");
  }
}
