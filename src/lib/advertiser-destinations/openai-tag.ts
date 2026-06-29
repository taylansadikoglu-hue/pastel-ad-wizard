/**
 * OpenAI tagging for destination pages — ad copy + landing summary → marketing tags.
 */

import { z } from "zod";
import { formatLandingPageSummary, type LandingPageSummary } from "./landing-summary";
import type { AdvertiserDestinationRow } from "./types";

export const DestinationAiTagsSchema = z.object({
  product: z.string().nullable(),
  offer: z.string().nullable(),
  persona: z.string().nullable(),
  audience: z.string().nullable(),
  funnel_stage: z.string().nullable(),
  campaign_objective: z.string().nullable(),
  theme: z.string().nullable(),
  promise: z.string().nullable(),
  pain_point: z.string().nullable(),
  proof_point: z.string().nullable(),
});

export type DestinationAiTags = z.infer<typeof DestinationAiTagsSchema>;

const SYSTEM_PROMPT = `You are a performance marketing analyst. Given ad copy and a landing page summary, return STRICT JSON with these string fields (use null when unknown):

- product: finance product or service being promoted
- offer: concrete offer or rate hook
- persona: who the message is written for (role/life stage)
- audience: broader target audience segment
- funnel_stage: awareness | consideration | conversion | retention
- campaign_objective: lead_gen | acquisition | cross_sell | retention | brand
- theme: dominant messaging theme in plain English
- promise: core value promise in one short phrase
- pain_point: primary pain addressed
- proof_point: trust or proof signal (award, rate, social proof, guarantee)

Rules:
- Australian financial services context when cues exist.
- Short phrases only (max ~12 words per field).
- No markdown, no preamble, no extra keys.
- Base product/offer on landing page when ad copy is thin.`;

function normalizeTags(raw: DestinationAiTags): DestinationAiTags {
  const trim = (v: string | null) => {
    if (v == null) return null;
    const t = v.trim();
    return t.length ? t : null;
  };

  return {
    product: trim(raw.product),
    offer: trim(raw.offer),
    persona: trim(raw.persona),
    audience: trim(raw.audience),
    funnel_stage: trim(raw.funnel_stage),
    campaign_objective: trim(raw.campaign_objective),
    theme: trim(raw.theme),
    promise: trim(raw.promise),
    pain_point: trim(raw.pain_point),
    proof_point: trim(raw.proof_point),
  };
}

function parseJsonContent(content: string): DestinationAiTags {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON content");
  }
  return normalizeTags(DestinationAiTagsSchema.parse(parsed));
}

export type TagDestinationWithOpenAiInput = {
  adCopy: string;
  landingSummary: LandingPageSummary;
  model?: string;
  apiKey?: string;
};

export async function tagDestinationWithOpenAi(
  input: TagDestinationWithOpenAiInput,
): Promise<DestinationAiTags> {
  const apiKey = input.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is required for destination tagging");
  }

  const adCopy = input.adCopy.trim();
  if (!adCopy) {
    throw new Error("adCopy is required for destination tagging");
  }

  const userPrompt = [
    "AD COPY:",
    adCopy,
    "",
    "LANDING PAGE SUMMARY:",
    formatLandingPageSummary(input.landingSummary),
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? process.env.OPENAI_TAG_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI tagging failed (${res.status}): ${text.slice(0, 400)}`);
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI tagging returned empty content");
  }

  return parseJsonContent(content);
}

export function tagsToRowPatch(tags: DestinationAiTags, taggedAt: string): Record<string, unknown> {
  return {
    product: tags.product,
    offer: tags.offer,
    persona: tags.persona,
    audience: tags.audience,
    funnel_stage: tags.funnel_stage,
    campaign_objective: tags.campaign_objective,
    theme: tags.theme,
    promise: tags.promise,
    pain_point: tags.pain_point,
    proof_point: tags.proof_point,
    ai_tags: tags,
    ai_tagged_at: taggedAt,
  };
}

export function tagsFromRow(row: AdvertiserDestinationRow): DestinationAiTags | null {
  if (row.ai_tags && typeof row.ai_tags === "object") {
    try {
      return normalizeTags(DestinationAiTagsSchema.parse(row.ai_tags));
    } catch {
      /* fall through to column rebuild */
    }
  }

  if (!row.ai_tagged_at) return null;

  return normalizeTags({
    product: row.product,
    offer: row.offer,
    persona: row.persona,
    audience: row.audience,
    funnel_stage: row.funnel_stage,
    campaign_objective: row.campaign_objective,
    theme: row.theme,
    promise: row.promise,
    pain_point: row.pain_point,
    proof_point: row.proof_point,
  });
}
