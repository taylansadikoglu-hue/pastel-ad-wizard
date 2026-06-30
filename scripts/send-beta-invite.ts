#!/usr/bin/env npx tsx
/**
 * Send media beta invite email to one or more recipients (from beta@revenuad.com).
 *
 * RESEND_API_KEY=re_... npm run beta:send-invite -- friend@agency.com "Your Name"
 */
import { ResendEmailService } from "../src/lib/email/ResendEmailService.ts";

const APP_URL = process.env.APP_URL ?? "https://revenuad.com";

async function main() {
  const to = process.argv[2];
  const inviter = process.argv[3] ?? "Taylan";
  if (!to) {
    console.error("Usage: npm run beta:send-invite -- recipient@agency.com [Your Name]");
    process.exit(1);
  }

  const email = new ResendEmailService();
  const result = await email.sendBetaInvitation({
    to,
    inviteUrl: `${APP_URL}/auth?beta=media`,
    inviterName: inviter,
  });

  console.log(JSON.stringify({ to, ...result }, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
