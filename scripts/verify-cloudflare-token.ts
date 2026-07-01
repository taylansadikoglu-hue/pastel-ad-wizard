#!/usr/bin/env npx tsx
/**
 * Check Cloudflare API token permissions (R2 + Workers deploy).
 *
 * CLOUDFLARE_API_TOKEN=cfat_... npm run cloudflare:verify-token
 * Optionally set CLOUDFLARE_WORKERS_API_TOKEN for a split-token setup.
 */
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "7169638abf93eba4c8a9644d870c35fa";
const r2Token = process.env.CLOUDFLARE_API_TOKEN_R2 ?? process.env.CLOUDFLARE_API_TOKEN;
const workersToken = process.env.CLOUDFLARE_WORKERS_API_TOKEN ?? process.env.CLOUDFLARE_API_TOKEN;

if (!r2Token && !workersToken) {
  console.error("Set CLOUDFLARE_API_TOKEN and/or CLOUDFLARE_WORKERS_API_TOKEN");
  process.exit(1);
}

async function probe(token: string, label: string, url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let detail = "";
  try {
    const json = (await res.json()) as { success?: boolean; errors?: { message?: string; code?: number }[] };
    const err = json.errors?.[0];
    detail = err?.message ?? (json.success ? "ok" : "");
    if (err?.code === 10_000) detail = "Insufficient permissions (error 10000)";
  } catch {
    detail = (await res.text().catch(() => "")).slice(0, 80);
  }
  return { label, ok: res.ok, status: res.status, detail };
}

async function auditToken(name: string, token: string | undefined) {
  if (!token) return null;
  const checks = await Promise.all([
    probe(token, "verify", `https://api.cloudflare.com/client/v4/accounts/${accountId}/tokens/verify`),
    probe(token, "r2_buckets", `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`),
    probe(
      token,
      "workers_scripts",
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`,
    ),
  ]);
  return { name, checks };
}

function row(label: string, ok: boolean, detail: string): string {
  const icon = ok ? "✅" : "❌";
  return `│ ${label.padEnd(18)} │ ${icon} ${detail}`.slice(0, 61).padEnd(61) + " │";
}

async function main() {
  const audits = (
    await Promise.all([
      r2Token && workersToken && r2Token !== workersToken
        ? auditToken("R2 token", r2Token)
        : auditToken("CLOUDFLARE_API_TOKEN", r2Token ?? workersToken),
      workersToken && r2Token !== workersToken ? auditToken("Workers token", workersToken) : null,
    ])
  ).filter(Boolean) as { name: string; checks: { label: string; ok: boolean; detail: string }[] }[];

  console.log(`\nCloudflare token audit (account ${accountId})\n`);

  for (const audit of audits) {
    console.log(`── ${audit.name} ──`);
    console.log("┌────────────────────┬─────────────────────────────────────────┐");
    for (const c of audit.checks) {
      console.log(row(c.label, c.ok, c.detail));
    }
    console.log("└────────────────────┴─────────────────────────────────────────┘\n");
  }

  const workersOk = audits.some((a) => a.checks.find((c) => c.label === "workers_scripts")?.ok);
  const r2Ok = audits.some((a) => a.checks.find((c) => c.label === "r2_buckets")?.ok);

  if (!workersOk) {
    console.log("Frontend deploy blocked — create a token with Account → Workers Scripts → Edit");
    console.log("Then: CLOUDFLARE_WORKERS_API_TOKEN=cfat_... npm run deploy:frontend\n");
  } else {
    console.log("Workers deploy ready: npm run deploy:frontend\n");
  }

  if (!r2Ok) {
    console.log("R2 ingest may fail — token needs Account → Cloudflare R2 → Edit\n");
  }

  process.exit(workersOk ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
