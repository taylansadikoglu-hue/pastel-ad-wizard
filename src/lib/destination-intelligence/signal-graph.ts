/**
 * Destination Signal Graph — Advertiser → Product → Offer → Persona → CTA → Theme
 */

import type {
  AdvertiserDestinationRow,
  DestinationSignalGraph,
  DestinationSignalNode,
  DestinationSignalNodeKind,
} from "./types";

function truncate(text: string, max = 36): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function topByField(
  destinations: AdvertiserDestinationRow[],
  pick: (r: AdvertiserDestinationRow) => string | null,
): { label: string; weight: number } | null {
  const counts = new Map<string, number>();
  for (const d of destinations) {
    const v = pick(d)?.trim();
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + d.ad_count);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted[0]) return null;
  const total = destinations.reduce((s, d) => s + d.ad_count, 0) || 1;
  return { label: sorted[0][0], weight: sorted[0][1] / total };
}

export function buildDestinationSignalGraph(
  brand: string,
  destinations: AdvertiserDestinationRow[],
): DestinationSignalGraph {
  const incomplete: string[] = [];
  if (!destinations.length) {
    return {
      nodes: [],
      edges: [],
      available: false,
      incomplete: ["No destination URLs to map yet."],
    };
  }

  const nodes: DestinationSignalNode[] = [];
  const edges: { from: string; to: string }[] = [];

  const addNode = (
    id: string,
    kind: DestinationSignalNodeKind,
    label: string,
    hoverText: string,
    weight: number,
  ) => {
    nodes.push({ id, kind, label: truncate(label), hoverText, weight });
    return id;
  };

  const advertiserId = addNode(
    "dest-advertiser",
    "advertiser",
    brand,
    `${brand} sits at the centre — connected nodes show what landing pages and offers are being promoted.`,
    1,
  );

  const product = topByField(destinations, (r) => r.product);
  const offer = topByField(destinations, (r) => r.offer);
  const persona = topByField(destinations, (r) => r.persona);
  const cta = topByField(destinations, (r) => r.cta);
  const theme = topByField(destinations, (r) => r.theme);

  let tailId = advertiserId;

  if (product) {
    const id = addNode(
      "dest-product",
      "product",
      product.label,
      `Observed product focus: ${product.label}. Derived from indexed landing pages.`,
      product.weight,
    );
    edges.push({ from: tailId, to: id });
    tailId = id;
  } else {
    incomplete.push("Product");
  }

  if (offer) {
    const id = addNode(
      "dest-offer",
      "offer",
      offer.label,
      `Primary offer on landing pages: ${offer.label}.`,
      offer.weight,
    );
    edges.push({ from: tailId, to: id });
    tailId = id;
  } else {
    incomplete.push("Offer");
  }

  if (persona) {
    const id = addNode(
      "dest-persona",
      "persona",
      persona.label,
      `Audience cue from destination enrichment: ${persona.label}.`,
      persona.weight,
    );
    edges.push({ from: tailId, to: id });
    tailId = id;
  } else {
    incomplete.push("Persona");
  }

  if (cta) {
    const id = addNode(
      "dest-cta",
      "cta",
      cta.label,
      `Call to action observed on destination pages: ${cta.label}.`,
      cta.weight,
    );
    edges.push({ from: tailId, to: id });
    tailId = id;
  } else {
    incomplete.push("CTA");
  }

  if (theme) {
    const id = addNode(
      "dest-theme",
      "theme",
      theme.label,
      `Messaging theme on landing experiences: ${theme.label}.`,
      theme.weight,
    );
    edges.push({ from: tailId, to: id });
  } else {
    incomplete.push("Theme");
  }

  return {
    nodes,
    edges,
    available: nodes.length > 1,
    incomplete,
  };
}
