import type { BinaryMessageHandler, MessageHandler, MessageMetadata, Unsubscribe } from "../types";

export class MessageRouter {
  private jsonHandlers = new Map<string, Set<MessageHandler>>();
  private binaryHandlers = new Map<string, Set<BinaryMessageHandler>>();

  on(route: string, handler: MessageHandler): Unsubscribe {
    let set = this.jsonHandlers.get(route);
    if (!set) {
      set = new Set();
      this.jsonHandlers.set(route, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.jsonHandlers.delete(route);
    };
  }

  onBinary(routeKey: string, handler: BinaryMessageHandler): Unsubscribe {
    let set = this.binaryHandlers.get(routeKey);
    if (!set) {
      set = new Set();
      this.binaryHandlers.set(routeKey, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.binaryHandlers.delete(routeKey);
    };
  }

  dispatchJson(route: string, data: unknown, metadata: MessageMetadata): boolean {
    const set = this.jsonHandlers.get(route);
    if (!set || set.size === 0) return false;
    for (const handler of set) {
      handler(data, metadata);
    }
    return true;
  }

  dispatchBinary(routeKey: string, payload: Uint8Array, metadata: MessageMetadata): boolean {
    const set = this.binaryHandlers.get(routeKey);
    if (!set || set.size === 0) return false;
    for (const handler of set) {
      handler(payload, metadata);
    }
    return true;
  }

  clear(): void {
    this.jsonHandlers.clear();
    this.binaryHandlers.clear();
  }
}
