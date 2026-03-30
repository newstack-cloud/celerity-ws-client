import { CelerityWsClient } from "./client";
import { BrowserWebSocketFactory } from "./transport/browser-factory";
import type { CelerityWsClientConfig } from "./types";

/**
 * Create a WebSocket client for browser environments.
 * Uses globalThis.WebSocket unless a custom WebSocket
 * factory is provided via config.WebSocket.
 */
export async function createWsClient(config: CelerityWsClientConfig): Promise<CelerityWsClient> {
  const factory = config.WebSocket ?? new BrowserWebSocketFactory();
  return new CelerityWsClient({ ...config, WebSocket: factory }, factory);
}

export { CelerityWsClient } from "./client";
export { BrowserWebSocketFactory } from "./transport/browser-factory";
export { NodeWebSocketFactory } from "./transport/node-factory";
export { CelerityCapabilityError } from "./types";
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
