import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReconnectManager } from "../../src/reconnect/manager";
import type { ReconnectCallbacks } from "../../src/reconnect/manager";
import type { ReconnectConfig } from "../../src/types";

const BASE_CONFIG: ReconnectConfig = {
  enabled: true,
  maxRetries: 5,
  baseDelay: 1000,
  backoffFactor: 1.5,
  maxDelay: 30_000,
  maxElapsedTime: 300_000,
  connectionTimeout: 10_000,
  bufferSize: 100,
  initialSpread: 0,
};

function mockCallbacks(): ReconnectCallbacks {
  return {
    onRetry: vi.fn(),
    onGiveUp: vi.fn(),
    onDebug: vi.fn(),
    onReconnecting: vi.fn(),
  };
}

describe("ReconnectManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("should schedule retry with backoff delay", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager(BASE_CONFIG, cb);

    mgr.scheduleRetry();

    expect(cb.onReconnecting).toHaveBeenCalledWith(0, 500);
    expect(cb.onRetry).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);

    expect(cb.onRetry).toHaveBeenCalledOnce();
    expect(mgr.currentAttempt).toBe(1);
  });

  it("should give up when reconnect is disabled", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager({ ...BASE_CONFIG, enabled: false }, cb);

    mgr.scheduleRetry();

    expect(cb.onGiveUp).toHaveBeenCalledWith("reconnect disabled");
    expect(cb.onRetry).not.toHaveBeenCalled();
  });

  it("should give up after maxRetries", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager({ ...BASE_CONFIG, maxRetries: 2 }, cb);

    mgr.scheduleRetry();
    vi.advanceTimersByTime(10_000);
    mgr.scheduleRetry();
    vi.advanceTimersByTime(10_000);
    mgr.scheduleRetry();

    expect(cb.onGiveUp).toHaveBeenCalledWith("maxRetries");
  });

  it("should give up after maxElapsedTime", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager({ ...BASE_CONFIG, maxElapsedTime: 1000 }, cb);

    mgr.scheduleRetry(); // sets firstRetryTimestamp
    vi.advanceTimersByTime(1500); // trigger retry
    mgr.scheduleRetry(); // elapsed > 1000

    expect(cb.onGiveUp).toHaveBeenCalledWith("maxElapsedTime");
  });

  it("should add initial spread on first attempt", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager({ ...BASE_CONFIG, initialSpread: 5000 }, cb);

    mgr.scheduleRetry();

    // backoff = random(0.5) * 1000 = 500, spread = random(0.5) * 5000 = 2500
    expect(cb.onReconnecting).toHaveBeenCalledWith(0, 3000);
  });

  it("should not add initial spread on subsequent attempts", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager({ ...BASE_CONFIG, initialSpread: 5000 }, cb);

    mgr.scheduleRetry();
    vi.advanceTimersByTime(10_000);
    mgr.scheduleRetry();

    // attempt 1: backoff = random(0.5) * 1500 = 750, no spread
    expect(cb.onReconnecting).toHaveBeenLastCalledWith(1, 750);
  });

  it("should respect server retryAfter", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager(BASE_CONFIG, cb);

    mgr.scheduleRetry('{"retryAfter":10000}');

    // backoff = 500, retryAfter + jitter = 10000 + 500 = 10500, max(10500, 500) = 10500
    expect(cb.onReconnecting).toHaveBeenCalledWith(0, 10500);
  });

  it("should cancel pending retry", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager(BASE_CONFIG, cb);

    mgr.scheduleRetry();
    mgr.cancel();

    vi.advanceTimersByTime(10_000);

    expect(cb.onRetry).not.toHaveBeenCalled();
  });

  it("should reset attempt counter and timestamps", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager(BASE_CONFIG, cb);

    mgr.scheduleRetry();
    vi.advanceTimersByTime(10_000);

    expect(mgr.currentAttempt).toBe(1);

    mgr.reset();

    expect(mgr.currentAttempt).toBe(0);
  });

  it("should reset on heartbeat success after stable connection notification", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager(BASE_CONFIG, cb);

    mgr.scheduleRetry();
    vi.advanceTimersByTime(10_000);

    expect(mgr.currentAttempt).toBe(1);

    mgr.notifyStableConnection();
    mgr.handleHeartbeatSuccess();

    expect(mgr.currentAttempt).toBe(0);
  });

  it("should not reset on heartbeat success without stable notification", () => {
    const cb = mockCallbacks();
    const mgr = new ReconnectManager(BASE_CONFIG, cb);

    mgr.scheduleRetry();
    vi.advanceTimersByTime(10_000);

    mgr.handleHeartbeatSuccess();

    expect(mgr.currentAttempt).toBe(1);
  });
});
