import type { EmailService } from "./EmailService";
import { DEFAULT_REPLY_TO, formatFrom } from "./senders";
import {
  betaInvitationHtml,
  feedbackRequestHtml,
  magicLinkHtml,
  passwordResetHtml,
  trialOnboardingHtml,
} from "./templates";
import type {
  BetaInvitationPayload,
  FeedbackRequestPayload,
  MagicLinkPayload,
  PasswordResetPayload,
  SendEmailInput,
  SendEmailResult,
  TrialOnboardingPayload,
} from "./types";
import { isEmailSuppressed } from "./suppression";
import type { SupabaseClient } from "@supabase/supabase-js";

const RESEND_API = "https://api.resend.com/emails";

export type ResendEmailServiceOptions = {
  apiKey?: string;
  supabase?: SupabaseClient | null;
  dryRun?: boolean;
};

export class ResendEmailService implements EmailService {
  private readonly apiKey: string;
  private readonly supabase: SupabaseClient | null;
  private readonly dryRun: boolean;

  constructor(options: ResendEmailServiceOptions = {}) {
    const key = options.apiKey ?? process.env.RESEND_API_KEY;
    if (!options.dryRun && !key) {
      throw new Error("RESEND_API_KEY is required");
    }
    this.apiKey = key ?? "dry-run";
    this.supabase = options.supabase ?? null;
    this.dryRun = options.dryRun ?? false;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const recipients = Array.isArray(input.to) ? input.to : [input.to];

    for (const raw of recipients) {
      const email = raw.trim().toLowerCase();
      if (this.supabase && (await isEmailSuppressed(this.supabase, email))) {
        return { ok: true, skipped: "suppressed" };
      }
    }

    if (this.dryRun) {
      console.info("[email] dry-run send", input.type, recipients);
      return { ok: true, skipped: "dry_run", id: `dry-${Date.now()}` };
    }

    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: formatFrom(input.fromRole ?? defaultRoleForType(input.type)),
        to: recipients,
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo ?? DEFAULT_REPLY_TO,
        tags: input.tags,
        headers: input.headers,
      }),
    });

    const body = await res.text();
    if (!res.ok) {
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }

    let id: string | undefined;
    try {
      id = JSON.parse(body)?.id;
    } catch {
      // ignore
    }
    return { ok: true, id };
  }

  async sendPasswordReset(payload: PasswordResetPayload): Promise<SendEmailResult> {
    return this.send({
      type: "password_reset",
      to: payload.to,
      subject: "Reset your RevenuAD password",
      html: passwordResetHtml(payload.resetUrl, payload.recipientName),
      fromRole: "notifications",
    });
  }

  async sendMagicLink(payload: MagicLinkPayload): Promise<SendEmailResult> {
    return this.send({
      type: "magic_link",
      to: payload.to,
      subject: "Sign in to RevenuAD",
      html: magicLinkHtml(payload.magicUrl, payload.recipientName),
      fromRole: "notifications",
    });
  }

  async sendBetaInvitation(payload: BetaInvitationPayload): Promise<SendEmailResult> {
    return this.send({
      type: "beta_invitation",
      to: payload.to,
      subject: "You're invited to the RevenuAD beta",
      html: betaInvitationHtml(payload.inviteUrl, payload.inviterName),
      fromRole: "beta",
    });
  }

  async sendTrialOnboarding(payload: TrialOnboardingPayload): Promise<SendEmailResult> {
    return this.send({
      type: "trial_onboarding",
      to: payload.to,
      subject: "Your RevenuAD trial is ready",
      html: trialOnboardingHtml(payload.dashboardUrl, payload.recipientName, payload.planName),
      fromRole: "hello",
    });
  }

  async sendFeedbackRequest(payload: FeedbackRequestPayload): Promise<SendEmailResult> {
    return this.send({
      type: "feedback_request",
      to: payload.to,
      subject: "Quick feedback on RevenuAD?",
      html: feedbackRequestHtml(payload.feedbackUrl, payload.recipientName),
      fromRole: "hello",
    });
  }
}

function defaultRoleForType(type: SendEmailInput["type"]) {
  if (type === "beta_invitation") return "beta" as const;
  if (type === "trial_onboarding" || type === "feedback_request") return "hello" as const;
  return "notifications" as const;
}
