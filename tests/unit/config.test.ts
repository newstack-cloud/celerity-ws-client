import { describe, it, expect } from "vitest";
import { resolveConfig } from "../../src/config";
import { MockWebSocketFactory } from "../helpers/mock-ws";

describe("resolveConfig", () => {
  const factory = new MockWebSocketFactory();

  it("should resolve with defaults", () => {
    const config = resolveConfig({ url: "wss://example.com/ws" }, factory);

    expect(config.url).toBe("wss://example.com/ws");
    expect(config.routeKey).toBe("event");
    expect(config.heartbeat.interval).toBe(10_000);
    expect(config.heartbeat.timeout).toBe(5_000);
    expect(config.reconnect.enabled).toBe(true);
    expect(config.reconnect.baseDelay).toBe(1_000);
    expect(config.reconnect.backoffFactor).toBe(1.5);
    expect(config.reconnect.maxDelay).toBe(30_000);
    expect(config.ack.timeout).toBe(10_000);
    expect(config.ack.maxRetries).toBe(3);
    expect(config.deduplication.enabled).toBe(true);
    expect(config.deduplication.ttl).toBe(300_000);
    expect(config.deduplication.maxEntries).toBe(10_000);
    expect(config.handshakeTimeout).toBe(2_000);
    expect(config.protocols).toEqual([]);
    expect(config.webSocketFactory).toBe(factory);
  });

  it("should override specific settings", () => {
    const config = resolveConfig(
      {
        url: "wss://example.com/ws",
        routeKey: "action",
        heartbeat: { interval: 5_000 },
        reconnect: { maxRetries: 5 },
      },
      factory,
    );

    expect(config.routeKey).toBe("action");
    expect(config.heartbeat.interval).toBe(5_000);
    expect(config.heartbeat.timeout).toBe(5_000);
    expect(config.reconnect.maxRetries).toBe(5);
    expect(config.reconnect.baseDelay).toBe(1_000);
  });

  it("should throw if url is missing", () => {
    expect(() => resolveConfig({ url: "" }, factory)).toThrow("url is required");
  });

  it("should accept a custom messageId generator", () => {
    let counter = 0;
    const config = resolveConfig(
      { url: "wss://example.com/ws", messageId: () => `custom-${++counter}` },
      factory,
    );

    expect(config.messageId()).toBe("custom-1");
    expect(config.messageId()).toBe("custom-2");
  });

  it("should use provided WebSocket factory", () => {
    const customFactory = new MockWebSocketFactory();
    const config = resolveConfig(
      { url: "wss://example.com/ws", WebSocket: customFactory },
      factory,
    );

    expect(config.webSocketFactory).toBe(customFactory);
  });
});
