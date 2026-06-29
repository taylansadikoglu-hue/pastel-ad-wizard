import { useMemo, useState } from "react";
import {
  buildAdvertiserSignalMap,
  layoutSignalNodes,
  SIGNAL_MAP_MODE_LABELS,
  SIGNAL_NODE_COLORS,
  type AdvertiserSignalMap,
  type SignalMapMode,
  type SignalMapPeer,
  type SignalNode,
  type SignalNodeKind,
} from "@/lib/advertiserSignalMap";
import type { AdvertiserWarInput } from "@/lib/radAdvertiserBrief";

const VIEW_W = 420;
const VIEW_H = 360;

function nodeRadius(kind: SignalNodeKind, weight: number): number {
  if (kind === "advertiser") return 30;
  return 11 + weight * 9;
}

type SignalMapProps = {
  data: AdvertiserSignalMap;
  mode: SignalMapMode;
  activeNodeId: string | null;
  onNodeHover: (node: SignalNode | null) => void;
  onNodeClick: (node: SignalNode) => void;
};

export function SignalMap({
  data,
  mode,
  activeNodeId,
  onNodeHover,
  onNodeClick,
}: SignalMapProps) {
  const positions = useMemo(
    () => layoutSignalNodes(data.nodes, VIEW_W, VIEW_H),
    [data.nodes],
  );

  if (!data.available) {
    return (
      <div
        style={{
          padding: "28px 20px",
          textAlign: "center",
          fontSize: 13,
          color: "#6B6B62",
          background: "#FAFAF8",
          borderRadius: 8,
          border: "1px dashed #E0DDD6",
        }}
      >
        Not enough signal to draw a {SIGNAL_MAP_MODE_LABELS[mode].toLowerCase()} yet. Run a scan or switch mode.
      </div>
    );
  }

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`${SIGNAL_MAP_MODE_LABELS[mode]} for advertiser marketing DNA`}
        style={{ display: "block", maxHeight: 380 }}
      >
        <defs>
          <filter id="signal-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {data.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const dimmed = activeNodeId != null && activeNodeId !== edge.from && activeNodeId !== edge.to;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#D8D4CC"
              strokeWidth={dimmed ? 1 : 1.5}
              strokeOpacity={dimmed ? 0.25 : 0.7}
            />
          );
        })}

        {data.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const r = nodeRadius(node.kind, node.weight);
          const color = SIGNAL_NODE_COLORS[node.kind];
          const isActive = activeNodeId === node.id;
          const isRelated =
            activeNodeId != null &&
            (activeNodeId === node.id ||
              data.edges.some(
                (e) =>
                  (e.from === activeNodeId && e.to === node.id) ||
                  (e.to === activeNodeId && e.from === node.id),
              ));
          const faded = activeNodeId != null && !isRelated;

          return (
            <g
              key={node.id}
              style={{ cursor: node.kind === "advertiser" ? "default" : "pointer" }}
              onMouseEnter={() => onNodeHover(node)}
              onMouseLeave={() => onNodeHover(null)}
              onClick={() => onNodeClick(node)}
              opacity={faded ? 0.35 : 1}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r + (isActive ? 4 : 0)}
                fill={color}
                fillOpacity={node.kind === "advertiser" ? 1 : 0.92}
                stroke={isActive ? "#1C1C1A" : "#FFFFFF"}
                strokeWidth={isActive ? 2.5 : 1.5}
                filter={isActive ? "url(#signal-glow)" : undefined}
              />
              <text
                x={pos.x}
                y={pos.y + r + 14}
                textAnchor="middle"
                fontSize={node.kind === "advertiser" ? 12 : 10}
                fontWeight={node.kind === "advertiser" ? 600 : 500}
                fill={faded ? "#C4C2BA" : "#1C1C1A"}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type SignalMapLegendProps = { compact?: boolean };

export function SignalMapLegend({ compact }: SignalMapLegendProps) {
  const items: { kind: SignalNodeKind; label: string }[] = [
    { kind: "advertiser", label: "Advertiser" },
    { kind: "channel", label: "Channels" },
    { kind: "theme", label: "Themes" },
    { kind: "audience", label: "Audiences" },
    { kind: "competitor", label: "Competitors" },
    { kind: "opportunity", label: "Opportunities" },
    { kind: "move", label: "Moves" },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: compact ? "6px 12px" : "8px 14px",
        fontSize: 11,
        color: "#6B6B62",
      }}
    >
      {items.map(({ kind, label }) => (
        <span key={kind} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: SIGNAL_NODE_COLORS[kind],
              flexShrink: 0,
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

type SignalMapPanelProps = {
  brand: string;
  war: AdvertiserWarInput | null | undefined;
  peers: SignalMapPeer[];
  highlightedSections: Set<string>;
  onHighlightSections: (sections: string[]) => void;
};

export function SignalMapPanel({
  brand,
  war,
  peers,
  highlightedSections,
  onHighlightSections,
}: SignalMapPanelProps) {
  const [mode, setMode] = useState<SignalMapMode>("full");
  const [hoverNode, setHoverNode] = useState<SignalNode | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const data = useMemo(
    () => buildAdvertiserSignalMap(brand, war, mode, peers),
    [brand, war, mode, peers],
  );

  const modes: SignalMapMode[] = ["channel", "messaging", "opportunity", "full"];

  return (
    <div data-export-block="signal-map">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setActiveNodeId(null);
              onHighlightSections([]);
            }}
            style={{
              fontSize: 12,
              fontWeight: mode === m ? 600 : 500,
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${mode === m ? "#C9963A" : "#E0DDD6"}`,
              background: mode === m ? "#FDF6E8" : "#FFFFFF",
              color: mode === m ? "#A07830" : "#6B6B62",
              cursor: "pointer",
            }}
          >
            {SIGNAL_MAP_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <SignalMap
        data={data}
        mode={mode}
        activeNodeId={activeNodeId}
        onNodeHover={setHoverNode}
        onNodeClick={(node) => {
          setActiveNodeId((prev) => {
            const next = prev === node.id ? null : node.id;
            onHighlightSections(next ? node.relatedSections : []);
            return next;
          });
        }}
      />

      <div
        style={{
          marginTop: 12,
          padding: "10px 12px",
          background: "#FAFAF8",
          borderRadius: 6,
          border: "1px solid #EBE9E4",
          fontSize: 12,
          lineHeight: 1.55,
          color: "#1C1C1A",
          minHeight: 44,
        }}
      >
        {hoverNode?.hoverText ??
          (activeNodeId
            ? "Click the node again to clear highlights on related summary cards."
            : "Hover a node for a plain-English read. Click to highlight related summary cards below.")}
      </div>

      <div style={{ marginTop: 12 }}>
        <SignalMapLegend compact />
      </div>

      {data.incomplete.length > 0 && (
        <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9E9D94", lineHeight: 1.5 }}>
          Partial map — missing: {data.incomplete.join(", ")}.
        </p>
      )}

      {highlightedSections.size > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#A07830" }}>
          Highlighting related summary cards below.
        </p>
      )}
    </div>
  );
}
