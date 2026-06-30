/**
 * Cloudflare R2 — creative vault for cached ad thumbnails, exports, and assets.
 * Public dev URL serves objects when bucket public access is enabled in Cloudflare.
 */

export type R2S3Config = {
  accessKeyId: string | null;
  secretAccessKey: string | null;
  endpoint: string;
};

export type R2Config = {
  accountId: string;
  bucket: string;
  publicBaseUrl: string;
  apiToken: string | null;
  s3: R2S3Config;
};

const DEFAULT_PUBLIC_URL = "https://pub-cf328a68c22840b998bf5b84a553b21c.r2.dev";
const DEFAULT_BUCKET = "revenuead-creative-vault";
const DEFAULT_ACCOUNT_ID = "7169638abf93eba4c8a9644d870c35fa";
const DEFAULT_S3_ENDPOINT = `https://${DEFAULT_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export function getR2Config(): R2Config {
  return {
    accountId:
      process.env.CLOUDFLARE_ACCOUNT_ID ??
      process.env.R2_ACCOUNT_ID ??
      DEFAULT_ACCOUNT_ID,
    bucket: process.env.R2_BUCKET_NAME ?? DEFAULT_BUCKET,
    publicBaseUrl: (
      process.env.R2_PUBLIC_URL ??
      process.env.VITE_R2_PUBLIC_URL ??
      DEFAULT_PUBLIC_URL
    ).replace(/\/$/, ""),
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? null,
    s3: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? null,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? null,
      endpoint: (process.env.R2_S3_ENDPOINT ?? DEFAULT_S3_ENDPOINT).replace(/\/$/, ""),
    },
  };
}

/** Build a public URL for an object key (requires r2.dev or custom domain on bucket). */
export function r2PublicUrl(key: string, config = getR2Config()): string {
  const normalized = key.replace(/^\/+/, "");
  return `${config.publicBaseUrl}/${normalized}`;
}

/** True when server can write to R2 via Cloudflare API token. */
export function isR2Configured(config = getR2Config()): boolean {
  return Boolean(config.apiToken && config.accountId && config.bucket);
}

/** True when server can read objects via R2 S3-compatible API (e.g. revenuead-worker-token). */
export function isR2S3ReadConfigured(config = getR2Config()): boolean {
  return Boolean(
    config.s3.accessKeyId &&
      config.s3.secretAccessKey &&
      config.s3.endpoint &&
      config.bucket,
  );
}

/** Client-safe public base for img src (no secrets). */
export function clientR2PublicBase(): string {
  const fromEnv =
    typeof import.meta !== "undefined" &&
    (import.meta.env?.VITE_R2_PUBLIC_URL as string | undefined);
  return (fromEnv ?? DEFAULT_PUBLIC_URL).replace(/\/$/, "");
}

export function clientR2PublicUrl(key: string): string {
  return `${clientR2PublicBase()}/${key.replace(/^\/+/, "")}`;
}
