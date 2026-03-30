import type { DeduplicationConfig } from "../types";

type DedupEntry = {
  messageId: string;
  expiresAt: number;
};

export class DeduplicationStore {
  private entries = new Map<string, DedupEntry>();
  private config: DeduplicationConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: DeduplicationConfig) {
    this.config = config;
  }

  start(): void {
    if (!this.config.enabled) return;

    this.cleanupTimer = setInterval(() => this.evictExpired(), Math.min(this.config.ttl, 60_000));
  }

  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }

  /**
   * Check whether a messageId has already been seen within the TTL window.
   */
  has(messageId: string | undefined): boolean {
    if (!this.config.enabled || !messageId) return false;

    const existing = this.entries.get(messageId);
    return existing !== undefined && existing.expiresAt > Date.now();
  }

  /**
   * Record a messageId so that future has() calls return true until
   * the entry expires or is evicted.
   */
  track(messageId: string | undefined): void {
    if (!this.config.enabled || !messageId) return;

    this.entries.set(messageId, {
      messageId,
      expiresAt: Date.now() + this.config.ttl,
    });

    this.evictIfOverCapacity();
  }

  get size(): number {
    return this.entries.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private evictIfOverCapacity(): void {
    if (this.entries.size <= this.config.maxEntries) return;

    const iterator = this.entries.keys();
    const oldest = iterator.next().value;
    if (oldest !== undefined) {
      this.entries.delete(oldest);
    }
  }
}
