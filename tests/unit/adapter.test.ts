import { describe, it, expect, vi } from "vitest";
import { WebSocketAdapter } from "../../src/transport/adapter";
import type { RawWebSocket } from "../../src/transport/adapter";
import { WebSocketState } from "../../src/interfaces";

function mockRaw(state: WebSocketState = WebSocketState.OPEN): RawWebSocket {
  return {
    readyState: state,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    send: vi.fn(),
    close: vi.fn(),
  };
}

describe("WebSocketAdapter", () => {
  it("should return readyState from raw socket", () => {
    const raw = mockRaw(WebSocketState.CONNECTING);
    const adapter = new WebSocketAdapter(raw);
    expect(adapter.readyState()).toBe(WebSocketState.CONNECTING);
  });

  it("should delegate send to raw socket", () => {
    const raw = mockRaw();
    const adapter = new WebSocketAdapter(raw);

    adapter.send("hello");
    adapter.send(new Uint8Array([1, 2]));

    expect(raw.send).toHaveBeenCalledTimes(2);
    expect(raw.send).toHaveBeenCalledWith("hello");
  });

  it("should delegate close to raw socket", () => {
    const raw = mockRaw();
    const adapter = new WebSocketAdapter(raw);

    adapter.close(1000, "bye");

    expect(raw.close).toHaveBeenCalledWith(1000, "bye");
  });

  describe("onopen", () => {
    it("should forward open event", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();

      adapter.onopen = handler;
      raw.onopen!({});

      expect(handler).toHaveBeenCalledOnce();
    });

    it("should clear raw handler when set to null", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);

      adapter.onopen = vi.fn();
      adapter.onopen = null;

      expect(raw.onopen).toBeNull();
    });
  });

  describe("onclose", () => {
    it("should normalize close event with all fields", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();

      adapter.onclose = handler;
      raw.onclose!({ code: 1001, reason: "going away", wasClean: true });

      expect(handler).toHaveBeenCalledWith({
        code: 1001,
        reason: "going away",
        wasClean: true,
      });
    });

    it("should provide defaults for missing close event fields", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();

      adapter.onclose = handler;
      raw.onclose!({});

      expect(handler).toHaveBeenCalledWith({
        code: 1006,
        reason: "",
        wasClean: false,
      });
    });
  });

  describe("onmessage", () => {
    it("should extract data from message event", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();

      adapter.onmessage = handler;
      raw.onmessage!({ data: "hello" });

      expect(handler).toHaveBeenCalledWith({ data: "hello" });
    });

    it("should handle binary data", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();
      const buf = new ArrayBuffer(4);

      adapter.onmessage = handler;
      raw.onmessage!({ data: buf });

      expect(handler).toHaveBeenCalledWith({ data: buf });
    });
  });

  describe("onerror", () => {
    it("should forward error event without payload", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();

      adapter.onerror = handler;
      raw.onerror!({ message: "fail" });

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("getter returns current handler", () => {
    it("should return the set handler from getter", () => {
      const raw = mockRaw();
      const adapter = new WebSocketAdapter(raw);
      const handler = vi.fn();

      adapter.onopen = handler;
      expect(adapter.onopen).toBe(handler);

      adapter.onopen = null;
      expect(adapter.onopen).toBeNull();
    });
  });
});
