import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SYSTEM_PROMPT = `You are a Quantitative Data Analyst. You receive two distinct corpora about a competitor brand:

1. AD COPY — text scraped from the brand's live paid placements (Meta Ads Library + Google Ads).
2. CONSUMER COMMENTS — real user comments and engagement scraped from the brand's social posts (Facebook/Instagram).

Return STRICT JSON with three string fields:
- "good": analyze the CONSUMER COMMENTS — what real users praise, love, or repeatedly call out as a strength. Cite recurring themes.
- "friction": analyze the CONSUMER COMMENTS — the concrete pain points, complaints, objections, or frustrations users voice in their own words.
- "blueprint": analyze the AD COPY only — distill the competitor's core marketing hook into one punchy, copy-ready ad angle that captures their dominant message.

Each block: 2-3 sentences max. No hedging, no preamble, no emojis. If a corpus is empty, say so explicitly in that field.`;

const COUNTRY_NAMES = ["United States", "Australia", "United Kingdom", "Canada"] as const;
const DomainSchema = z.object({
  domain: z.string().min(3).max(255),
  country: z.enum(COUNTRY_NAMES).optional().default("United States"),
});

export const startScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    // Defensive: accept either the raw payload, a `{ data: {...} }` wrapper,
    // or a stringified JSON blob — then validate with Zod.
    let raw: unknown = input;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch { /* leave as-is */ }
    }
    if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
      const inner = (raw as Record<string, unknown>).data;
      if (inner && typeof inner === "object") raw = inner;
    }
    console.log("startScan inputValidator raw payload:", raw);
    return DomainSchema.parse(raw);
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    console.log("startScan handler received data:", data);

    // Preserve the FULL domain (e.g. "commbank.com.au"). The background worker
    // reads this row and passes `domain` straight into DataForSEO as the target.
    // Do NOT strip the TLD or reduce to a brand token here.
    const rawDomain = (data?.domain ?? "").toString();
    const domain = rawDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/\/.*$/, "");
    if (!domain || !domain.includes(".")) {
      console.error("startScan aborted: invalid domain", { rawDomain, normalized: domain });
      throw new Error("A valid full domain is required (e.g. commbank.com.au)");
    }

    console.log("Creating scan:", domain);
    const { data: scan, error: scanErr } = await supabase
      .from("domain_scans")
      .insert({ user_id: userId, domain, status: "pending" })
      .select("id, domain, status")
      .single();

    if (scanErr || !scan) {
      console.error("Failed to insert pending domain_scans row", { domain, error: scanErr });
      throw new Error(scanErr?.message ?? "Failed to create scan");
    }

    console.log("Pending scan created in domain_scans:", scan);
    // The background worker polls domain_scans for status = 'pending' and
    // owns the lifecycle from here (running → done/error). Do not run the
    // Apify / DataForSEO / AI pipeline inline.
    return { scan_id: scan.id, domain: scan.domain, status: "pending" as const };
  });
