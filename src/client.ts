import { WebSocketState } from "./interfaces";
import type {
  WebSocketCloseEvent,
  WebSocketFactory,
  WebSocketLike,
  WebSocketMessageEvent,
} from "./interfaces";
import { resolveConfig } from "./config";
import { TypedEventEmitter } from "./events/emitter";
import { MessageRouter } from "./events/router";
import { AckManager } from "./protocol/ack";
import { AuthManager } from "./protocol/auth";
import {
  decodeBinaryMessage,
  encodeBinaryMessage,
  extractBinaryControlPayload,
  identifyBinaryControl,
} from "./protocol/binary-codec";
import {
  isCapabilitiesSignal,
  FULL_CAPABILITIES,
  DEFAULT_CAPABILITIES,
} from "./protocol/capabilities";
import { CLOSE_CODES } from "./protocol/constants";
import { DeduplicationStore } from "./protocol/dedup";
import { HeartbeatManager } from "./protocol/heartbeat";
import { decodeJsonMessage, encodeJsonMessage, extractRoute } from "./protocol/json-codec";
import { getRecord, getString, parseJsonPayload } from "./protocol/parse";
import { MessageBuffer } from "./reconnect/buffer";
import { ReconnectManager } from "./reconnect/manager";
import { ConnectionStateMachine } from "./state/machine";
import type {
  AckResponse,
  BinaryMessageHandler,
  BufferedMessage,
  CelerityWsClientConfig,
  ConnectionState,
  LifecycleEventMap,
  MessageHandler,
  ResolvedConfig,
  SendOptions,
  ServerCapabilities,
  Unsubscribe,
} from "./types";
import { CelerityCapabilityError } from "./types";

const LIFECYCLE_EVENTS = new Set([
  "connected",
  "disconnected",
  "reconnecting",
  "authenticated",
  "authFailed",
  "error",
  "lostMessage",
  "messageDropped",
  "debug",
]);

/**
 * WebSocket client for the Celerity Runtime Protocol.
 *
 * Handles capabilities negotiation, authentication, heartbeat,
 * message acknowledgement, deduplication, and automatic reconnection.
 *
 * Use the createWsClient() factory from the package entry point
 * rather than constructing this class directly.
 */
export class CelerityWsClient {
  private config: ResolvedConfig;
  private stateMachine = new ConnectionStateMachine();
  private emitter = new TypedEventEmitter<LifecycleEventMap>();
  private router = new MessageRouter();
  private ws: WebSocketLike | null = null;
  private _capabilities: ServerCapabilities | undefined;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: HeartbeatManager;
  private authManager: AuthManager | null = null;
  private ackManager: AckManager;
  private dedupStore: DeduplicationStore;
  private reconnectManager: ReconnectManager;
  private buffer: MessageBuffer;
  private isReconnecting = false;
  private connectPromise: {
    resolve: () => void;
    reject: (err: Error) => void;
  } | null = null;
  private disconnectPromise: {
    resolve: () => void;
  } | null = null;

  constructor(config: CelerityWsClientConfig, defaultFactory: WebSocketFactory) {
    this.config = resolveConfig(config, defaultFactory);

    this.heartbeat = new HeartbeatManager(this.config.heartbeat, {
      onTimeout: () => this.handleHeartbeatTimeout(),
      onPongReceived: () => this.handlePongReceived(),
      onDebug: (event, detail) => this.debug(event, detail),
    });

    this.ackManager = new AckManager(this.config.ack, {
      onDebug: (event, detail) => this.debug(event, detail),
      isConnected: () => this.stateMachine.state === "ready",
      getWs: () => this.ws,
    });

    this.dedupStore = new DeduplicationStore(this.config.deduplication);

    this.reconnectManager = new ReconnectManager(this.config.reconnect, {
      onRetry: () => this.doConnect(),
      onGiveUp: (reason) => this.handleReconnectGiveUp(reason),
      onDebug: (event, detail) => this.debug(event, detail),
      onReconnecting: (attempt, delay) => {
        this.emitter.emit("reconnecting", { attempt, delay });
      },
    });

    this.buffer = new MessageBuffer(this.config.reconnect.bufferSize, {
      onOverflow: (dropped) => dropped.reject?.(new Error("Buffer full")),
      onDropped: (info) => this.emitter.emit("messageDropped", info),
      onFlush: (msg) => this.flushBufferedMessage(msg),
      onDebug: (event, detail) => this.debug(event, detail),
    });

    if (this.config.auth) {
      this.authManager = new AuthManager(this.config.auth, {
        onSuccess: (userInfo) => this.handleAuthSuccess(userInfo),
        onFailure: (error) => this.handleAuthFailure(error),
      });
    }
  }

