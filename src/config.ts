import type { WebSocketFactory } from "./interfaces";
import type { CelerityWsClientConfig, ResolvedConfig } from "./types";
import {
  DEFAULT_ACK,
  DEFAULT_DEDUPLICATION,
  DEFAULT_HANDSHAKE_TIMEOUT,
  DEFAULT_HEARTBEAT,
  DEFAULT_RECONNECT,
  DEFAULT_ROUTE_KEY,
} from "./protocol/constants";

export function resolveConfig(
  config: CelerityWsClientConfig,
  defaultFactory: WebSocketFactory,
): ResolvedConfig {
  if (!config.url) {
    throw new Error("url is required");
  }

  if (config.auth?.strategy === "authMessage" && !config.auth.token) {
    throw new Error("auth.token is required for authMessage strategy");
  }

  const messageIdFn =
    typeof config.messageId === "function" ? config.messageId : () => crypto.randomUUID();

  return {
    url: config.url,
    auth: config.auth,
    routeKey: config.routeKey ?? DEFAULT_ROUTE_KEY,
    heartbeat: {
      ...DEFAULT_HEARTBEAT,
      ...config.heartbeat,
    },
    reconnect: {
      ...DEFAULT_RECONNECT,
      ...config.reconnect,
    },
    ack: {
      ...DEFAULT_ACK,
      ...config.ack,
    },
    deduplication: {
      ...DEFAULT_DEDUPLICATION,
      ...config.deduplication,
    },
    handshakeTimeout: config.handshakeTimeout ?? DEFAULT_HANDSHAKE_TIMEOUT,
    messageId: messageIdFn,
    protocols: config.protocols ?? [],
    headers: config.headers ?? {},
    webSocketFactory: config.WebSocket ?? defaultFactory,
  };
}
