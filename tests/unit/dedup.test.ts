import { describe, it, expect, vi, afterEach } from "vitest";
import { DeduplicationStore } from "../../src/protocol/dedup";

describe("DeduplicationStore", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should track and detect duplicates", () => {
    const store = new DeduplicationStore({ enabled: true, ttl: 60_000, maxEntries: 100 });

    expect(store.has("msg-1")).toBe(false);
    store.track("msg-1");
    expect(store.has("msg-1")).toBe(true);
    expect(store.has("msg-2")).toBe(false);
  });

  it("should skip when disabled", () => {
    const store = new DeduplicationStore({ enabled: false, ttl: 60_000, maxEntries: 100 });

    store.track("msg-1");
    expect(store.has("msg-1")).toBe(false);
  });

  it("should skip when messageId is undefined", () => {
    const store = new DeduplicationStore({ enabled: true, ttl: 60_000, maxEntries: 100 });

    store.track(undefined);
    expect(store.has(undefined)).toBe(false);
  });

  it("should respect TTL", () => {
    vi.useFakeTimers();
    const store = new DeduplicationStore({ enabled: true, ttl: 1000, maxEntries: 100 });

    store.track("msg-1");
    expect(store.has("msg-1")).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(store.has("msg-1")).toBe(false);

    vi.useRealTimers();
  });

  it("should evict oldest when over capacity", () => {
    const store = new DeduplicationStore({ enabled: true, ttl: 60_000, maxEntries: 2 });

    store.track("msg-1");
    store.track("msg-2");
    // Adding msg-3 evicts msg-1 (oldest)
    store.track("msg-3");

    expect(store.size).toBe(2);
    // msg-1 was evicted, so it should not be detected
    expect(store.has("msg-1")).toBe(false);
    // msg-3 is still in the store
    expect(store.has("msg-3")).toBe(true);
  });

  it("should clear on stop", () => {
    const store = new DeduplicationStore({ enabled: true, ttl: 60_000, maxEntries: 100 });
    store.start();
    store.track("msg-1");
    store.stop();
    expect(store.size).toBe(0);
  });
});
