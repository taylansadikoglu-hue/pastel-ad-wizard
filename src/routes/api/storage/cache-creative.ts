import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getR2Storage, isR2Configured } from "@/lib/storage";

const BodySchema = z.object({
  url: z.string().url(),
  key: z.string().min(1).max(512).optional(),
});

function creativeKeyFromUrl(url: string): string {
  const hash = [...url].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
  const ext = url.match(/\.(jpe?g|png|gif|webp|mp4)(\?|$)/i)?.[1]?.toLowerCase() ?? "bin";
  return `creatives/cache/${Math.abs(hash)}.${ext}`;
}

export const Route = createFileRoute("/api/storage/cache-creative")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isR2Configured()) {
          return Response.json({ ok: false, error: "R2 not configured" }, { status: 503 });
        }

        let parsed: z.infer<typeof BodySchema>;
        try {
          parsed = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const key = parsed.key ?? creativeKeyFromUrl(parsed.url);
        const r2 = getR2Storage();
        const result = await r2.putFromUrl(parsed.url, key);

        if (!result.ok) {
          return Response.json(result, { status: 502 });
        }

        return Response.json({
          ok: true,
          key: result.key,
          publicUrl: result.publicUrl,
          cached: true,
        });
      },
    },
  },
});
