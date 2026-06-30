import type { EmailSenderRole } from "./types";

const DOMAIN = "revenuad.com";

export const EMAIL_SENDERS: Record<EmailSenderRole, { email: string; name: string }> = {
  hello: { email: `hello@${DOMAIN}`, name: "RevenuAD" },
  notifications: { email: `notifications@${DOMAIN}`, name: "RevenuAD Notifications" },
  beta: { email: `beta@${DOMAIN}`, name: "RevenuAD Beta" },
};

export function formatFrom(role: EmailSenderRole = "notifications"): string {
  const s = EMAIL_SENDERS[role];
  return `${s.name} <${s.email}>`;
}

export const DEFAULT_REPLY_TO = EMAIL_SENDERS.hello.email;
