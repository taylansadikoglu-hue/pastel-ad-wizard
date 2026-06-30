import { AwsClient } from "aws4fetch";
import { getR2Config, type R2Config } from "./r2Config";

let cachedClient: AwsClient | null | undefined;

/** Lazily build an S3-signing client for R2 jurisdiction endpoint reads. */
export function getR2S3Client(config = getR2Config()): AwsClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const { accessKeyId, secretAccessKey } = config.s3;
  if (!accessKeyId || !secretAccessKey) {
    cachedClient = null;
    return null;
  }

  cachedClient = new AwsClient({
    accessKeyId,
    secretAccessKey,
  });
  return cachedClient;
}

/** S3 object URL: `{endpoint}/{bucket}/{key}` (path-style, per Cloudflare R2 docs). */
export function r2S3ObjectUrl(key: string, config: R2Config = getR2Config()): string {
  const normalized = key.replace(/^\/+/, "");
  return `${config.s3.endpoint}/${config.bucket}/${normalized}`;
}