  /**
   * Current connection lifecycle state.
   */
  get state(): ConnectionState {
    return this.stateMachine.state;
  }

  /**
   * Server capabilities determined during the handshake.
   * Undefined until the first connection completes the handshake phase.
   */
  get capabilities(): ServerCapabilities | undefined {
    return this._capabilities;
  }

  /**
   * Open the WebSocket connection and perform the handshake.
   * Resolves once the client reaches the "ready" state (capabilities
   * negotiated and authentication complete, if configured).
   */
  connect(): Promise<void> {
    if (this.stateMachine.state !== "disconnected") {
      return Promise.reject(new Error(`Cannot connect from state: ${this.stateMachine.state}`));
    }
    this.isReconnecting = false;
    this.dedupStore.start();
    return new Promise<void>((resolve, reject) => {
      this.connectPromise = { resolve, reject };
      this.doConnect();
    });
  }

  /**
   * Gracefully close the connection.
   * Cancels any pending reconnection and resolves once the
   * underlying WebSocket has closed.
   */
  disconnect(code?: number, reason?: string): Promise<void> {
    if (this.stateMachine.state === "disconnected") {
      return Promise.resolve();
    }

    this.reconnectManager.cancel();

    if (this.stateMachine.state === "reconnecting") {
      this.stateMachine.transition("DISCONNECT");
      this.buffer.clear("disconnected");
      this.cleanup();
      return Promise.resolve();
    }

    if (!this.stateMachine.canTransition("DISCONNECT")) {
      return Promise.resolve();
    }

    this.stateMachine.transition("DISCONNECT");

    return new Promise<void>((resolve) => {
      this.disconnectPromise = { resolve };
      this.ws?.close(code ?? 1000, reason ?? "client disconnect");
    });
  }

  /**
   * Immediately tear down all resources (timers, listeners, WebSocket).
   * Unlike disconnect(), this does not wait for a clean close and
   * cannot be followed by a reconnect.
   */
  destroy(): void {
    this.reconnectManager.cancel();
    this.heartbeat.stop();
    this.ackManager.clear();
    this.dedupStore.stop();
    this.buffer.clear("disconnected");
    this.clearTimers();

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      try {
        this.ws.close();
      } catch {
        // Ignore close errors during destroy
      }
      this.ws = null;
    }

