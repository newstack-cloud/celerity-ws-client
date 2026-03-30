import type {
  WebSocketCloseEvent,
  WebSocketLike,
  WebSocketMessageEvent,
  WebSocketState,
} from "../interfaces";
import { isRecord } from "../protocol/parse";

/**
 * The common shape that both browser WebSocket and the Node.js `ws`
 * library satisfy. WebSocketAdapter wraps a RawWebSocket and
 * normalizes the platform-specific event objects into the
 * consistent types that the client expects.
 */
export type RawWebSocket = {
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onmessage: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string | ArrayBuffer | Uint8Array): void;
  close(code?: number, reason?: string): void;
};

function toError(event: unknown): Error {
  if (event instanceof Error) return event;

  if (isRecord(event) && typeof event.message === "string") {
    return new Error(event.message);
  }

  return new Error("WebSocket error");
}

export class WebSocketAdapter implements WebSocketLike {
  private _onopen: (() => void) | null = null;
  private _onclose: ((event: WebSocketCloseEvent) => void) | null = null;
  private _onmessage: ((event: WebSocketMessageEvent) => void) | null = null;
  private _onerror: ((error: Error) => void) | null = null;

  constructor(private readonly raw: RawWebSocket) {}

  readyState(): WebSocketState {
    return this.raw.readyState as WebSocketState;
  }

  get onopen(): (() => void) | null {
    return this._onopen;
  }

  set onopen(handler: (() => void) | null) {
    this._onopen = handler;
    this.raw.onopen = handler ? () => handler() : null;
  }

  get onclose(): ((event: WebSocketCloseEvent) => void) | null {
    return this._onclose;
  }

  set onclose(handler: ((event: WebSocketCloseEvent) => void) | null) {
    this._onclose = handler;
    this.raw.onclose = handler
      ? (event: unknown) => {
          const evtRecord = isRecord(event) ? event : {};
          handler({
            code: typeof evtRecord.code === "number" ? evtRecord.code : 1006,
            reason: typeof evtRecord.reason === "string" ? evtRecord.reason : "",
            wasClean: typeof evtRecord.wasClean === "boolean" ? evtRecord.wasClean : false,
          });
        }
      : null;
  }

  get onmessage(): ((event: WebSocketMessageEvent) => void) | null {
    return this._onmessage;
  }

  set onmessage(handler: ((event: WebSocketMessageEvent) => void) | null) {
    this._onmessage = handler;
    this.raw.onmessage = handler
      ? (event: unknown) => {
          const data = isRecord(event) ? event.data : event;
          handler({ data: data as string | ArrayBuffer | Uint8Array });
        }
      : null;
  }

  get onerror(): ((error: Error) => void) | null {
    return this._onerror;
  }

  set onerror(handler: ((error: Error) => void) | null) {
    this._onerror = handler;
    this.raw.onerror = handler
      ? (event: unknown) => {
          handler(toError(event));
        }
      : null;
  }

  send(data: string | ArrayBuffer | Uint8Array): void {
    this.raw.send(data);
  }

  close(code?: number, reason?: string): void {
    this.raw.close(code, reason);
  }
}
