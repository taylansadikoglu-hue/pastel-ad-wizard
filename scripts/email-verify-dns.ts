#!/usr/bin/env npx tsx
/**
 * Verify Resend DNS records for revenuad.com (SPF, DKIM, DMARC).
 *
 * RESEND_API_KEY=re_xxx npm run email:verify-dns
 */
const DOMAIN = process.env.EMAIL_DOMAIN ?? "revenuad.com";
const API = "https://api.resend.com/domains";

async function main() {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(
      JSON.stringify(
        {
          status: "dry_run",
          domain: DOMAIN,
          checklist: {
            spf: `v=spf1 include:amazonses.com include:_spf.resend.com ~all`,
            dkim: "Add Resend DKIM CNAMEs from dashboard → Domains → revenuad.com",
            dmarc: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}; pct=100`,
            webhook: `POST https://revenuad.com/api/public/hooks/resend (bounce + complaint)`,
          },
          note: "Set RESEND_API_KEY to query live verification status from Resend API.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const listRes = await fetch(API, { headers: { Authorization: `Bearer ${key}` } });
  const list = (await listRes.json()) as { data?: { id: string; name: string }[] };
  const domain = list.data?.find((d) => d.name === DOMAIN);

  if (!domain) {
    console.log(JSON.stringify({ status: "not_found", domain, domains: list.data?.map((d) => d.name) }, null, 2));
    process.exit(1);
  }

  const detailRes = await fetch(`${API}/${domain.id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const detail = await detailRes.json();

  console.log(JSON.stringify({ status: "ok", domain: DOMAIN, verification: detail }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