    this.emitter.removeAllListeners();
    this.router.clear();
    this.stateMachine.reset();
  }

  /**
   * Send a JSON message. Returns the generated messageId.
   * During reconnection the message is buffered and sent once
   * the connection is re-established.
   */
  send(route: string, data: unknown, options?: SendOptions): string {
    const messageId = options?.messageId ?? this.config.messageId();
    const raw = encodeJsonMessage(this.config.routeKey, route, data, messageId, options?.ack);

    if (this.shouldBuffer()) {
      this.buffer.add({ type: "json", route, data, options: options ?? {}, messageId });
      return messageId;
    }

    this.requireConnection().send(raw);
    return messageId;
  }

  /**
   * Send a JSON message and wait for server acknowledgement.
   * Automatically retries up to ack.maxRetries times on timeout.
   */
  sendWithAck(route: string, data: unknown, options?: SendOptions): Promise<AckResponse> {
    const messageId = options?.messageId ?? this.config.messageId();
    const sendOpts = { ...options, messageId, ack: true };

    if (this.shouldBuffer()) {
      return new Promise<AckResponse>((resolve, reject) => {
        this.buffer.add({
          type: "json",
          route,
          data,
          options: sendOpts,
          messageId,
          resolve,
          reject,
        });
      });
    }

    const raw = encodeJsonMessage(this.config.routeKey, route, data, messageId, true);
    this.requireConnection().send(raw);

    return this.ackManager.track(messageId, () => {
      if (this.ws && this.ws.readyState() === WebSocketState.OPEN) {
        this.ws.send(raw);
      }
    });
  }

  /**
   * Send a binary message. Returns the generated messageId.
   * Throws CelerityCapabilityError if the server lacks binary support.
   */
  sendBinary(routeKey: string, payload: Uint8Array, options?: SendOptions): string {
    this.requireCapability("binary");
    const messageId = options?.messageId ?? this.config.messageId();
    const encoded = encodeBinaryMessage(routeKey, payload, messageId, options?.ack ?? false);

    if (this.shouldBuffer()) {
      this.buffer.add({
        type: "binary",
        route: routeKey,
        data: payload,
        options: options ?? {},
        messageId,
      });
      return messageId;
    }

    this.requireConnection().send(encoded);
    return messageId;
  }

  /**
   * Send a binary message and wait for server acknowledgement.
   * Throws CelerityCapabilityError if the server lacks binary support.
   */
  sendBinaryWithAck(
    routeKey: string,
    payload: Uint8Array,
    options?: SendOptions,
  ): Promise<AckResponse> {
    this.requireCapability("binary");
    const messageId = options?.messageId ?? this.config.messageId();
    const encoded = encodeBinaryMessage(routeKey, payload, messageId, true);

    if (this.shouldBuffer()) {
      return new Promise<AckResponse>((resolve, reject) => {
        this.buffer.add({
          type: "binary",
          route: routeKey,
          data: payload,
          options: { ...options, messageId, ack: true },
          messageId,
          resolve,
          reject,
        });
      });
    }

    this.requireConnection().send(encoded);

    return this.ackManager.track(messageId, () => {
      if (this.ws && this.ws.readyState() === WebSocketState.OPEN) {
        this.ws.send(encoded);
      }
    });
  }

  /**
   * Register a handler for a lifecycle event or a custom message route.
   * Lifecycle events (connected, disconnected, etc.) are dispatched by name.
   * All other event names are treated as message route keys.
   * Returns an unsubscribe function.
   */
  on(event: string, handler: MessageHandler | ((...args: never[]) => void)): Unsubscribe {
    if (this.isLifecycleEvent(event)) {
      return this.emitter.on(
        event as keyof LifecycleEventMap,
        handler as LifecycleEventMap[keyof LifecycleEventMap],
      );
    }
    return this.router.on(event, handler as MessageHandler);
  }

  /**
   * Register a handler for binary messages matching the given route key.
   * Returns an unsubscribe function.
   */
  onBinary(routeKey: string, handler: BinaryMessageHandler): Unsubscribe {
    return this.router.onBinary(routeKey, handler);
  }

  // Connection flow: doConnect → openWebSocket → handleOpen → capabilities → [auth] → handleReady
  private doConnect(): void {
    if (this.stateMachine.state === "disconnected" || this.stateMachine.state === "reconnecting") {
      this.stateMachine.transition(
        this.stateMachine.state === "disconnected" ? "CONNECT" : "RETRY",
      );
    }

    if (this.config.auth?.strategy === "connect" && this.authManager) {
      this.authManager
        .resolveConnectHeaders()
        .then((authHeaders) => {
          const headers = { ...this.config.headers, ...authHeaders };
          this.openWebSocket(this.config.url, headers);
        })
        .catch((err) => this.handleConnectError(err));
    } else {
      const headers = Object.keys(this.config.headers).length > 0 ? this.config.headers : undefined;
      this.openWebSocket(this.config.url, headers);
    }
  }

  private openWebSocket(url: string, headers?: Record<string, string>): void {
    try {
      const options = headers ? { headers } : undefined;
      this.ws = this.config.webSocketFactory.create(url, this.config.protocols, options);
    } catch (err) {
      this.handleConnectError(err);
      return;
    }

    this.connectionTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState() === WebSocketState.CONNECTING) {
        this.ws.close();
      }
    }, this.config.reconnect.connectionTimeout);

    this.ws.onopen = () => this.handleOpen();
    this.ws.onclose = (event) => this.handleClose(event);
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onerror = (error) => {
      this.emitter.emit("error", error);
    };
  }

  private handleConnectError(err: unknown): void {
    this.emitter.emit("error", err instanceof Error ? err : new Error(String(err)));
    if (this.isReconnecting) {
      this.handleUnexpectedClose(1006, "");
    } else {
      this.connectPromise?.reject(err instanceof Error ? err : new Error(String(err)));
      this.connectPromise = null;
      this.stateMachine.reset();
    }
  }

  private handleOpen(): void {
    this.clearTimer("connection");
    this.stateMachine.transition("WS_OPEN");
    this.emitter.emit("connected");

    this.handshakeTimer = setTimeout(() => {
      this.handleCapabilitiesTimeout();
    }, this.config.handshakeTimeout);
  }

  private handleCapabilitiesTimeout(): void {
    this.handshakeTimer = null;
    if (this._capabilities) return;

    this._capabilities = DEFAULT_CAPABILITIES;
    this.debug("capabilities:constrained", { timeout: this.config.handshakeTimeout });
    this.proceedAfterCapabilities();
  }

  private handleCapabilitiesSignal(): void {
    if (this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
    if (this.stateMachine.state !== "handshaking") return;

    this._capabilities = FULL_CAPABILITIES;
    this.debug("capabilities:full", { elapsed: 0 });
    this.proceedAfterCapabilities();
  }

  private proceedAfterCapabilities(): void {
    this.heartbeat.start(this.ws!, this._capabilities!);

    if (this.authManager) {
      this.stateMachine.transition("CAPABILITIES_DETERMINED_AUTH");
      this.authManager.sendAuthMessage(this.ws!, this.config.routeKey).catch((err) => {
        this.handleAuthFailure(err instanceof Error ? err : new Error(String(err)));
      });
    } else {
      this.stateMachine.transition("CAPABILITIES_DETERMINED_NO_AUTH");
      this.handleReady();
    }
  }

  private handleAuthSuccess(userInfo?: Record<string, unknown>): void {
    if (this.stateMachine.state !== "authenticating") return;
    this.stateMachine.transition("AUTH_SUCCESS");
    this.emitter.emit("authenticated", userInfo);
    this.handleReady();
  }

  private handleAuthFailure(error: Error): void {
    this.emitter.emit("authFailed", error);
    if (this.stateMachine.state === "authenticating") {
      this.stateMachine.transition("AUTH_FAILURE");
    }
    this.ws?.close(1000, "auth failed");
    this.connectPromise?.reject(error);
    this.connectPromise = null;
    this.cleanup();
  }

  private handleReady(): void {
    if (this.isReconnecting) {
      this.reconnectManager.notifyStableConnection();
    }

    this.connectPromise?.resolve();
    this.connectPromise = null;

    this.buffer.flush();
  }

  private handleClose(event: WebSocketCloseEvent): void {
    this.heartbeat.stop();
    this.clearTimers();

    const { code, reason, wasClean } = event;

    if (this.stateMachine.state === "disconnecting") {
      this.stateMachine.transition("WS_CLOSED");
      this.ackManager.clear();
      this.dedupStore.stop();
      this.emitter.emit("disconnected", {
        code,
        reason,
        wasClean,
        willReconnect: false,
      });
      this.disconnectPromise?.resolve();
      this.disconnectPromise = null;
      this.cleanup();
      return;
    }

    if (
      this.stateMachine.state === "authenticating" &&
      (code === CLOSE_CODES.UNAUTHORIZED || code === CLOSE_CODES.FORBIDDEN)
    ) {
      return;
    }

    this.handleUnexpectedClose(code, reason, wasClean);
  }

  private handleUnexpectedClose(code: number, reason: string, wasClean = false): void {
    const willReconnect = this.config.reconnect.enabled;

    if (willReconnect && this.stateMachine.canTransition("WS_UNEXPECTED_CLOSE")) {
      this.stateMachine.transition("WS_UNEXPECTED_CLOSE");
      this.isReconnecting = true;
      this.emitter.emit("disconnected", { code, reason, wasClean, willReconnect: true });
      this.reconnectManager.scheduleRetry(reason);
    } else {
      if (this.stateMachine.state !== "disconnected") {
        this.stateMachine.reset();
      }
      this.emitter.emit("disconnected", { code, reason, wasClean, willReconnect: false });
      this.connectPromise?.reject(new Error(`WebSocket closed: ${code} ${reason}`));
      this.connectPromise = null;
      this.buffer.clear("disconnected");
      this.ackManager.clear();
      this.dedupStore.stop();
      this.cleanup();
    }
  }

  private handleReconnectGiveUp(reason: string): void {
    this.isReconnecting = false;
    if (this.stateMachine.state === "reconnecting") {
      this.stateMachine.transition("RETRY_EXHAUSTED");
    }
    this.emitter.emit("disconnected", {
      code: 1006,
      reason: `Reconnect failed: ${reason}`,
      wasClean: false,
      willReconnect: false,
    });
    this.buffer.clear("disconnected");
    this.ackManager.clear();
    this.dedupStore.stop();
    this.cleanup();
  }

  private handleMessage(event: WebSocketMessageEvent): void {
    const rawData: string | ArrayBuffer | Uint8Array = event.data;

    if (this.handleBinaryMessage(rawData)) return;
    if (typeof rawData !== "string") return;

    this.handleTextMessage(rawData);
  }

  private handleBinaryMessage(data: string | ArrayBuffer | Uint8Array): boolean {
    let bytes: Uint8Array | null = null;

    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      bytes = data;
    } else if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
      bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else {
      return false;
    }

    if (isCapabilitiesSignal(bytes)) {
      this.handleCapabilitiesSignal();
      return true;
    }

    const controlType = identifyBinaryControl(bytes);
    if (controlType) {
      this.handleBinaryControl(controlType, bytes);
      return true;
    }

    const decoded = decodeBinaryMessage(bytes);
    if (!decoded) return true;

    if (this.dedupStore.has(decoded.messageId)) return true;
    this.dedupStore.track(decoded.messageId);

    const metadata = {
      messageId: decoded.messageId,
      route: decoded.routeKey,
      raw: bytes,
    };
    this.router.dispatchBinary(decoded.routeKey, decoded.payload, metadata);
    return true;
  }

  private handleBinaryControl(type: string, data: Uint8Array): void {
    if (type === "pong") {
      this.heartbeat.handlePong();
      return;
    }
    if (type === "ack") {
      const parsed = parseJsonPayload(extractBinaryControlPayload(data));
      const messageId = parsed ? getString(parsed, "messageId") : undefined;
      const timestamp = parsed ? getString(parsed, "timestamp") : undefined;
      if (messageId) {
        this.ackManager.handleAck(messageId, timestamp ?? new Date().toISOString());
      }
      return;
    }
    if (type === "lostMessage") {
      const parsed = parseJsonPayload(extractBinaryControlPayload(data));
      const messageId = parsed ? getString(parsed, "messageId") : undefined;
      if (messageId) {
        this.emitter.emit("lostMessage", {
          messageId,
          caller: (parsed ? getString(parsed, "caller") : undefined) ?? "",
        });
      }
    }
  }

  // Dispatches text messages: pong → control routes (auth, ack, lost) → application messages
  private handleTextMessage(raw: string): void {
    const decoded = decodeJsonMessage(raw);
    if (!decoded) return;
    const { parsed } = decoded;

    if (parsed.pong === true) {
      this.heartbeat.handlePong();
      return;
    }

    const route = extractRoute(parsed, this.config.routeKey) ?? extractRoute(parsed, "event");

    if (this.handleControlRoute(route, parsed)) return;
    if (!route) return;

    const messageId = decoded.messageId ?? "";
    if (this.dedupStore.has(messageId || undefined)) return;
    this.dedupStore.track(messageId || undefined);

    const metadata = { messageId, route, raw: parsed };
    this.router.dispatchJson(route, decoded.data, metadata);
  }

  private handleControlRoute(route: string | undefined, parsed: Record<string, unknown>): boolean {
    if (route === "authenticated" && this.stateMachine.state === "authenticating") {
      this.authManager?.handleAuthResponse(parsed);
      return true;
    }
    if (route === "ack") {
      this.handleJsonAck(parsed);
      return true;
    }
    if (route === "lostMessage") {
      this.handleJsonLostMessage(parsed);
      return true;
    }
    return false;
  }

  private handleJsonAck(parsed: Record<string, unknown>): void {
    const data = getRecord(parsed, "data");
    const messageId = data ? getString(data, "messageId") : undefined;
    if (messageId) {
      const timestamp =
        (data ? getString(data, "timestamp") : undefined) ?? new Date().toISOString();
      this.ackManager.handleAck(messageId, timestamp);
    }
  }

  private handleJsonLostMessage(parsed: Record<string, unknown>): void {
    const data = getRecord(parsed, "data");
    const messageId = data ? getString(data, "messageId") : undefined;
    if (messageId) {
      this.emitter.emit("lostMessage", {
        messageId,
        caller: (data ? getString(data, "caller") : undefined) ?? "",
      });
    }
  }

  private handleHeartbeatTimeout(): void {
    if (this.stateMachine.canTransition("HEARTBEAT_TIMEOUT")) {
      this.heartbeat.stop();
      this.stateMachine.transition("HEARTBEAT_TIMEOUT");
      this.isReconnecting = true;
      this.emitter.emit("disconnected", {
        code: 1006,
        reason: "heartbeat timeout",
        wasClean: false,
        willReconnect: this.config.reconnect.enabled,
      });
      if (this.ws) {
        this.ws.onclose = null;
        try {
          this.ws.close();
        } catch {
          /* ignore */
        }
        this.ws = null;
      }
      this.reconnectManager.scheduleRetry();
    }
  }

  private handlePongReceived(): void {
    this.reconnectManager.handleHeartbeatSuccess();
  }

  private shouldBuffer(): boolean {
    if (!this.isReconnecting) return false;
    const s = this.stateMachine.state;
    return (
      s === "reconnecting" || s === "connecting" || s === "handshaking" || s === "authenticating"
    );
  }

  private flushBufferedMessage(msg: BufferedMessage): void {
    if (msg.type === "json") {
      if (msg.resolve && msg.reject) {
        this.sendWithAck(msg.route, msg.data, msg.options).then(msg.resolve, msg.reject);
      } else {
        this.send(msg.route, msg.data, msg.options);
      }
    } else {
      const payload = msg.data as Uint8Array;
      if (msg.resolve && msg.reject) {
        this.sendBinaryWithAck(msg.route, payload, msg.options).then(msg.resolve, msg.reject);
      } else {
        this.sendBinary(msg.route, payload, msg.options);
      }
    }
  }

  private requireConnection(): WebSocketLike {
    if (!this.ws) {
      throw new Error("WebSocket not connected");
    }
    return this.ws;
  }

  private requireCapability(capability: keyof ServerCapabilities): void {
    if (!this._capabilities || !this._capabilities[capability]) {
      throw new CelerityCapabilityError(capability);
    }
  }

  private isLifecycleEvent(event: string): boolean {
    return LIFECYCLE_EVENTS.has(event);
  }

  private debug(event: string, detail: Record<string, unknown>): void {
    if (this.emitter.listenerCount("debug") > 0) {
      this.emitter.emit("debug", { event, detail });
    }
  }

  private clearTimers(): void {
    this.clearTimer("handshake");
    this.clearTimer("connection");
  }

  private clearTimer(type: "handshake" | "connection"): void {
    if (type === "handshake" && this.handshakeTimer) {
      clearTimeout(this.handshakeTimer);
      this.handshakeTimer = null;
    }
    if (type === "connection" && this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  private cleanup(): void {
    this.ws = null;
  }
}
