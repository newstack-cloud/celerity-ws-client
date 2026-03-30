import type { WebSocketConnectOptions, WebSocketFactory, WebSocketLike } from "../interfaces";
import type { RawWebSocket } from "./adapter";
import { WebSocketAdapter } from "./adapter";

/**
 * WebSocket factory for browser environments.
 * Wraps globalThis.WebSocket and sets binaryType to "arraybuffer"
 * for consistent binary message handling.
 */
export class BrowserWebSocketFactory implements WebSocketFactory {
  create(url: string, protocols?: string[], _options?: WebSocketConnectOptions): WebSocketLike {
    const ws = new globalThis.WebSocket(url, protocols);
    ws.binaryType = "arraybuffer";
    // Browser WebSocket handler signatures differ from RawWebSocket — single boundary cast
    return new WebSocketAdapter(ws as unknown as RawWebSocket);
  }
}
