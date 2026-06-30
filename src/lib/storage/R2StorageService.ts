import { getR2Config, isR2Configured, r2PublicUrl, type R2Config } from "./r2Config";

export type R2PutResult = {
  ok: boolean;
  key?: string;
  publicUrl?: string;
  etag?: string;
  error?: string;
};

export type R2PutInput = {
  key: string;
  body: ArrayBuffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
};

/**
 * R2 storage via Cloudflare REST API (token with R2 read/write).
 * Swap to Worker R2 binding or S3-compatible SDK later if needed.
 */
export class R2StorageService {
  private readonly config: R2Config;

  constructor(config?: R2Config) {
    this.config = config ?? getR2Config();
  }

  get publicBaseUrl(): string {
    return this.config.publicBaseUrl;
  }

  publicUrl(key: string): string {
    return r2PublicUrl(key, this.config);
  }

  async put(input: R2PutInput): Promise<R2PutResult> {
    if (!isR2Configured(this.config)) {
      return { ok: false, error: "R2 not configured (missing CLOUDFLARE_API_TOKEN)" };
    }

    const key = input.key.replace(/^\/+/, "");
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/r2/buckets/${encodeURIComponent(this.config.bucket)}/objects/${encodeURIComponent(key)}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiToken}`,
    };
    if (input.contentType) headers["Content-Type"] = input.contentType;
    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) {
        headers[`x-amz-meta-${k}`] = v;
      }
    }

    const body =
      typeof input.body === "string"
        ? new TextEncoder().encode(input.body)
        : input.body instanceof Uint8Array
          ? input.body
          : new Uint8Array(input.body);

    const res = await fetch(url, { method: "PUT", headers, body });
    const text = await res.text();

    if (!res.ok) {
      return { ok: false, error: `R2 PUT ${res.status}: ${text}` };
    }

    let etag: string | undefined;
    try {
      const json = JSON.parse(text) as { result?: { etag?: string } };
      etag = json.result?.etag;
    } catch {
      // ignore
    }

    return {
      ok: true,
      key,
      publicUrl: this.publicUrl(key),
      etag,
    };
  }

  async putFromUrl(sourceUrl: string, key: string): Promise<R2PutResult> {
    try {
      const res = await fetch(sourceUrl, {
        headers: { "User-Agent": "RevenuAD-R2-Cache/1.0" },
      });
      if (!res.ok) {
        return { ok: false, error: `Fetch ${res.status} for ${sourceUrl}` };
      }
      const buf = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      return this.put({ key, body: buf, contentType, metadata: { source: sourceUrl } });
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}

let cached: R2StorageService | null = null;

export function getR2Storage(): R2StorageService {
  if (!cached) cached = new R2StorageService();
  return cached;
}
