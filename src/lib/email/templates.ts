const BRAND = "#1C1C1A";
const ACCENT = "#F7A501";
const MUTED = "#6B6B62";

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:32px 16px;background:#F4F4F0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="text-align:center;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND};margin:0 0 20px;">RevenuAD Signal</p>
    <div style="background:#fff;border:1.5px solid ${BRAND};border-radius:8px;padding:32px 28px;box-shadow:4px 4px 0 ${BRAND};">
      <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:${BRAND};">${title}</h1>
      ${body}
    </div>
    <p style="text-align:center;font-size:11px;color:#9a9b8c;margin:20px 0 0;">revenuad.com · Competitive ad intelligence</p>
  </div>
</body></html>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:24px 0 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${ACCENT};color:${BRAND};border:1.5px solid ${BRAND};border-radius:6px;padding:14px 28px;font-size:15px;font-weight:700;text-decoration:none;box-shadow:3px 3px 0 ${BRAND};">${label}</a>
  </p>`;
}

export function passwordResetHtml(resetUrl: string, name?: string | null): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return layout(
    "Reset your password",
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${MUTED};">${greeting}</p>
     <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">We received a request to reset your RevenuAD workspace password. This link expires in 1 hour.</p>
     ${cta(resetUrl, "Set new password")}
     <p style="margin:20px 0 0;font-size:12px;color:#9a9b8c;">If you didn't request this, you can ignore this email.</p>`,
  );
}

export function magicLinkHtml(magicUrl: string, name?: string | null): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return layout(
    "Your sign-in link",
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${MUTED};">${greeting}</p>
     <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">Click below to sign in to RevenuAD — no password needed. Link expires in 1 hour.</p>
     ${cta(magicUrl, "Sign in to RevenuAD")}`,
  );
}

export function betaInvitationHtml(inviteUrl: string, inviter?: string | null): string {
  return layout(
    "You're invited to the RevenuAD beta",
    `<p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">
       ${inviter ? `${inviter} invited you` : "You've been invited"} to try RevenuAD Signal — observed creative intelligence for agency pitches.
     </p>
     ${cta(inviteUrl, "Accept beta invite")}`,
  );
}

export function trialOnboardingHtml(
  dashboardUrl: string,
  name?: string | null,
  planName?: string | null,
): string {
  const greeting = name ? `Welcome, ${name}!` : "Welcome!";
  return layout(
    "Your trial is live",
    `<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${MUTED};">${greeting}</p>
     <p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">
       Your ${planName ?? "Growth"} trial workspace is ready. Index competitors, build market intel, and export pitch decks in minutes.
     </p>
     ${cta(dashboardUrl, "Open your workspace")}`,
  );
}

export function feedbackRequestHtml(feedbackUrl: string, name?: string | null): string {
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return layout(
    "Quick feedback?",
    `<p style="margin:0;font-size:15px;line-height:1.6;color:${MUTED};">${greeting}</p>
     <p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:${MUTED};">You’ve been using RevenuAD — we'd love 2 minutes of honest feedback to shape what we build next.</p>
     ${cta(feedbackUrl, "Share feedback")}`,
  );
}
