/**
 * Numeric ready-state constants matching the WebSocket spec.
 * Used instead of the native WebSocket.CONNECTING etc. so the
 * client code works identically with any WebSocketLike implementation.
 */
export const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

export type WebSocketState = (typeof WebSocketState)[keyof typeof WebSocketState];

export type WebSocketCloseEvent = {
  code: number;
  reason: string;
  wasClean: boolean;
};

export type WebSocketMessageEvent = {
  data: string | ArrayBuffer | Uint8Array;
};

/**
 * Minimal WebSocket surface that the client operates against.
 * Both the browser WebSocket and the `ws` Node.js library are
 * adapted to this interface via WebSocketAdapter.
 */
export interface WebSocketLike {
  readyState(): WebSocketState;
  onopen: (() => void) | null;
  onclose: ((event: WebSocketCloseEvent) => void) | null;
  onmessage: ((event: WebSocketMessageEvent) => void) | null;
  onerror: ((error: Error) => void) | null;
  send(data: string | ArrayBuffer | Uint8Array): void;
  close(code?: number, reason?: string): void;
}

/**
 * Options forwarded to the underlying WebSocket constructor.
 * Only the `ws` Node.js library supports custom headers on the
 * upgrade request; browsers silently ignore them.
 */
export type WebSocketConnectOptions = {
  headers?: Record<string, string>;
};

/**
 * Creates WebSocketLike instances. The client calls create() each
 * time it needs a new connection (initial connect and every reconnect).
 * Implement this interface to provide a custom WebSocket transport.
 */
export interface WebSocketFactory {
  create(url: string, protocols?: string[], options?: WebSocketConnectOptions): WebSocketLike;
}
