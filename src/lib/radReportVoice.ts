/** R-AD report personality — 20% story layer on top of hard data. */

export function radGreeting(category: string): string {
  const cat = category.trim() || "your category";
  return `R-AD here. ${cat} just shifted — here's the read before tomorrow's meeting.`;
}

export function radTemperatureLine(level: string | null | undefined): string {
  const v = (level ?? "").toLowerCase();
  if (v.includes("heat") || v.includes("hot") || v.includes("rising")) {
    return "The category's heating up. More brands are pushing spend and fresh creative.";
  }
  if (v.includes("cool") || v.includes("decl")) {
    return "Activity cooled slightly — good window to steal share with a sharper angle.";
  }
  return "Steady week. No one's sleeping, but no one's sprinting either.";
}

export function radChannelInsight(topChannel: string, secondChannel: string): string {
  return `${topChannel} dominates while ${secondChannel} stays under-invested — classic banking imbalance.`;
}

export function radProductHook(seasonalLabel: string | null, topProduct: string | null): string {
  if (seasonalLabel) {
    return `${seasonalLabel} are live across the category — product-led angles are clustering fast.`;
  }
  if (topProduct) {
    return `${topProduct} is where most of the messaging volume sits this week.`;
  }
  return "Product themes are splintering — no single offer owns the category yet.";
}

export function radSignOff(clientName: string): string {
  const client = clientName.trim() || "your client";
  return `That's the 80% you need in the room. The other 20% is what you say about ${client}.`;
}

export function radHeroKicker(): string {
  return "The R-AD Report";
}

export function radDataRuleNote(): string {
  return "80% signal · 20% story — tap Evidence on any block for the full trail.";
}
