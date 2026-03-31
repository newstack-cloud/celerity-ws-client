import { describe, it, expect, vi } from "vitest";
import { MessageRouter, WILDCARD_ROUTE } from "../../src/events/router";
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

  describe("wildcard route", () => {
    it("should dispatch JSON messages to wildcard handlers regardless of route", () => {
      const router = new MessageRouter();
      const wildcard = vi.fn();
      router.on(WILDCARD_ROUTE, wildcard);

      router.dispatchJson("chat", { text: "hello" }, meta);
      router.dispatchJson("notifications", { id: 1 }, meta);

      expect(wildcard).toHaveBeenCalledTimes(2);
      expect(wildcard).toHaveBeenNthCalledWith(1, { text: "hello" }, meta);
      expect(wildcard).toHaveBeenNthCalledWith(2, { id: 1 }, meta);
    });

    it("should dispatch binary messages to wildcard handlers regardless of route", () => {
      const router = new MessageRouter();
      const wildcard = vi.fn();
      router.onBinary(WILDCARD_ROUTE, wildcard);

      const p1 = new Uint8Array([1, 2]);
      const p2 = new Uint8Array([3, 4]);
      router.dispatchBinary("audio", p1, meta);
      router.dispatchBinary("video", p2, meta);

      expect(wildcard).toHaveBeenCalledTimes(2);
      expect(wildcard).toHaveBeenNthCalledWith(1, p1, meta);
      expect(wildcard).toHaveBeenNthCalledWith(2, p2, meta);
    });

    it("should invoke both route-specific and wildcard handlers", () => {
      const router = new MessageRouter();
      const specific = vi.fn();
      const wildcard = vi.fn();
      router.on("chat", specific);
      router.on(WILDCARD_ROUTE, wildcard);

      const dispatched = router.dispatchJson("chat", "data", meta);

      expect(dispatched).toBe(true);
      expect(specific).toHaveBeenCalledOnce();
      expect(wildcard).toHaveBeenCalledOnce();
      expect(specific).toHaveBeenCalledWith("data", meta);
      expect(wildcard).toHaveBeenCalledWith("data", meta);
    });

    it("should return true when only wildcard handlers exist", () => {
      const router = new MessageRouter();
      router.on(WILDCARD_ROUTE, vi.fn());

      expect(router.dispatchJson("any-route", {}, meta)).toBe(true);
    });

    it("should unsubscribe wildcard handlers independently", () => {
      const router = new MessageRouter();
      const wildcard = vi.fn();
      const unsub = router.on(WILDCARD_ROUTE, wildcard);

      unsub();

      expect(router.dispatchJson("chat", {}, meta)).toBe(false);
    });

    it("should not dispatch to wildcard after clear", () => {
      const router = new MessageRouter();
      router.on(WILDCARD_ROUTE, vi.fn());
      router.onBinary(WILDCARD_ROUTE, vi.fn());

      router.clear();

      expect(router.dispatchJson("a", {}, meta)).toBe(false);
      expect(router.dispatchBinary("b", new Uint8Array(), meta)).toBe(false);
    });
  });
});
