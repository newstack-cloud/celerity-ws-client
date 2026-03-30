import type { WebSocketConnectOptions, WebSocketFactory, WebSocketLike } from "../interfaces";
import type { RawWebSocket } from "./adapter";
import { WebSocketAdapter } from "./adapter";

/**
 * WebSocket factory for Node.js that wraps the `ws` library.
 * Handles CJS/ESM interop and forwards custom headers
 * (auth, user-provided) to the upgrade request.
 */
export class NodeWebSocketFactory implements WebSocketFactory {
  private WsConstructor: typeof import("ws").default;

  constructor(WsModule: typeof import("ws")) {
    // CJS/ESM interop: ws may export the constructor as .default (ESM) or directly (CJS)
    this.WsConstructor = WsModule.default ?? (WsModule as unknown as typeof import("ws").default);
  }

  create(url: string, protocols?: string[], options?: WebSocketConnectOptions): WebSocketLike {
    const wsOptions = options?.headers ? { headers: options.headers } : undefined;
    const ws = new this.WsConstructor(url, protocols ?? [], wsOptions);
    return new WebSocketAdapter(ws as unknown as RawWebSocket);
  }
}
