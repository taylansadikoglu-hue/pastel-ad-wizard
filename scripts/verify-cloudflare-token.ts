#!/usr/bin/env npx tsx
/**
 * Check what a Cloudflare API token can access.
 *
 * CLOUDFLARE_API_TOKEN=cfat_... npm run cloudflare:verify-token
 */
const token = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "7169638abf93eba4c8a9644d870c35fa";

if (!token) {
  console.error("Set CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

async function probe(label: string, url: string, method = "GET") {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
  let detail = "";
  try {
    const json = (await res.json()) as { success?: boolean; errors?: { message?: string }[] };
    detail = json.errors?.[0]?.message ?? (json.success ? "ok" : "");
  } catch {
    detail = await res.text().catch(() => "");
  }
  return { label, status: res.status, ok: res.ok, detail: detail.slice(0, 120) };
}

async function main() {
  const checks = await Promise.all([
    probe(
      "token_verify",
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`,
    ),
    probe(
      "r2_list_buckets",
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
    ),
    probe(
      "workers_list_scripts",
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
    ),
    probe(
      "workers_secrets",
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/taylansadikoglu-hue-pastel-ad-wizard/secrets`,
    ),
  ]);

  console.log(JSON.stringify({ accountId, checks }, null, 2));

  const r2 = checks.find((c) => c.label === "r2_list_buckets")?.ok;
  const workers = checks.find((c) => c.label === "workers_secrets")?.ok;

  if (!r2 || !workers) {
    console.log(
      "\nTo use one token for everything, edit the token in Cloudflare dashboard and add:\n" +
        "  • Account → Cloudflare R2 → Edit\n" +
        "  • Account → Workers Scripts → Edit\n",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
