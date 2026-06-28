/** Channel recommendation copy — requires minimum tracked ads before a strong read. */

export const MIN_CHANNEL_ADS_FOR_RECOMMENDATION = 5;

export function channelHasEnoughEvidence(adCount: number): boolean {
  return adCount >= MIN_CHANNEL_ADS_FOR_RECOMMENDATION;
}

export function limitedChannelSignal(channel: string): string {
  return `Limited signal on ${channel} — not enough to recommend yet.`;
}

export type ChannelEvidence = {
  label: string;
  adCount: number;
};

/** Recommendation for a channel the client could test (competitor absent or light). */
export function recommendChannelOpportunity(channel: string, competitorAdCount: number): string {
  if (!channelHasEnoughEvidence(competitorAdCount)) {
    return limitedChannelSignal(channel);
  }
  return `${channel} has enough tracked activity (${competitorAdCount} ads) to treat as a real gap. Worth testing with a distinct message.`;
}

/** Read on where the competitor is spending attention. */
export function describeChannelConcentration(
  brand: string,
  channel: string,
  adCount: number,
  sharePct: number,
): string {
  if (!channelHasEnoughEvidence(adCount)) {
    return limitedChannelSignal(channel);
  }
  if (sharePct >= 60) {
    return `${brand} is leaning heavily on ${channel} (${Math.round(sharePct)}% of observed activity). That concentration is worth challenging in the pitch.`;
  }
  return `${brand} has meaningful activity on ${channel} (${adCount} ads tracked).`;
}

/** Next-move line for the pitch when total portfolio is thin. */
export function recommendNextMove(input: {
  brand: string;
  totalAds: number;
  missingChannel?: string | null;
  missingChannelAds?: number;
  primaryTheme?: string | null;
}): string {
  if (input.totalAds < MIN_CHANNEL_ADS_FOR_RECOMMENDATION) {
    return "Limited signal — treat these findings as directional only.";
  }
  if (input.missingChannel) {
    const count = input.missingChannelAds ?? 0;
    if (!channelHasEnoughEvidence(count)) {
      return limitedChannelSignal(input.missingChannel);
    }
    return `Test ${input.missingChannel} with a message ${input.brand} isn't running. They leave that channel open with ${count} ads worth of evidence elsewhere.`;
  }
  return `Lead the meeting with channel mix and one message angle from category intel.`;
}
