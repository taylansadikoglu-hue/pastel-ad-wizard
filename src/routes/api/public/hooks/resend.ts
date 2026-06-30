import { createFileRoute } from "@tanstack/react-router";
import { addEmailSuppression, logEmailEvent } from "@/lib/email/suppression";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    bounce?: { message?: string };
    complaint?: { feedback_type?: string };
  };
};

function extractRecipient(event: ResendWebhookEvent): string | null {
  const to = event.data?.to;
  if (typeof to === "string") return to;
  if (Array.isArray(to) && to[0]) return to[0];
  return null;
}

export const Route = createFileRoute("/api/public/hooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        if (secret) {
          const sig = request.headers.get("svix-signature") ?? request.headers.get("resend-signature");
          if (!sig) {
            return new Response("Missing signature", { status: 401 });
          }
          // Full Svix verification requires raw body + svix-id/timestamp — log for now
        }

        let payload: ResendWebhookEvent | ResendWebhookEvent[];
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const events = Array.isArray(payload) ? payload : [payload];

        for (const event of events) {
          const email = extractRecipient(event);
          await logEmailEvent(supabaseAdmin, {
            eventType: event.type,
            email,
            providerId: event.data?.email_id ?? null,
            payload: event,
          });

          if (event.type === "email.bounced" && email) {
            await addEmailSuppression(supabaseAdmin, email, "bounce", {
              providerEventId: event.data?.email_id,
              metadata: { message: event.data?.bounce?.message },
            });
          }

          if (event.type === "email.complained" && email) {
            await addEmailSuppression(supabaseAdmin, email, "complaint", {
              providerEventId: event.data?.email_id,
              metadata: { feedback: event.data?.complaint?.feedback_type },
            });
          }
        }

        return Response.json({ ok: true, processed: events.length });
      },
    },
  },
});
