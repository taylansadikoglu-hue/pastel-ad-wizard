#!/usr/bin/env npx tsx
/**
 * Send a test transactional email via Resend.
 *
 * RESEND_API_KEY=re_xxx npm run email:test -- --to you@agency.com
 */
import { ResendEmailService } from "../src/lib/email/ResendEmailService.ts";

async function main() {
  const toArg = process.argv.find((a) => a.startsWith("--to="))?.slice(5)
    ?? process.argv[process.argv.indexOf("--to") + 1];
  const to = toArg ?? process.env.EMAIL_TEST_TO;
  if (!to) {
    console.error("Usage: npm run email:test -- --to you@agency.com");
    process.exit(1);
  }

  const dryRun = !process.env.RESEND_API_KEY;
  const service = new ResendEmailService({ dryRun });

  const result = await service.sendTrialOnboarding({
    to,
    dashboardUrl: "https://revenuad.com/app",
    recipientName: "Test User",
    planName: "Growth",
  });

  console.log(JSON.stringify({ dryRun, to, ...result }, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
