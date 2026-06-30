import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getEmailService } from "@/lib/email";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const APP_URL = process.env.APP_URL ?? process.env.VITE_APP_URL ?? "https://revenuad.com";

const EmailSchema = z.object({
  email: z.string().email(),
});

/** Password reset via Resend (replaces default Supabase email). */
export const requestPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const emailService = getEmailService({ supabase: supabaseAdmin });

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${APP_URL}/reset-password` },
    });
    if (error) {
      // Don't leak whether account exists
      console.error("[auth-email] recovery link failed", error.message);
      return { ok: true as const };
    }

    const resetUrl = linkData.properties?.action_link;
    if (!resetUrl) return { ok: true as const };

    const result = await emailService.sendPasswordReset({
      to: email,
      resetUrl,
    });
    if (!result.ok && !result.skipped) {
      console.error("[auth-email] send failed", result.error);
    }
    return { ok: true as const };
  });

/** Magic link sign-in via Resend. */
export const requestMagicLinkEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const emailService = getEmailService({ supabase: supabaseAdmin });

    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${APP_URL}/app` },
    });
    if (error) {
      console.error("[auth-email] magic link failed", error.message);
      return { ok: true as const };
    }

    const magicUrl = linkData.properties?.action_link;
    if (!magicUrl) return { ok: true as const };

    const result = await emailService.sendMagicLink({ to: email, magicUrl });
    if (!result.ok && !result.skipped) {
      console.error("[auth-email] magic send failed", result.error);
    }
    return { ok: true as const };
  });

const BetaInviteSchema = z.object({
  email: z.string().email(),
  inviterName: z.string().max(120).optional(),
});

export const sendBetaInvitationEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BetaInviteSchema.parse(input))
  .handler(async ({ data }) => {
    const token = crypto.randomUUID();
    const inviteUrl = `${APP_URL}/auth?beta=${token}&email=${encodeURIComponent(data.email)}`;
    const emailService = getEmailService({ supabase: supabaseAdmin });
    const result = await emailService.sendBetaInvitation({
      to: data.email,
      inviteUrl,
      inviterName: data.inviterName,
    });
    if (!result.ok) throw new Error(result.error ?? "Send failed");
    return { ok: true, inviteUrl };
  });

const TrialSchema = z.object({
  email: z.string().email(),
  recipientName: z.string().max(120).optional(),
  planName: z.string().max(80).optional(),
});

export const sendTrialOnboardingEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TrialSchema.parse(input))
  .handler(async ({ data }) => {
    const emailService = getEmailService({ supabase: supabaseAdmin });
    const result = await emailService.sendTrialOnboarding({
      to: data.email,
      dashboardUrl: `${APP_URL}/app`,
      recipientName: data.recipientName,
      planName: data.planName,
    });
    if (!result.ok) throw new Error(result.error ?? "Send failed");
    return { ok: true };
  });

const FeedbackSchema = z.object({
  email: z.string().email(),
  recipientName: z.string().max(120).optional(),
});

export const sendFeedbackRequestEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FeedbackSchema.parse(input))
  .handler(async ({ data }) => {
    const emailService = getEmailService({ supabase: supabaseAdmin });
    const result = await emailService.sendFeedbackRequest({
      to: data.email,
      feedbackUrl: `${APP_URL}/app?feedback=1`,
      recipientName: data.recipientName,
    });
    if (!result.ok) throw new Error(result.error ?? "Send failed");
    return { ok: true };
  });
