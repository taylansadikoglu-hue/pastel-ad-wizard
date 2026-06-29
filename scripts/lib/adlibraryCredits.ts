export class CreditTracker {
  used = 0;
  remaining: number | null = null;
  requests = 0;
  errors: string[] = [];

  readonly maxRequests: number;
  readonly maxEnrichments: number;
  readonly maxWinnersScans: number;

  constructor() {
    this.maxRequests = envInt("MAX_ADLIBRARY_REQUESTS_PER_RUN", 1000);
    this.maxEnrichments = envInt("MAX_ADLIBRARY_ENRICHMENTS_PER_RUN", 200);
    this.maxWinnersScans = envInt("MAX_WINNERS_SCANS_PER_RUN", 3);
  }

  record(credits: number, remaining?: number | null): void {
    this.used += credits;
    if (remaining != null && Number.isFinite(remaining)) {
      this.remaining = remaining;
    }
    this.requests += 1;
  }

  canSpend(estimatedCredits: number): boolean {
    if (this.requests + 1 > this.maxRequests) {
      this.errors.push(
        `Request cap reached (${this.maxRequests}). Stop before spending ${estimatedCredits} more credits.`,
      );
      return false;
    }
    if (this.used + estimatedCredits > this.maxRequests) {
      this.errors.push(
        `Estimated credits (${this.used + estimatedCredits}) exceed MAX_ADLIBRARY_REQUESTS_PER_RUN (${this.maxRequests}).`,
      );
      return false;
    }
    return true;
  }

  summary(): Record<string, unknown> {
    return {
      creditsUsed: this.used,
      creditsRemaining: this.remaining,
      requests: this.requests,
      maxRequests: this.maxRequests,
      errors: this.errors,
    };
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
