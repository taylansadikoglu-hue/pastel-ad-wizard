import type { EmailService } from "./EmailService";
import { ResendEmailService } from "./ResendEmailService";

export type { EmailService } from "./EmailService";
export { ResendEmailService } from "./ResendEmailService";
export * from "./types";
export * from "./senders";
export * from "./suppression";


/** Server-side factory — inject supabase for suppression checks. */
export function getEmailService(options?: {
  supabase?: import("@supabase/supabase-js").SupabaseClient | null;
  dryRun?: boolean;
}): EmailService {
  return new ResendEmailService({
    supabase: options?.supabase ?? null,
    dryRun: options?.dryRun ?? !process.env.RESEND_API_KEY,
  });
}

/** Postmark swap point — implement PostmarkEmailService with same interface later. */
export function createEmailService(provider: "resend" | "postmark" = "resend"): EmailService {
  if (provider === "postmark") {
    throw new Error("PostmarkEmailService not implemented — use resend");
  }
  return new ResendEmailService();
}
