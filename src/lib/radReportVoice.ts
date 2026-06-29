/** R-AD report personality — 20% bite-sized strategist facts on top of hard data. */

export function radGreeting(category: string): string {
  const cat = category.trim() || "your category";
  return `${cat} pulse — numbers first, one-line reads where it matters.`;
}

export function radTemperatureBite(level: string | null | undefined): string {
  const v = (level ?? "").toLowerCase();
  if (v.includes("heat") || v.includes("hot") || v.includes("rising")) return "Category heat is up — rivals are spending.";
  if (v.includes("cool") || v.includes("decl")) return "Activity cooled — window to steal share.";
  return "Steady week — no sprint, no sleep.";
}

export function radChannelBite(topChannel: string, secondChannel: string): string {
  return `${topChannel} leads; ${secondChannel} still under-weighted.`;
}

export function radProductBite(seasonalLabel: string | null, topProduct: string | null): string {
  if (seasonalLabel) return `${seasonalLabel} creative is clustering — product angles converging.`;
  if (topProduct) return `${topProduct} owns the messaging volume this week.`;
  return "Themes are splintered — no single offer leads yet.";
}

export function radWeeklyBite(risingBrand: string | null): string {
  if (risingBrand) return `${risingBrand} moved fastest WoW — watch their next drop.`;
  return "No breakout brand this week — marginal shifts only.";
}

export function radCompetitorBite(topBrand: string | null, wow: number | null): string {
  if (topBrand && wow != null && wow > 5) return `${topBrand} is loudest at +${wow}% WoW.`;
  if (topBrand) return `${topBrand} still tops share-of-voice.`;
  return "SOV is spread — no clear category bully.";
}

export function radWhitespaceBite(topTerritory: string | null): string {
  if (topTerritory) return `White space sits on ${topTerritory.toLowerCase()} — few rivals own it.`;
  return "Pick a territory competitors aren't defending.";
}

export function radHeroKicker(): string {
  return "The R-AD Report";
}

export function radDataRuleNote(): string {
  return "80% charts & deltas · 20% strategist bites · Evidence for depth";
}

/** @deprecated Use radTemperatureBite — kept for imports during transition */
export function radTemperatureLine(level: string | null | undefined): string {
  return radTemperatureBite(level);
}

/** @deprecated Use radChannelBite */
export function radChannelInsight(topChannel: string, secondChannel: string): string {
  return radChannelBite(topChannel, secondChannel);
}

/** @deprecated Use radProductBite */
export function radProductHook(seasonalLabel: string | null, topProduct: string | null): string {
  return radProductBite(seasonalLabel, topProduct);
}
