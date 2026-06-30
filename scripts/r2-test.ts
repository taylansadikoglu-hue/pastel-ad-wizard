#!/usr/bin/env npx tsx
/**
 * Verify Cloudflare R2 connectivity.
 *
 * CLOUDFLARE_API_TOKEN=cfat_... npm run r2:test
 */
import { getR2Storage, getR2Config, r2PublicUrl } from "../src/lib/storage/index.ts";

async function main() {
  const cfg = getR2Config();
  const r2 = getR2Storage();
  const key = `healthcheck/${Date.now()}.txt`;
  const body = `RevenuAD R2 OK ${new Date().toISOString()}`;

  console.log(
    JSON.stringify(
      {
        accountId: cfg.accountId,
        bucket: cfg.bucket,
        publicBase: cfg.publicBaseUrl,
        tokenConfigured: Boolean(cfg.apiToken),
      },
      null,
      2,
    ),
  );

  const put = await r2.put({ key, body, contentType: "text/plain" });
  console.log(JSON.stringify({ put }, null, 2));

  if (put.ok) {
    const check = await fetch(put.publicUrl!);
    console.log(
      JSON.stringify(
        {
          publicUrl: put.publicUrl,
          publicStatus: check.status,
          note:
            check.status === 404
              ? "Upload succeeded but public URL 404 — enable r2.dev public access on this bucket in Cloudflare dashboard"
              : undefined,
        },
        null,
        2,
      ),
    );
  }

  if (!put.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
