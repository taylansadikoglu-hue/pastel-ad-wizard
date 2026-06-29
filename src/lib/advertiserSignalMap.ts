/**
 * Marketing DNA graph — derived from existing advertiser warroom + watchlist data only.
 */

import {
  buildAdvertiserChannelMix,
  buildAdvertiserRecommendedMoves,
  buildWhatTheyreMissing,
  buildWhatTheyreSaying,
  type AdvertiserWarInput,
} from "@/lib/radAdvertiserBrief";
import { watchlistDisplayName } from "@/lib/agency-watchlist";

export type SignalMapMode = "channel" | "messaging" | "opportunity" | "full";

export type SignalNodeKind =
  | "advertiser"
  | "channel"
  | "theme"
  | "audience"
  | "competitor"
  | "opportunity"
  | "move";

export type SignalNode = {
  id: string;
  kind: SignalNodeKind;
  label: string;
  hoverText: string;
  relatedSections: string[];
  weight: number;
};

export type SignalEdge = {
  from: string;
  to: string;
};

export type AdvertiserSignalMap = {
  nodes: SignalNode[];
  edges: SignalEdge[];
  incomplete: string[];
  available: boolean;
};

export const SIGNAL_NODE_COLORS: Record<SignalNodeKind, string> = {
  advertiser: "#C9963A",
  channel: "#3B82F6",
  theme: "#8B5CF6",
  audience: "#6366F1",
  competitor: "#DC2626",
  opportunity: "#16A34A",
  move: "#D97706",
};

export const SIGNAL_MAP_MODE_LABELS: Record<SignalMapMode, string> = {
  channel: "Channel Map",
  messaging: "Messaging Map",
  opportunity: "Opportunity Map",
  full: "Full Signal Map",
};

const MODE_KINDS: Record<SignalMapMode, SignalNodeKind[]> = {
  channel: ["advertiser", "channel"],
  messaging: ["advertiser", "theme", "audience"],
  opportunity: ["advertiser", "competitor", "opportunity", "move"],
  full: ["advertiser", "channel", "theme", "audience", "competitor", "opportunity", "move"],
};

function truncate(text: string, max = 42): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function normalizePeerDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

export type SignalMapPeer = { domain: string; label: string };

export function peersFromWatchlist(
  domain: string,
  entries: { domain: string; label?: string | null }[],
): SignalMapPeer[] {
  const self = normalizePeerDomain(domain);
  const seen = new Set<string>();
  const peers: SignalMapPeer[] = [];
  for (const row of entries) {
    const d = normalizePeerDomain(row.domain);
    if (!d || d === self || seen.has(d)) continue;
    seen.add(d);
    peers.push({ domain: d, label: watchlistDisplayName(row) });
    if (peers.length >= 4) break;
  }
  return peers;
}

