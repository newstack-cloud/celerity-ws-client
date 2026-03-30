import { describe, it, expect, vi } from "vitest";
import { MessageBuffer, type BufferCallbacks } from "../../src/reconnect/buffer";
import type { BufferedMessage } from "../../src/types";

function makeMsg(id: string, overrides?: Partial<BufferedMessage>): BufferedMessage {
  return {
    type: "json",
    route: "test.route",
    data: { id },
    options: {},
    messageId: id,
    ...overrides,
  };
}

function makeCallbacks(overrides?: Partial<BufferCallbacks>): BufferCallbacks {
  return {
    onOverflow: vi.fn(),
    onDropped: vi.fn(),
    onFlush: vi.fn(),
    onDebug: vi.fn(),
    ...overrides,
  };
}

describe("MessageBuffer", () => {
  it("should add and track messages", () => {
    const buffer = new MessageBuffer(10, makeCallbacks());

    buffer.add(makeMsg("msg-1"));
    buffer.add(makeMsg("msg-2"));

    expect(buffer.length).toBe(2);
  });

  it("should flush messages in FIFO order", () => {
    const flushed: string[] = [];
    const callbacks = makeCallbacks({
      onFlush: (msg) => flushed.push(msg.messageId),
    });
    const buffer = new MessageBuffer(10, callbacks);

    buffer.add(makeMsg("msg-1"));
    buffer.add(makeMsg("msg-2"));
    buffer.add(makeMsg("msg-3"));
    buffer.flush();

    expect(flushed).toEqual(["msg-1", "msg-2", "msg-3"]);
    expect(buffer.length).toBe(0);
  });

  it("should reject individual messages when onFlush throws", () => {
    const reject = vi.fn();
    const flushed: string[] = [];
    const callbacks = makeCallbacks({
      onFlush: (msg) => {
        flushed.push(msg.messageId);
        if (msg.messageId === "msg-2") throw new Error("send failed");
      },
    });
    const buffer = new MessageBuffer(10, callbacks);

    buffer.add(makeMsg("msg-1"));
    buffer.add(makeMsg("msg-2", { reject }));
    buffer.add(makeMsg("msg-3"));
    buffer.flush();

    expect(reject).toHaveBeenCalledWith(new Error("send failed"));
    expect(flushed).toEqual(["msg-1", "msg-2", "msg-3"]);
  });

  it("should evict the oldest message on overflow", () => {
    const callbacks = makeCallbacks();
    const buffer = new MessageBuffer(2, callbacks);

    buffer.add(makeMsg("msg-1"));
    buffer.add(makeMsg("msg-2"));
    buffer.add(makeMsg("msg-3"));

    expect(buffer.length).toBe(2);
    expect(callbacks.onOverflow).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: "msg-1" }),
    );
    expect(callbacks.onDropped).toHaveBeenCalledWith({
      messageId: "msg-1",
      route: "test.route",
      reason: "bufferFull",
    });
    expect(callbacks.onDebug).toHaveBeenCalledWith("buffer:full", {
      messageId: "msg-1",
      bufferSize: 2,
    });
  });

  it("should reject the evicted message's ack promise on overflow", () => {
    const reject = vi.fn();
    const callbacks = makeCallbacks({
      onOverflow: (dropped) => dropped.reject?.(new Error("Buffer full")),
    });
    const buffer = new MessageBuffer(1, callbacks);

    buffer.add(makeMsg("msg-1", { reject }));
    buffer.add(makeMsg("msg-2"));

    expect(reject).toHaveBeenCalledWith(new Error("Buffer full"));
  });

  it("should clear all messages and reject pending ack promises", () => {
    const reject1 = vi.fn();
    const reject2 = vi.fn();
    const callbacks = makeCallbacks();
    const buffer = new MessageBuffer(10, callbacks);

    buffer.add(makeMsg("msg-1", { reject: reject1 }));
    buffer.add(makeMsg("msg-2", { reject: reject2 }));
    buffer.add(makeMsg("msg-3"));
    buffer.clear("disconnected");

    expect(buffer.length).toBe(0);
    expect(reject1).toHaveBeenCalledWith(new Error("Disconnected"));
    expect(reject2).toHaveBeenCalledWith(new Error("Disconnected"));
    expect(callbacks.onDropped).toHaveBeenCalledTimes(3);
    expect(callbacks.onDropped).toHaveBeenCalledWith({
      messageId: "msg-1",
      route: "test.route",
      reason: "disconnected",
    });
  });

  it("should not invoke callbacks when clearing an empty buffer", () => {
    const callbacks = makeCallbacks();
    const buffer = new MessageBuffer(10, callbacks);

    buffer.clear("disconnected");

    expect(callbacks.onDropped).not.toHaveBeenCalled();
  });

  it("should be empty after flush", () => {
    const callbacks = makeCallbacks();
    const buffer = new MessageBuffer(10, callbacks);

    buffer.add(makeMsg("msg-1"));
    buffer.flush();
    buffer.flush();

    expect(callbacks.onFlush).toHaveBeenCalledTimes(1);
  });
});
