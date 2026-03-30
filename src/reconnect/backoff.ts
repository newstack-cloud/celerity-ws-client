import type { ReconnectConfig } from "../types";

export function calculateBackoff(attempt: number, config: ReconnectConfig): number {
  const backoff = Math.min(
    config.maxDelay,
    config.baseDelay * Math.pow(config.backoffFactor, attempt),
  );
  return Math.random() * backoff;
}

export function parseRetryAfter(reason: string): number | null {
  try {
    const parsed = JSON.parse(reason) as Record<string, unknown>;
    if (typeof parsed.retryAfter === "number" && parsed.retryAfter > 0) {
      return parsed.retryAfter;
    }
  } catch {
    // Not JSON or no retryAfter
  }
  return null;
}
