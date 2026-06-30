import {
  ArrowUp,
  Crosshair,
  MapPin,
  Megaphone,
  RefreshCw,
  Target,
} from "lucide-react";
import type { AdvertiserVisualScan } from "@/lib/advertiserVisualSignals";
import type { MessagingFingerprint } from "@/lib/messagingFingerprint";
import { MessagingFingerprintPanel } from "@/components/adpalette/MessagingFingerprint";

const PANELS = [
  { key: "what", label: "Running", icon: Target, accent: "#C9963A" },
  { key: "where", label: "Channels", icon: MapPin, accent: "#4285F4" },
  { key: "saying", label: "Message", icon: Megaphone, accent: "#7C3AED" },
  { key: "changed", label: "7-day", icon: RefreshCw, accent: "#0D9488" },
  { key: "gaps", label: "Whitespace", icon: Crosshair, accent: "#1B7F4A" },
] as const;

function ShareBar({ label, pct, colour = "#C9963A" }: { label: string; pct: number; colour?: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 3 }}>
        <span style={{ color: "#E8E8E4", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "72%" }}>
          {label}
        </span>
        <span style={{ color: "#C4C2BA", fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(pct, 4)}%`, height: "100%", background: colour, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function StatBox({ value, label, up }: { value: string | number; label: string; up?: boolean }) {
  return (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: "#FFFFFF", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
        {up ? <ArrowUp size={14} color="#4ADE80" /> : null}
        {value}
      </div>
      <div style={{ fontSize: 9, fontWeight: 600, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function Pill({ children, colour = "rgba(255,255,255,0.1)" }: { children: React.ReactNode; colour?: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        background: colour,
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 6,
        padding: "4px 8px",
        color: "#FFFFFF",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

type Props = {
  brand: string;
  category: string;
  updatedAgo: string | null;
  placementCount: number;
  scan: AdvertiserVisualScan;
  messagingFingerprint?: MessagingFingerprint;
};

export function AdvertiserVisualScan({ brand, category, updatedAgo, placementCount, scan, messagingFingerprint }: Props) {
  return (
    <div
      style={{
        background: "#1C1C1A",
        borderRadius: 12,
        padding: "18px 20px",
        color: "#FFFFFF",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#FBBF24", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Live signals
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em" }}>{brand}</div>
        </div>
        <div style={{ fontSize: 11, color: "#9E9D94" }}>
          {category}
          {placementCount > 0 ? ` · ${placementCount} placements` : ""}
          {updatedAgo ? ` · ${updatedAgo}` : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10 }}>
        {PANELS.map(({ key, label, icon: Icon, accent }) => (
          <div
            key={key}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              padding: "12px 12px",
              minHeight: 120,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: 5, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={11} color="#FFFFFF" />
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#C4C2BA" }}>{label}</span>
            </div>

            {key === "what" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                {scan.campaigns.length ? (
                  scan.campaigns.slice(0, 3).map((c) => (
                    <ShareBar key={c.name} label={c.name} pct={c.sharePct} colour={accent} />
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "#9E9D94" }}>—</span>
                )}
              </div>
            ) : null}

            {key === "where" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignContent: "flex-start" }}>
                {scan.channels.length ? (
                  scan.channels.map((ch) => (
                    <Pill key={ch.name} colour={`${accent}33`}>
                      {ch.name} {ch.pct}%
                    </Pill>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "#9E9D94" }}>—</span>
                )}
              </div>
            ) : null}

            {key === "saying" ? (
              <MessagingFingerprintPanel
                fingerprint={messagingFingerprint ?? { tones: scan.topMessage ? [{ label: scan.topMessage.label, shortLabel: scan.topMessage.label, pct: scan.topMessage.pct }] : [], ctas: scan.topCta ? [{ label: scan.topCta.label, shortLabel: scan.topCta.label, pct: scan.topCta.pct }] : [], stage: null, archetype: null, headline: null }}
                variant="dark"
                compact
              />
            ) : null}

            {key === "changed" ? (
              <div style={{ display: "flex", gap: 4, alignItems: "center", flex: 1 }}>
                <StatBox value={scan.delta.newCreatives} label="New" up={scan.delta.newCreatives > 0} />
                <StatBox value={scan.delta.refreshed} label="Refresh" />
                <StatBox value={scan.delta.adsThisWeek} label="Week" up={scan.delta.adsThisWeek > 0} />
              </div>
            ) : null}

            {key === "gaps" ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignContent: "flex-start" }}>
                {scan.gapChannels.length ? (
                  scan.gapChannels.slice(0, 4).map((ch) => (
                    <Pill key={ch} colour="rgba(27,127,74,0.35)">
                      {ch} · 0%
                    </Pill>
                  ))
                ) : (
                  <span style={{ fontSize: 11, color: "#9E9D94" }}>Full channel cover</span>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const MOVE_COLOURS: Record<"channel" | "message" | "campaign" | "cta", string> = {
  channel: "#1B7F4A",
  message: "#7C3AED",
  campaign: "#C9963A",
  cta: "#4285F4",
};

export function VisualMoveCards({ moves }: { moves: AdvertiserVisualScan["moves"] }) {
  if (!moves.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${moves.length}, minmax(0, 1fr))`, gap: 10 }}>
      {moves.map((move) => (
        <div
          key={`${move.kind}-${move.label}`}
          style={{
            background: "#FFFFFF",
            border: "1px solid #EBE9E4",
            borderTop: `3px solid ${MOVE_COLOURS[move.kind]}`,
            borderRadius: 10,
            padding: "14px 16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "#9E9D94", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {move.hint}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1C1C1A", marginTop: 4, lineHeight: 1.1 }}>
            {move.value}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: MOVE_COLOURS[move.kind], marginTop: 4, textTransform: "capitalize" }}>
            {move.label}
          </div>
        </div>
      ))}
    </div>
  );
}
