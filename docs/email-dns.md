# Transactional email — Resend (revenuad.com)

Configure DNS in your domain registrar (or Cloudflare) after adding **revenuad.com** in the [Resend Domains dashboard](https://resend.com/domains).

## Sender addresses

| Role | Address | Use |
|------|---------|-----|
| General | `hello@revenuad.com` | Trial onboarding, feedback |
| Transactional | `notifications@revenuad.com` | Password reset, magic links, scan ready |
| Beta | `beta@revenuad.com` | Beta invitations |

## SPF

Add or merge a TXT record on the root domain:

```txt
v=spf1 include:amazonses.com include:_spf.resend.com ~all
```

If you already send from Google Workspace, merge includes instead of replacing:

```txt
v=spf1 include:_spf.google.com include:amazonses.com include:_spf.resend.com ~all
```

## DKIM

Resend provides 3 CNAME records when you add the domain. Copy them from **Resend → Domains → revenuad.com → DNS records** and publish exactly as shown (typically `resend._domainkey` subdomains).

## DMARC

Recommended starter policy on `_dmarc.revenuad.com`:

```txt
v=DMARC1; p=quarantine; rua=mailto:dmarc@revenuad.com; pct=100; adkim=r; aspf=r
```

Tighten to `p=reject` after 2–4 weeks of clean sending.

## Webhooks

In Resend → Webhooks, create an endpoint:

- **URL:** `https://revenuad.com/api/public/hooks/resend`
- **Events:** `email.bounced`, `email.complained`
- **Secret:** set as `RESEND_WEBHOOK_SECRET` in production env

Bounces and complaints are written to `email_suppressions` and block future sends.

## Environment variables

```bash
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
APP_URL=https://revenuad.com
```

## Verify

```bash
npm run email:verify-dns
npm run email:test -- --to you@agency.com
```

## Supabase Auth (optional)

To route Supabase's built-in auth emails through Resend SMTP instead of custom server functions:

1. Resend → SMTP → copy credentials
2. Supabase Dashboard → Authentication → SMTP → enable custom SMTP
3. Host: `smtp.resend.com`, port `465`, user `resend`, password = API key

Our app uses `requestPasswordResetEmail` and `requestMagicLinkEmail` server functions with branded HTML templates.
