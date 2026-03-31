import { CelerityWsClient } from "./client";
import { NodeWebSocketFactory } from "./transport/node-factory";
import type { CelerityWsClientConfig } from "./types";

/**
 * Create a WebSocket client for Node.js environments.
 * Dynamically imports the `ws` library unless a custom WebSocket
 * factory is provided via config.WebSocket.
 */
export async function createWsClient(config: CelerityWsClientConfig): Promise<CelerityWsClient> {
  if (config.WebSocket) {
    return new CelerityWsClient(config, config.WebSocket);
  }
  const ws = await import("ws");
  const factory = new NodeWebSocketFactory(ws);
  return new CelerityWsClient({ ...config, WebSocket: factory }, factory);
}

export { CelerityWsClient } from "./client";
export { NodeWebSocketFactory } from "./transport/node-factory";
export { BrowserWebSocketFactory } from "./transport/browser-factory";
export { CelerityCapabilityError } from "./types";
export { WILDCARD_ROUTE } from "./events/router";
export type {
  AckConfig,
  AckResponse,
  AuthConfig,
  AuthMessageConfig,
  AuthStrategy,
  ConnectAuthConfig,
  BinaryMessageHandler,
  BufferedMessage,
  CelerityWsClientConfig,
  ConnectionState,
  DeduplicationConfig,
  DebugEvent,
  DisconnectInfo,
  HeartbeatConfig,
  LifecycleEventMap,
  LostMessageInfo,
  MessageDroppedInfo,
  MessageHandler,
  MessageIdGenerator,
  MessageMetadata,
  ReconnectConfig,
  ResolvedConfig,
  SendOptions,
  ServerCapabilities,
  Unsubscribe,
} from "./types";
export { WebSocketState } from "./interfaces";
export type {
  WebSocketCloseEvent,
  WebSocketConnectOptions,
  WebSocketFactory,
  WebSocketLike,
  WebSocketMessageEvent,
} from "./interfaces";
