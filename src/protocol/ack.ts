import type { WebSocketLike } from "../interfaces";
import type { AckConfig, AckResponse } from "../types";

type PendingAck = {
  messageId: string;
  attempt: number;
  timer: ReturnType<typeof setTimeout>;
  resolve: (value: AckResponse) => void;
  reject: (reason: unknown) => void;
  resend: () => void;
};

export type AckCallbacks = {
  onDebug: (event: string, detail: Record<string, unknown>) => void;
  isConnected: () => boolean;
  getWs: () => WebSocketLike | null;
};

export class AckManager {
  private pending = new Map<string, PendingAck>();
  private config: AckConfig;
  private callbacks: AckCallbacks;

  constructor(config: AckConfig, callbacks: AckCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  track(messageId: string, resend: () => void): Promise<AckResponse> {
    return new Promise<AckResponse>((resolve, reject) => {
      const entry: PendingAck = {
        messageId,
        attempt: 0,
        timer: this.startTimer(messageId),
        resolve,
        reject,
        resend,
      };
      this.pending.set(messageId, entry);
    });
  }

  handleAck(messageId: string, timestamp: string): void {
    const entry = this.pending.get(messageId);
    if (!entry) return;

    clearTimeout(entry.timer);
    this.pending.delete(messageId);
    entry.resolve({ messageId, timestamp });
  }

  clear(): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Connection closed"));
    }
    this.pending.clear();
  }

  get size(): number {
    return this.pending.size;
  }

  private startTimer(messageId: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => this.handleTimeout(messageId), this.config.timeout);
  }

  private handleTimeout(messageId: string): void {
    const entry = this.pending.get(messageId);
    if (!entry) return;

    entry.attempt++;
    this.callbacks.onDebug("ack:timeout", {
      messageId,
      attempt: entry.attempt,
    });

    if (entry.attempt >= this.config.maxRetries) {
      this.callbacks.onDebug("ack:giveUp", {
        messageId,
        attempts: entry.attempt,
      });
      this.pending.delete(messageId);
      entry.reject(
        new Error(`Ack timeout after ${entry.attempt} attempts for message ${messageId}`),
      );
      return;
    }

    if (this.callbacks.isConnected()) {
      entry.resend();
    }
    entry.timer = this.startTimer(messageId);
  }
}
