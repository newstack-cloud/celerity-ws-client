import type { BufferedMessage, MessageDroppedInfo } from "../types";

export type BufferCallbacks = {
  onOverflow: (dropped: BufferedMessage) => void;
  onDropped: (info: MessageDroppedInfo) => void;
  onFlush: (msg: BufferedMessage) => void;
  onDebug: (event: string, detail: Record<string, unknown>) => void;
};

/**
 * Bounded FIFO buffer for outgoing messages queued during reconnection.
 * When the buffer is full, the oldest message is evicted to make room.
 */
export class MessageBuffer {
  private messages: BufferedMessage[] = [];

  constructor(
    private readonly maxSize: number,
    private readonly callbacks: BufferCallbacks,
  ) {}

  get length(): number {
    return this.messages.length;
  }

  /**
   * Add a message to the buffer.
   * If the buffer is at capacity, the oldest message is dropped
   * and the onOverflow/onDropped callbacks are invoked.
   */
  add(msg: BufferedMessage): void {
    if (this.messages.length >= this.maxSize) {
      const dropped = this.messages.shift();
      if (dropped) {
        this.callbacks.onDebug("buffer:full", {
          messageId: dropped.messageId,
          bufferSize: this.maxSize,
        });
        this.callbacks.onDropped({
          messageId: dropped.messageId,
          route: dropped.route,
          reason: "bufferFull",
        });
        this.callbacks.onOverflow(dropped);
      }
    }
    this.messages.push(msg);
  }

  /**
   * Send all buffered messages via the onFlush callback
   * and clear the buffer. Rejects individual messages on error.
   */
  flush(): void {
    const pending = this.messages.splice(0);
    for (const msg of pending) {
      try {
        this.callbacks.onFlush(msg);
      } catch (err) {
        msg.reject?.(err);
      }
    }
  }

  /**
   * Discard all buffered messages, emitting a "messageDropped"
   * event and rejecting any pending ack promises for each.
   */
  clear(reason: "disconnected"): void {
    const pending = this.messages.splice(0);
    for (const msg of pending) {
      this.callbacks.onDropped({
        messageId: msg.messageId,
        route: msg.route,
        reason,
      });
      msg.reject?.(new Error("Disconnected"));
    }
  }
}
