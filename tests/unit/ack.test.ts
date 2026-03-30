import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AckManager } from "../../src/protocol/ack";
import type { AckCallbacks } from "../../src/protocol/ack";

function mockCallbacks(): AckCallbacks {
  return {
    onDebug: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    getWs: vi.fn().mockReturnValue(null),
  };
}

describe("AckManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve promise when ack received", async () => {
    const cb = mockCallbacks();
    const mgr = new AckManager({ timeout: 1000, maxRetries: 3 }, cb);
    const resend = vi.fn();

    const promise = mgr.track("msg-1", resend);
    mgr.handleAck("msg-1", "2026-01-01T00:00:00Z");

    const result = await promise;
    expect(result).toEqual({ messageId: "msg-1", timestamp: "2026-01-01T00:00:00Z" });
    expect(mgr.size).toBe(0);
  });

  it("should ignore ack for unknown message", () => {
    const cb = mockCallbacks();
    const mgr = new AckManager({ timeout: 1000, maxRetries: 3 }, cb);

    mgr.handleAck("unknown", "ts");
    expect(mgr.size).toBe(0);
  });

  it("should retry on timeout when connected", () => {
    const cb = mockCallbacks();
    const mgr = new AckManager({ timeout: 500, maxRetries: 3 }, cb);
    const resend = vi.fn();

    mgr.track("msg-1", resend);
    vi.advanceTimersByTime(500);

    expect(resend).toHaveBeenCalledOnce();
    expect(cb.onDebug).toHaveBeenCalledWith("ack:timeout", { messageId: "msg-1", attempt: 1 });
  });

  it("should not resend when disconnected", () => {
    const cb = mockCallbacks();
    cb.isConnected = vi.fn().mockReturnValue(false);
    const mgr = new AckManager({ timeout: 500, maxRetries: 3 }, cb);
    const resend = vi.fn();

    mgr.track("msg-1", resend);
    vi.advanceTimersByTime(500);

    expect(resend).not.toHaveBeenCalled();
  });

  it("should reject after maxRetries", async () => {
    const cb = mockCallbacks();
    const mgr = new AckManager({ timeout: 100, maxRetries: 2 }, cb);
    const resend = vi.fn();

    const promise = mgr.track("msg-1", resend);

    vi.advanceTimersByTime(100); // attempt 1
    vi.advanceTimersByTime(100); // attempt 2 — give up

    await expect(promise).rejects.toThrow("Ack timeout after 2 attempts for message msg-1");
    expect(cb.onDebug).toHaveBeenCalledWith("ack:giveUp", {
      messageId: "msg-1",
      attempts: 2,
    });
    expect(mgr.size).toBe(0);
  });

  it("should clear all pending and reject them", async () => {
    const cb = mockCallbacks();
    const mgr = new AckManager({ timeout: 5000, maxRetries: 3 }, cb);

    const p1 = mgr.track("a", vi.fn());
    const p2 = mgr.track("b", vi.fn());

    expect(mgr.size).toBe(2);
    mgr.clear();

    await expect(p1).rejects.toThrow("Connection closed");
    await expect(p2).rejects.toThrow("Connection closed");
    expect(mgr.size).toBe(0);
  });

  it("should report size correctly", () => {
    const cb = mockCallbacks();
    const mgr = new AckManager({ timeout: 5000, maxRetries: 3 }, cb);

    mgr.track("a", vi.fn());
    mgr.track("b", vi.fn());

    expect(mgr.size).toBe(2);
  });
});
