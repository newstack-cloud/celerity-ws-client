import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HeartbeatManager } from "../../src/protocol/heartbeat";
import type { HeartbeatCallbacks } from "../../src/protocol/heartbeat";
import { WebSocketState } from "../../src/interfaces";
import type {
  WebSocketLike,
  WebSocketMessageEvent,
  WebSocketCloseEvent,
} from "../../src/interfaces";
import type { ServerCapabilities } from "../../src/types";
import { BINARY_PREFIX } from "../../src/protocol/constants";

function mockWs(state: number = WebSocketState.OPEN): WebSocketLike {
  return {
    readyState: vi.fn().mockReturnValue(state),
    onopen: null,
    onclose: null as ((event: WebSocketCloseEvent) => void) | null,
    onmessage: null as ((event: WebSocketMessageEvent) => void) | null,
    onerror: null,
    send: vi.fn(),
    close: vi.fn(),
  };
}

const FULL_CAPS: ServerCapabilities = { binary: true, customCloseCodes: true, ackFormat: "binary" };
const CONSTRAINED_CAPS: ServerCapabilities = {
  binary: false,
  customCloseCodes: false,
  ackFormat: "json",
};

function mockCallbacks(): HeartbeatCallbacks {
  return { onTimeout: vi.fn(), onPongReceived: vi.fn(), onDebug: vi.fn() };
}

describe("HeartbeatManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should send binary ping when server supports binary", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "binary" }, cb);
    const ws = mockWs();

    hb.start(ws, FULL_CAPS);
    vi.advanceTimersByTime(1000);

    expect(ws.send).toHaveBeenCalledWith(BINARY_PREFIX.PING);
  });

  it("should send JSON ping when server is constrained", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "binary" }, cb);
    const ws = mockWs();

    hb.start(ws, CONSTRAINED_CAPS);
    vi.advanceTimersByTime(1000);

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ ping: true }));
  });

  it("should send JSON ping when configured for JSON regardless of capabilities", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "json" }, cb);
    const ws = mockWs();

    hb.start(ws, FULL_CAPS);
    vi.advanceTimersByTime(1000);

    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ ping: true }));
  });

  it("should call onTimeout if pong not received within timeout", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "json" }, cb);
    const ws = mockWs();

    hb.start(ws, FULL_CAPS);
    vi.advanceTimersByTime(1000); // triggers ping
    vi.advanceTimersByTime(500); // triggers timeout

    expect(cb.onTimeout).toHaveBeenCalledOnce();
    expect(cb.onDebug).toHaveBeenCalledWith("heartbeat:timeout", { elapsed: 500 });
  });

  it("should cancel timeout on pong", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "json" }, cb);
    const ws = mockWs();

    hb.start(ws, FULL_CAPS);
    vi.advanceTimersByTime(1000); // triggers ping
    hb.handlePong();
    vi.advanceTimersByTime(500); // timeout should NOT fire

    expect(cb.onTimeout).not.toHaveBeenCalled();
    expect(cb.onPongReceived).toHaveBeenCalledOnce();
  });

  it("should not send ping if ws is not open", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "json" }, cb);
    const ws = mockWs(WebSocketState.CONNECTING);

    hb.start(ws, FULL_CAPS);
    vi.advanceTimersByTime(1000);

    expect(ws.send).not.toHaveBeenCalled();
  });

  it("should stop all timers on stop()", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "json" }, cb);
    const ws = mockWs();

    hb.start(ws, FULL_CAPS);
    hb.stop();

    vi.advanceTimersByTime(2000);

    expect(ws.send).not.toHaveBeenCalled();
    expect(cb.onTimeout).not.toHaveBeenCalled();
  });

  it("should stop previous heartbeat when start is called again", () => {
    const cb = mockCallbacks();
    const hb = new HeartbeatManager({ interval: 1000, timeout: 500, format: "json" }, cb);
    const ws1 = mockWs();
    const ws2 = mockWs();

    hb.start(ws1, FULL_CAPS);
    hb.start(ws2, FULL_CAPS);

    vi.advanceTimersByTime(1000);

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledOnce();
  });
});
