import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { WorkspaceShell } from "@/components/adpalette/WorkspaceShell";
import { ENGINE_URL } from "@/lib/engine";
import { displayBrand } from "@/utils/brandDisplay";

type BackfillStatus = {
  id?: string;
  brand?: string | null;
  domain?: string | null;
  status?: string;
  stage_detail?: string | null;
  ad_count?: number | null;
  error?: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Indexing ads",
  complete: "Complete",
  failed: "Failed",
};

function BuildingPage() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<BackfillStatus | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetch(
          `${ENGINE_URL}/api/clients/backfill-status/${encodeURIComponent(jobId)}`,
          { signal: AbortSignal.timeout(20_000) },
        );
        const data = (await res.json()) as BackfillStatus & { error?: string };

        if (!alive) return;

        if (!res.ok && data.error) {
          setPollError(data.error);
          timer = setTimeout(poll, 3000);
          return;
        }

        setPollError(null);
        setStatus(data);

        if (data.status === "complete") {
          const targetDomain = (data.domain ?? data.brand ?? "").trim();
          if (targetDomain) {
            navigate({
              to: "/app/advertiser/$domain",
              params: { domain: targetDomain.replace(/^https?:\/\//, "").replace(/^www\./, "") },
              replace: true,
            });
          }
          return;
        }

        if (data.status === "failed") {
          return;
        }

        timer = setTimeout(poll, 3000);
      } catch {
        if (!alive) return;
        setPollError("Could not reach backfill status — retrying…");
        timer = setTimeout(poll, 3000);
      }
    };

    void poll();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, navigate]);

  const label = status?.status ? (STAGE_LABELS[status.status] ?? status.status) : "Starting";
  const brandLabel = displayBrand(status?.brand ?? status?.domain ?? "Client");

  return (
    <WorkspaceShell title="Building intelligence" subtitle={`Job ${jobId}`}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#FFFFFF",
          border: "1px solid #EBE9E4",
          borderRadius: 10,
          padding: 24,
          textAlign: "center",
        }}
      >
        {status?.status !== "failed" ? (
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: "#C9963A", margin: "0 auto 16px" }}
          />
        ) : null}

        <div style={{ fontSize: 18, fontWeight: 600, color: "#1C1C1A", marginBottom: 8 }}>
          {brandLabel}
        </div>
        <div style={{ fontSize: 13, color: "#6B6B62", marginBottom: 16 }}>
          {status?.stage_detail ?? pollError ?? "Pulling ads from archive sources…"}
        </div>

        <div
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: status?.status === "failed" ? "#C0392B" : "#C9963A",
            background: "#FDF6E8",
            border: "1px solid #E8D5A0",
            borderRadius: 999,
            padding: "6px 12px",
          }}
        >
          {label}
          {status?.ad_count != null ? ` · ${status.ad_count} ads` : ""}
        </div>

        {status?.status === "failed" ? (
          <p style={{ marginTop: 16, fontSize: 13, color: "#C0392B", lineHeight: 1.5 }}>
            {status.error ?? status.stage_detail ?? "Indexing failed. Try again from Ad Library."}
          </p>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

export const Route = createFileRoute("/_authenticated/app/building/$jobId")({
  head: () => ({ meta: [{ title: "Indexing client — RevenuAD Signal" }] }),
  component: BuildingPage,
});
