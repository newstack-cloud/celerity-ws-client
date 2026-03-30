import type { ConnectionState } from "../types";

export type StateEvent =
  | "CONNECT"
  | "WS_OPEN"
  | "CAPABILITIES_DETERMINED_AUTH"
  | "CAPABILITIES_DETERMINED_NO_AUTH"
  | "AUTH_SUCCESS"
  | "AUTH_FAILURE"
  | "DISCONNECT"
  | "WS_UNEXPECTED_CLOSE"
  | "HEARTBEAT_TIMEOUT"
  | "RETRY"
  | "RETRY_EXHAUSTED"
  | "WS_CLOSED";

type TransitionMap = Record<ConnectionState, Partial<Record<StateEvent, ConnectionState>>>;

export const TRANSITIONS: TransitionMap = {
  disconnected: {
    CONNECT: "connecting",
  },
  connecting: {
    WS_OPEN: "handshaking",
    WS_UNEXPECTED_CLOSE: "reconnecting",
    DISCONNECT: "disconnecting",
  },
  handshaking: {
    CAPABILITIES_DETERMINED_AUTH: "authenticating",
    CAPABILITIES_DETERMINED_NO_AUTH: "ready",
    WS_UNEXPECTED_CLOSE: "reconnecting",
    DISCONNECT: "disconnecting",
  },
  authenticating: {
    AUTH_SUCCESS: "ready",
    AUTH_FAILURE: "disconnected",
    WS_UNEXPECTED_CLOSE: "reconnecting",
    DISCONNECT: "disconnecting",
  },
  ready: {
    DISCONNECT: "disconnecting",
    WS_UNEXPECTED_CLOSE: "reconnecting",
    HEARTBEAT_TIMEOUT: "reconnecting",
  },
  reconnecting: {
    RETRY: "connecting",
    RETRY_EXHAUSTED: "disconnected",
    DISCONNECT: "disconnected",
  },
  disconnecting: {
    WS_CLOSED: "disconnected",
  },
};
