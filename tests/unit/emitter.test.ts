import { describe, it, expect, vi } from "vitest";
import { TypedEventEmitter } from "../../src/events/emitter";

type TestEvents = {
  foo: (value: string) => void;
  bar: (a: number, b: number) => void;
};

describe("TypedEventEmitter", () => {
  it("should emit to registered listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.on("foo", handler);

    emitter.emit("foo", "hello");

    expect(handler).toHaveBeenCalledWith("hello");
  });

  it("should support multiple listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on("foo", h1);
    emitter.on("foo", h2);

    emitter.emit("foo", "test");

    expect(h1).toHaveBeenCalledWith("test");
    expect(h2).toHaveBeenCalledWith("test");
  });

  it("should unsubscribe correctly", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const handler = vi.fn();
    const unsub = emitter.on("foo", handler);

    unsub();
    emitter.emit("foo", "test");

    expect(handler).not.toHaveBeenCalled();
  });

  it("should handle multiple arguments", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.on("bar", handler);

    emitter.emit("bar", 1, 2);

    expect(handler).toHaveBeenCalledWith(1, 2);
  });

  it("should not error when emitting with no listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(() => emitter.emit("foo", "test")).not.toThrow();
  });

  it("should remove all listeners for an event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const handler = vi.fn();
    emitter.on("foo", handler);
    emitter.removeAllListeners("foo");

    emitter.emit("foo", "test");
    expect(handler).not.toHaveBeenCalled();
  });

  it("should remove all listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const h1 = vi.fn();
    const h2 = vi.fn();
    emitter.on("foo", h1);
    emitter.on("bar", h2);
    emitter.removeAllListeners();

    emitter.emit("foo", "test");
    emitter.emit("bar", 1, 2);
    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  it("should report listener count", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(emitter.listenerCount("foo")).toBe(0);

    emitter.on("foo", vi.fn());
    expect(emitter.listenerCount("foo")).toBe(1);

    emitter.on("foo", vi.fn());
    expect(emitter.listenerCount("foo")).toBe(2);
  });
});
