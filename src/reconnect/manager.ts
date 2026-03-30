import type { ReconnectConfig } from "../types";
import { calculateBackoff, parseRetryAfter } from "./backoff";

export type ReconnectCallbacks = {
  onRetry: () => void;
  onGiveUp: (reason: string) => void;
  onDebug: (event: string, detail: Record<string, unknown>) => void;
  onReconnecting: (attempt: number, delay: number) => void;
};

export class ReconnectManager {
  private config: ReconnectConfig;
  private callbacks: ReconnectCallbacks;
  private attempt = 0;
  private firstRetryTimestamp: number | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _stabilityResetPending = false;

  constructor(config: ReconnectConfig, callbacks: ReconnectCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  scheduleRetry(closeReason?: string): void {
    if (!this.config.enabled) {
      this.callbacks.onGiveUp("reconnect disabled");
      return;
    }

    if (this.attempt >= this.config.maxRetries) {
      this.callbacks.onDebug("reconnect:giveUp", {
        attempts: this.attempt,
        elapsed: this.getElapsed(),
        reason: "maxRetries",
      });
      this.callbacks.onGiveUp("maxRetries");
      return;
    }

    if (this.firstRetryTimestamp === null) {
      this.firstRetryTimestamp = Date.now();
    }

    if (this.config.maxElapsedTime > 0 && this.getElapsed() > this.config.maxElapsedTime) {
      this.callbacks.onDebug("reconnect:giveUp", {
        attempts: this.attempt,
        elapsed: this.getElapsed(),
        reason: "maxElapsedTime",
      });
      this.callbacks.onGiveUp("maxElapsedTime");
      return;
    }

    let delay = calculateBackoff(this.attempt, this.config);

    if (this.attempt === 0 && this.config.initialSpread > 0) {
      delay += Math.random() * this.config.initialSpread;
    }

    const serverRetryAfter = closeReason ? parseRetryAfter(closeReason) : null;
    if (serverRetryAfter !== null) {
      const jitter = Math.random() * 1000;
      delay = Math.max(serverRetryAfter + jitter, delay);
      this.callbacks.onDebug("reconnect:serverBackoff", {
        retryAfter: serverRetryAfter,
        finalDelay: delay,
      });
    }

    this.callbacks.onDebug("reconnect:backoff", {
      attempt: this.attempt,
      delay,
    });

    this.callbacks.onReconnecting(this.attempt, delay);

    this.retryTimer = setTimeout(() => {
      this.callbacks.onDebug("reconnect:attempt", {
        attempt: this.attempt,
        delay,
        elapsed: this.getElapsed(),
      });
      this.attempt++;
      this.callbacks.onRetry();
    }, delay);
  }

  notifyStableConnection(): void {
    this._stabilityResetPending = true;
  }

  handleHeartbeatSuccess(): void {
    if (this._stabilityResetPending) {
      this.reset();
    }
  }

  cancel(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  reset(): void {
    this.cancel();
    this.attempt = 0;
    this.firstRetryTimestamp = null;
    this._stabilityResetPending = false;
  }

  get currentAttempt(): number {
    return this.attempt;
  }

  private getElapsed(): number {
    if (this.firstRetryTimestamp === null) return 0;
    return Date.now() - this.firstRetryTimestamp;
  }
}
