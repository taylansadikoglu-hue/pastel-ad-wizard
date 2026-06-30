export type EmailSenderRole = "hello" | "notifications" | "beta";

export type TransactionalEmailType =
  | "password_reset"
  | "magic_link"
  | "beta_invitation"
  | "trial_onboarding"
  | "feedback_request"
  | "scan_ready";

export type SendEmailInput = {
  type: TransactionalEmailType;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  fromRole?: EmailSenderRole;
  replyTo?: string;
  tags?: { name: string; value: string }[];
  headers?: Record<string, string>;
};

export type SendEmailResult = {
  ok: boolean;
  id?: string;
  skipped?: "suppressed" | "dry_run";
  error?: string;
};

export type PasswordResetPayload = {
  to: string;
  resetUrl: string;
  recipientName?: string | null;
};

export type MagicLinkPayload = {
  to: string;
  magicUrl: string;
  recipientName?: string | null;
};

export type BetaInvitationPayload = {
  to: string;
  inviteUrl: string;
  inviterName?: string | null;
};

export type TrialOnboardingPayload = {
  to: string;
  dashboardUrl: string;
  recipientName?: string | null;
  planName?: string | null;
};

export type FeedbackRequestPayload = {
  to: string;
  feedbackUrl: string;
  recipientName?: string | null;
};