export function buildAdvertiserSignalMap(
  brand: string,
  war: AdvertiserWarInput | null | undefined,
  mode: SignalMapMode,
  peers: SignalMapPeer[] = [],
): AdvertiserSignalMap {
  const incomplete: string[] = [];
  const nodes: SignalNode[] = [];
  const edges: SignalEdge[] = [];
  const allowed = new Set(MODE_KINDS[mode]);

  nodes.push({
    id: "advertiser",
    kind: "advertiser",
    label: truncate(brand, 18),
    hoverText: `${brand} sits at the centre — connected signals show where marketing activity, messaging, and gaps cluster.`,
    relatedSections: ["marketing-read"],
    weight: 1,
  });

  const mix = buildAdvertiserChannelMix(war);
  const saying = buildWhatTheyreSaying(war);
  const gaps = buildWhatTheyreMissing(brand, war);
  const moves = buildAdvertiserRecommendedMoves(brand, war);

  if (allowed.has("channel")) {
    const active = mix.rows.filter((r) => r.pct > 0 || r.ads > 0).sort((a, b) => b.pct - a.pct);
    if (!active.length) {
      incomplete.push("Channel activity");
    } else {
      for (const row of active.slice(0, 6)) {
        const id = `channel-${row.channel.toLowerCase()}`;
        nodes.push({
          id,
          kind: "channel",
          label: row.channel,
          hoverText:
            row.pct > 0
              ? `${row.channel} accounts for about ${Math.round(row.pct)}% of observed placements — ${mix.dataSource === "channels" ? "from indexed ad counts" : "directionally estimated"}.`
              : `${row.channel} has limited indexed placements so far.`,
          relatedSections: ["channel-mix", "marketing-read"],
          weight: Math.max(0.35, row.pct / 100),
        });
        edges.push({ from: "advertiser", to: id });
      }
    }
  }

  if (allowed.has("theme")) {
    if (!saying.themes.length) {
      incomplete.push("Messaging themes");
    } else {
      for (const theme of saying.themes.slice(0, 5)) {
        const id = `theme-${theme.toLowerCase().replace(/\s+/g, "-").slice(0, 24)}`;
        nodes.push({
          id,
          kind: "theme",
          label: truncate(theme, 22),
          hoverText: `Messaging keeps returning to ${theme} — a recurring creative territory in indexed copy.`,
          relatedSections: ["saying-themes", "marketing-read"],
          weight: 0.55,
        });
        edges.push({ from: "advertiser", to: id });
      }
    }
  }

  if (allowed.has("audience")) {
    if (!saying.audienceSignals.length) {
      incomplete.push("Audience signals");
    } else {
      for (const signal of saying.audienceSignals.slice(0, 4)) {
        const id = `audience-${signal.toLowerCase().replace(/\s+/g, "-").slice(0, 24)}`;
        nodes.push({
          id,
          kind: "audience",
          label: truncate(signal, 22),
          hoverText: `Audience cue: ${signal}. Inferred from AI tags on indexed creatives.`,
          relatedSections: ["saying-audience"],
          weight: 0.45,
        });
        edges.push({ from: "advertiser", to: id });
      }
    }
  }

  if (allowed.has("competitor")) {
    if (!peers.length) {
      incomplete.push("Tracked competitors (add peers to client watchlist)");
    } else {
      for (const peer of peers) {
        const id = `competitor-${peer.domain.replace(/\./g, "-")}`;
        nodes.push({
          id,
          kind: "competitor",
          label: truncate(peer.label, 20),
          hoverText: `${peer.label} is on your client watchlist — compare channel and messaging coverage in their war room.`,
          relatedSections: ["moves", "missing"],
          weight: 0.5,
        });
        edges.push({ from: "advertiser", to: id });
      }
    }
  }

  if (allowed.has("opportunity")) {
    const opportunities = gaps.slice(0, 4);
    if (!opportunities.length) {
      incomplete.push("Whitespace opportunities");
    } else {
      for (const gap of opportunities) {
        const id = `opportunity-${gap.toLowerCase().replace(/\s+/g, "-").slice(0, 28)}`;
        nodes.push({
          id,
          kind: "opportunity",
          label: truncate(gap, 26),
          hoverText: gap,
          relatedSections: ["missing"],
          weight: 0.6,
        });
        edges.push({ from: "advertiser", to: id });
      }
    }
  }

  if (allowed.has("move")) {
    if (!moves.length) {
      incomplete.push("Recommended moves");
    } else {
      moves.forEach((move, i) => {
        const id = `move-${i + 1}`;
        nodes.push({
          id,
          kind: "move",
          label: `Move ${i + 1}`,
          hoverText: move,
          relatedSections: ["moves", "talking-points"],
          weight: 0.65,
        });
        edges.push({ from: "advertiser", to: id });
      });
    }
  }

  const satelliteCount = nodes.filter((n) => n.kind !== "advertiser").length;
  return {
    nodes,
    edges,
    incomplete,
    available: satelliteCount > 0,
  };
}

/** Polar layout grouped by node kind for readable DNA rings. */
export function layoutSignalNodes(
  nodes: SignalNode[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const cx = width / 2;
  const cy = height / 2;
  const positions = new Map<string, { x: number; y: number }>();
  positions.set("advertiser", { x: cx, y: cy });

  const satellites = nodes.filter((n) => n.kind !== "advertiser");
  const kindOrder: SignalNodeKind[] = [
    "channel",
    "theme",
    "audience",
    "competitor",
    "opportunity",
    "move",
  ];
  const activeKinds = kindOrder.filter((k) => satellites.some((n) => n.kind === k));
  const sector = (2 * Math.PI) / Math.max(activeKinds.length, 1);

  activeKinds.forEach((kind, kindIndex) => {
    const group = satellites.filter((n) => n.kind === kind);
    const sectorStart = kindIndex * sector - Math.PI / 2;
    const sectorSpan = sector * 0.82;
    const radius = 95 + (kindIndex % 2) * 28;

    group.forEach((node, i) => {
      const t = group.length === 1 ? 0.5 : i / Math.max(group.length - 1, 1);
      const angle = sectorStart + t * sectorSpan;
      positions.set(node.id, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
  });

  return positions;
}
