import type { MessagingFingerprint } from "@/lib/messagingFingerprint";
import { TONE_COLOURS } from "@/lib/messagingFingerprint";

type Variant = "light" | "dark";

function StackedBar({
  slices,
  colours,
  emptyColour,
}: {
  slices: { pct: number }[];
  colours: string[];
  emptyColour: string;
}) {
  const active = slices.filter((s) => s.pct > 0);
  if (!active.length) {
    return <div style={{ height: 8, borderRadius: 4, background: emptyColour }} />;
  }
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: emptyColour }}>
      {active.map((s, i) => (
        <div
          key={i}
          style={{
            width: `${Math.max(s.pct, 2)}%`,
            background: colours[i % colours.length],
            minWidth: s.pct > 0 ? 2 : 0,
          }}
        />
      ))}
    </div>
  );
}

function LegendRow({
  slices,
  colours,
  variant,
}: {
  slices: MessagingFingerprint["tones"];
  colours: string[];
  variant: Variant;
}) {
  const muted = variant === "dark" ? "#9E9D94" : "#6B6B62";
  const text = variant === "dark" ? "#FFFFFF" : "#1C1C1A";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {slices.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: colours[i % colours.length],
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: text }}>{s.shortLabel}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: muted }}>{s.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function MetaChip({ label, variant }: { label: string; variant: Variant }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 20,
        background: variant === "dark" ? "rgba(255,255,255,0.1)" : "#F7F6F3",
        border: variant === "dark" ? "1px solid rgba(255,255,255,0.15)" : "1px solid #EBE9E4",
        color: variant === "dark" ? "#FFFFFF" : "#1C1C1A",
      }}
    >
      {label}
    </span>
  );
}

type Props = {
  fingerprint: MessagingFingerprint;
  variant?: Variant;
  compact?: boolean;
};

export function MessagingFingerprintPanel({ fingerprint, variant = "light", compact = false }: Props) {
  const { tones, ctas, stage, archetype, headline } = fingerprint;
  const hasData = tones.length > 0 || ctas.length > 0 || stage || archetype;
  const lead = tones[0];
  const muted = variant === "dark" ? "#9E9D94" : "#6B6B62";
  const subtext = variant === "dark" ? "#C4C2BA" : "#9E9D94";
  const border = variant === "dark" ? "rgba(255,255,255,0.1)" : "#EBE9E4";
  const bg = variant === "dark" ? "rgba(255,255,255,0.05)" : "#FFFFFF";

  if (!hasData) {
    return (
      <div style={{ fontSize: 12, color: subtext }}>—</div>
    );
  }

  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "center" }}>
        {lead ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: variant === "dark" ? "#FFF" : "#1C1C1A", lineHeight: 1 }}>
                {lead.pct}%
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: TONE_COLOURS[0], textTransform: "capitalize" }}>
                {lead.shortLabel}
              </span>
            </div>
            <StackedBar slices={tones} colours={TONE_COLOURS} emptyColour={variant === "dark" ? "rgba(255,255,255,0.12)" : "#F0EDE8"} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {stage ? <MetaChip label={stage} variant={variant} /> : null}
              {ctas[0] ? (
                <MetaChip label={`${ctas[0].shortLabel} ${ctas[0].pct}%`} variant={variant} />
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 10,
        padding: "16px 18px",
        borderLeft: variant === "light" ? "4px solid #7C3AED" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: subtext, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            What they&apos;re saying
          </div>
          {lead ? (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: variant === "dark" ? "#FFF" : "#1C1C1A", lineHeight: 1, letterSpacing: "-0.03em" }}>
                {lead.pct}%
              </span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#7C3AED", textTransform: "capitalize" }}>
                {lead.shortLabel}
              </span>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
          {stage ? <MetaChip label={stage} variant={variant} /> : null}
          {archetype ? <MetaChip label={archetype} variant={variant} /> : null}
        </div>
      </div>

      {tones.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Tone mix
          </div>
          <StackedBar slices={tones} colours={TONE_COLOURS} emptyColour={variant === "dark" ? "rgba(255,255,255,0.12)" : "#F0EDE8"} />
          <LegendRow slices={tones} colours={TONE_COLOURS} variant={variant} />
        </div>
      ) : null}

      {ctas.length > 0 ? (
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Calls to action
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ctas.map((c) => (
              <div
                key={c.label}
                style={{
                  flex: "1 1 100px",
                  minWidth: 90,
                  background: variant === "dark" ? "rgba(66,133,244,0.15)" : "#F0F4FF",
                  border: variant === "dark" ? "1px solid rgba(66,133,244,0.3)" : "1px solid #D0E0FF",
                  borderRadius: 8,
                  padding: "8px 10px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 800, color: variant === "dark" ? "#FFF" : "#1C1C1A" }}>{c.pct}%</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4285F4", marginTop: 2, textTransform: "capitalize" }}>
                  {c.shortLabel}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {headline ? (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 6,
            background: variant === "dark" ? "rgba(255,255,255,0.06)" : "#F7F6F3",
            fontSize: 13,
            fontWeight: 600,
            color: variant === "dark" ? "#E8E8E4" : "#1C1C1A",
            fontStyle: "italic",
            lineHeight: 1.35,
          }}
        >
          &ldquo;{headline}&rdquo;
        </div>
      ) : null}
    </div>
  );
}
