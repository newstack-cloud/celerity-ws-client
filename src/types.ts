/**
 * Possible states of the client's connection lifecycle.
 * Transitions are enforced by an internal state machine.
 */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "handshaking"
  | "authenticating"
  | "ready"
  | "reconnecting"
  | "disconnecting";

/**
 * Protocol capabilities negotiated during the handshake.
 * When the server sends a binary capabilities signal within the handshake timeout,
 * full capabilities are granted. Otherwise the client falls back to constrained mode.
 */
export type ServerCapabilities = {
  binary: boolean;
  customCloseCodes: boolean;
  ackFormat: "binary" | "json";
};

export type AuthStrategy = "authMessage" | "connect";

/**
 * Authentication via an in-band message sent after the WebSocket opens.
 * Works with all server implementations regardless of capabilities.
 */
export type AuthMessageConfig = {
  strategy: "authMessage";
  token: string | (() => Promise<string>);
};

/**
 * Authentication via HTTP headers on the WebSocket upgrade request.
 * Requires the server to support custom close codes (full capabilities).
 * In browsers, omit the token to rely on cookie-based auth.
 */
export type ConnectAuthConfig = {
  strategy: "connect";
  /**
   * Required for Node.js clients.
   * Omit for browser clients (cookie-based).
   */
  token?: string | (() => Promise<string>);
  /**
   * HTTP header name for the token.
   * Defaults to "Authorization".
   */
  headerName?: string;
  /**
   * Prefix prepended to the token value.
   * Defaults to "Bearer". Set to null for no prefix.
   */
  headerPrefix?: string | null;
};

export type AuthConfig = AuthMessageConfig | ConnectAuthConfig;

export type HeartbeatConfig = {
  /**
   * Milliseconds between client-initiated pings.
   * Default: 10000.
   */
  interval: number;
  /**
   * Milliseconds to wait for a pong before triggering reconnection.
   * Default: 5000.
   */
  timeout: number;
  /**
   * Automatically downgraded to "json" when the server lacks binary capabilities.
   * Default: "json".
   */
  format: "json" | "binary";
};

export type ReconnectConfig = {
  enabled: boolean;
  maxRetries: number;
  /**
   * Starting delay in ms for the first retry.
   * Grows by backoffFactor each attempt.
   * Default: 1000.
   */
  baseDelay: number;
  /**
   * Multiplier applied to baseDelay on each successive retry.
   * Default: 1.5.
   */
  backoffFactor: number;
  /**
   * Upper bound in ms for the computed backoff delay.
   * Default: 30000.
   */
  maxDelay: number;
  /**
   * Total elapsed ms before giving up entirely.
   * 0 means unlimited.
   * Default: 300000.
   */
  maxElapsedTime: number;
  /**
   * Per-attempt timeout in ms for the WebSocket connection to open.
   * Default: 10000.
   */
  connectionTimeout: number;
  /**
   * Max outgoing messages to queue while reconnecting.
   * Oldest are dropped on overflow.
   * Default: 100.
   */
  bufferSize: number;
  /**
   * Random delay in ms added before the first connection to spread
   * load across clients connecting simultaneously.
   * Default: 5000.
   */
  initialSpread: number;
};

export type AckConfig = {
  /**
   * Milliseconds to wait for the server to acknowledge a message before retrying.
   * Default: 10000.
   */
  timeout: number;
  /**
   * Number of times to re-send an unacknowledged message before rejecting.
   * Default: 3.
   */
  maxRetries: number;
};

export type DeduplicationConfig = {
  enabled: boolean;
  /**
   * Milliseconds to remember a messageId before allowing it again.
   * Default: 300000.
   */
  ttl: number;
  /**
   * Maximum tracked messageIds.
   * Oldest are evicted when exceeded.
   * Default: 10000.
   */
  maxEntries: number;
};

/**
 * Function that returns a unique string for each outgoing message.
 * The default implementation uses crypto.randomUUID().
 */
export type MessageIdGenerator = () => string;

/**
 * Configuration for creating a CelerityWsClient.
 * All fields except `url` are optional and fall back to sensible defaults.
 */
