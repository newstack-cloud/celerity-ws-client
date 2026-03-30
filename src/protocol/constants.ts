export const BINARY_PREFIX = {
  PING: new Uint8Array([0x1, 0x1, 0x0, 0x0]),
  PONG: new Uint8Array([0x1, 0x2, 0x0, 0x0]),
  LOST_MESSAGE: new Uint8Array([0x1, 0x3, 0x0, 0x0]),
  ACK: new Uint8Array([0x1, 0x4, 0x0, 0x0]),
  CAPABILITIES: new Uint8Array([0x1, 0x5, 0x0, 0x0]),
} as const;

export const BINARY_PREFIX_LENGTH = 4;

export const DEFAULT_ROUTE_KEY = "event";

export const DEFAULT_HEARTBEAT = {
  interval: 10_000,
  timeout: 5_000,
  format: "json" as const,
};

export const DEFAULT_RECONNECT = {
  enabled: true,
  maxRetries: 100,
  baseDelay: 1_000,
  backoffFactor: 1.5,
  maxDelay: 30_000,
  maxElapsedTime: 300_000,
  connectionTimeout: 10_000,
  bufferSize: 100,
  initialSpread: 5_000,
};

export const DEFAULT_ACK = {
  timeout: 10_000,
  maxRetries: 3,
};

export const DEFAULT_DEDUPLICATION = {
  enabled: true,
  ttl: 300_000,
  maxEntries: 10_000,
};

export const DEFAULT_HANDSHAKE_TIMEOUT = 2_000;

export const CLOSE_CODES = {
  UNAUTHORIZED: 4001,
  FORBIDDEN: 4002,
} as const;
