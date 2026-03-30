import { WebSocketState } from "../../src/interfaces";
import type {
  WebSocketCloseEvent,
  WebSocketConnectOptions,
  WebSocketFactory,
  WebSocketLike,
  WebSocketMessageEvent,
} from "../../src/interfaces";

export class MockWebSocket implements WebSocketLike {
  private _readyState: number = WebSocketState.CONNECTING;

  onopen: (() => void) | null = null;
  onclose: ((event: WebSocketCloseEvent) => void) | null = null;
  onmessage: ((event: WebSocketMessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;

  sentMessages: (string | ArrayBuffer | Uint8Array)[] = [];
  closeCode?: number;
  closeReason?: string;

  readyState(): WebSocketState {
    return this._readyState as WebSocketState;
  }

  send(data: string | ArrayBuffer | Uint8Array): void {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closeCode = code;
    this.closeReason = reason;
    this._readyState = WebSocketState.CLOSING;
    setTimeout(() => {
      this._readyState = WebSocketState.CLOSED;
      this.onclose?.({ code: code ?? 1000, reason: reason ?? "", wasClean: true });
    }, 0);
  }

  simulateOpen(): void {
    this._readyState = WebSocketState.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: string | ArrayBuffer | Uint8Array): void {
    this.onmessage?.({ data });
  }

  simulateClose(code = 1000, reason = "", wasClean = true): void {
    this._readyState = WebSocketState.CLOSED;
    this.onclose?.({ code, reason, wasClean });
  }

  simulateError(): void {
    this.onerror?.();
  }
}

export class MockWebSocketFactory implements WebSocketFactory {
  instances: MockWebSocket[] = [];
  lastOptions?: WebSocketConnectOptions;

  create(_url: string, _protocols?: string[], options?: WebSocketConnectOptions): WebSocketLike {
    this.lastOptions = options;
    const ws = new MockWebSocket();
    this.instances.push(ws);
    return ws;
  }

  get latest(): MockWebSocket {
    return this.instances[this.instances.length - 1];
  }
}