export type CelerityWsClientConfig = {
  /**
   * WebSocket server URL (ws:// or wss://).
   */
  url: string;
  auth?: AuthConfig;
  /**
   * JSON property name used to identify the message route.
   * Default: "event".
   */
  routeKey?: string;
  heartbeat?: Partial<HeartbeatConfig>;
  reconnect?: Partial<ReconnectConfig>;
  ack?: Partial<AckConfig>;
  deduplication?: Partial<DeduplicationConfig>;
  /**
   * Milliseconds to wait for the server capabilities signal
   * before falling back to constrained mode.
   * Default: 2000.
   */
  handshakeTimeout?: number;
  /**
   * Strategy for generating outgoing message IDs.
   * Defaults to crypto.randomUUID().
   */
  messageId?: "uuid" | MessageIdGenerator;
  /**
   * WebSocket sub-protocols passed during the upgrade handshake.
   */
  protocols?: string[];
  /**
   * Custom headers to include on the WebSocket upgrade request.
   * Node.js only; ignored in browsers.
   */
  headers?: Record<string, string>;
  /**
   * Override the default WebSocket factory.
   * Useful for testing or custom transports.
   */
  WebSocket?: import("./interfaces").WebSocketFactory;
};

/**
 * Fully resolved configuration with all defaults applied.
 * Produced internally by resolveConfig() and used throughout the client.
 */
export type ResolvedConfig = {
  url: string;
  auth?: AuthConfig;
  routeKey: string;
  heartbeat: HeartbeatConfig;
  reconnect: ReconnectConfig;
  ack: AckConfig;
  deduplication: DeduplicationConfig;
  handshakeTimeout: number;
  messageId: MessageIdGenerator;
  protocols: string[];
  headers: Record<string, string>;
  webSocketFactory: import("./interfaces").WebSocketFactory;
};

/**
 * Options for individual send() and sendBinary() calls.
 */
export type SendOptions = {
  /**
   * Override the auto-generated message ID for this message.
   */
  messageId?: string;
  /**
   * Request server acknowledgement for this message.
   * Automatically set to true when using sendWithAck/sendBinaryWithAck.
   */
  ack?: boolean;
};

/**
 * Acknowledgement response returned by sendWithAck() and sendBinaryWithAck().
 */
export type AckResponse = {
  messageId: string;
  timestamp: string;
};

/**
 * Information provided with the "disconnected" lifecycle event.
 */
export type DisconnectInfo = {
  code: number;
  reason: string;
  wasClean: boolean;
  /**
   * True if the client will attempt to reconnect automatically.
   */
  willReconnect: boolean;
};

/**
 * Information provided with the "lostMessage" lifecycle event.
 * Emitted when the server reports that a message could not be delivered.
 */
export type LostMessageInfo = {
  messageId: string;
  caller: string;
};

/**
 * Metadata passed alongside every message to route handlers.
 */
export type MessageMetadata = {
  messageId: string;
  route: string;
  /**
   * The original parsed message object (JSON) or raw binary data.
   */
  raw: unknown;
};

/**
 * Handler for JSON messages dispatched by route.
 */
export type MessageHandler = (data: unknown, metadata: MessageMetadata) => void;

/**
 * Handler for binary messages dispatched by route key.
 */
export type BinaryMessageHandler = (payload: Uint8Array, metadata: MessageMetadata) => void;

/**
 * Callable that removes a previously registered event or message handler.
 */
export type Unsubscribe = () => void;

/**
 * Structured debug event emitted when a "debug" listener is registered.
 * No-op overhead when no listener is attached.
 */
export type DebugEvent = {
  event: string;
  detail: Record<string, unknown>;
};

/**
 * Information provided with the "messageDropped" lifecycle event.
 * Emitted when a buffered outgoing message is discarded.
 */
export type MessageDroppedInfo = {
  messageId: string;
  route: string;
  reason: "bufferFull" | "disconnected";
};

/**
 * Internal representation of a message queued during reconnection.
 */
export type BufferedMessage = {
  type: "json" | "binary";
  route: string;
  data: unknown | Uint8Array;
  options: SendOptions;
  messageId: string;
  resolve?: (value: AckResponse) => void;
  reject?: (reason: unknown) => void;
};

/**
 * Maps lifecycle event names to their handler signatures.
 * Used to type the client's on() method for lifecycle events.
 */
export type LifecycleEventMap = {
  connected: () => void;
  disconnected: (info: DisconnectInfo) => void;
  reconnecting: (info: { attempt: number; delay: number }) => void;
  authenticated: (userInfo?: Record<string, unknown>) => void;
  authFailed: (error: Error) => void;
  error: (error: Error) => void;
  lostMessage: (info: LostMessageInfo) => void;
  messageDropped: (info: MessageDroppedInfo) => void;
  debug: (event: DebugEvent) => void;
};

/**
 * Thrown when calling sendBinary() or sendBinaryWithAck() and the
 * server has not advertised the required capability.
 */
export class CelerityCapabilityError extends Error {
  constructor(public readonly capability: string) {
    super(`Server does not support capability: ${capability}`);
    this.name = "CelerityCapabilityError";
  }
}
