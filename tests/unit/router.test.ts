import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../../src/events/router";
import type { MessageMetadata } from "../../src/types";

const meta: MessageMetadata = { messageId: "1", route: "test", raw: {} };

describe("MessageRouter", () => {
  it("should dispatch JSON messages to registered handlers", () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    router.on("chat", handler);

    const dispatched = router.dispatchJson("chat", { text: "hello" }, meta);

    expect(dispatched).toBe(true);
    expect(handler).toHaveBeenCalledWith({ text: "hello" }, meta);
  });

  it("should dispatch binary messages to registered handlers", () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    router.onBinary("stream", handler);

    const payload = new Uint8Array([1, 2, 3]);
    const dispatched = router.dispatchBinary("stream", payload, meta);

    expect(dispatched).toBe(true);
    expect(handler).toHaveBeenCalledWith(payload, meta);
  });

  it("should return false when no handlers registered", () => {
    const router = new MessageRouter();
    expect(router.dispatchJson("chat", {}, meta)).toBe(false);
    expect(router.dispatchBinary("stream", new Uint8Array(), meta)).toBe(false);
  });

  it("should support multiple handlers for the same route", () => {
    const router = new MessageRouter();
    const h1 = vi.fn();
    const h2 = vi.fn();
    router.on("chat", h1);
    router.on("chat", h2);

    router.dispatchJson("chat", "data", meta);

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("should unsubscribe handlers", () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    const unsub = router.on("chat", handler);

    unsub();

    expect(router.dispatchJson("chat", {}, meta)).toBe(false);
  });

  it("should unsubscribe binary handlers", () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    const unsub = router.onBinary("stream", handler);

    unsub();

    expect(router.dispatchBinary("stream", new Uint8Array(), meta)).toBe(false);
  });

  it("should clear all handlers", () => {
    const router = new MessageRouter();
    router.on("a", vi.fn());
    router.onBinary("b", vi.fn());

    router.clear();

    expect(router.dispatchJson("a", {}, meta)).toBe(false);
    expect(router.dispatchBinary("b", new Uint8Array(), meta)).toBe(false);
  });
});
