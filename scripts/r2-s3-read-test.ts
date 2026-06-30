#!/usr/bin/env npx tsx
/**
 * Verify R2 S3-compatible read access (revenuead-worker-token).
 *
 * R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... npm run r2:s3-read-test [object-key]
 */
import {
  getR2Config,
  getR2Storage,
  isR2S3ReadConfigured,
  r2S3ObjectUrl,
} from "../src/lib/storage/index.ts";

async function main() {
  const cfg = getR2Config();
  const key = process.argv[2] ?? "healthcheck/latest.txt";

  console.log(
    JSON.stringify(
      {
        bucket: cfg.bucket,
        s3Endpoint: cfg.s3.endpoint,
        s3ReadConfigured: isR2S3ReadConfigured(cfg),
        objectUrl: r2S3ObjectUrl(key, cfg),
      },
      null,
      2,
    ),
  );

  if (!isR2S3ReadConfigured(cfg)) {
    console.error("Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
    process.exit(1);
  }

  const r2 = getR2Storage();
  const result = await r2.get(key);

  if (!result.ok) {
    console.error(JSON.stringify({ get: result }, null, 2));
    process.exit(1);
  }

  const preview =
    result.body && result.body.byteLength <= 256
      ? new TextDecoder().decode(result.body)
      : result.body
        ? `${result.body.byteLength} bytes`
        : undefined;

  console.log(
    JSON.stringify(
      {
        get: {
          ok: true,
          key: result.key,
          contentType: result.contentType,
          etag: result.etag,
          preview,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
