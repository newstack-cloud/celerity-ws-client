import { WebSocketState } from "../interfaces";
import type { WebSocketLike } from "../interfaces";
import type { HeartbeatConfig, ServerCapabilities } from "../types";
import { BINARY_PREFIX } from "./constants";

export type HeartbeatCallbacks = {
  onTimeout: () => void;
  onPongReceived: () => void;
  onDebug: (event: string, detail: Record<string, unknown>) => void;
};

export class HeartbeatManager {
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private config: HeartbeatConfig;
  private callbacks: HeartbeatCallbacks;
  private ws: WebSocketLike | null = null;
  private effectiveFormat: "json" | "binary";

  constructor(config: HeartbeatConfig, callbacks: HeartbeatCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
    this.effectiveFormat = config.format;
  }

  start(ws: WebSocketLike, capabilities: ServerCapabilities): void {
    this.stop();
    this.ws = ws;
    this.effectiveFormat = capabilities.binary ? this.config.format : "json";

    this.pingTimer = setInterval(() => this.sendPing(), this.config.interval);
  }

  stop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.ws = null;
  }

  handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.callbacks.onPongReceived();
  }

  private sendPing(): void {
    if (!this.ws || this.ws.readyState() !== WebSocketState.OPEN) return;

    if (this.effectiveFormat === "binary") {
      this.ws.send(BINARY_PREFIX.PING);
    } else {
      this.ws.send(JSON.stringify({ ping: true }));
    }

    this.pongTimer = setTimeout(() => {
      this.callbacks.onDebug("heartbeat:timeout", { elapsed: this.config.timeout });
      this.callbacks.onTimeout();
    }, this.config.timeout);
  }
}
