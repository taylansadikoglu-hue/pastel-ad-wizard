import type {
  BetaInvitationPayload,
  FeedbackRequestPayload,
  MagicLinkPayload,
  PasswordResetPayload,
  SendEmailInput,
  SendEmailResult,
  TrialOnboardingPayload,
} from "./types";

/** Provider-agnostic transactional email contract — swap Resend for Postmark later. */
export interface EmailService {
  send(input: SendEmailInput): Promise<SendEmailResult>;
  sendPasswordReset(payload: PasswordResetPayload): Promise<SendEmailResult>;
  sendMagicLink(payload: MagicLinkPayload): Promise<SendEmailResult>;
  sendBetaInvitation(payload: BetaInvitationPayload): Promise<SendEmailResult>;
  sendTrialOnboarding(payload: TrialOnboardingPayload): Promise<SendEmailResult>;
  sendFeedbackRequest(payload: FeedbackRequestPayload): Promise<SendEmailResult>;
}
