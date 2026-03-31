import type { BinaryMessageHandler, MessageHandler, MessageMetadata, Unsubscribe } from "../types";

/** Route key that matches all incoming messages regardless of their route. */
export const WILDCARD_ROUTE = "*";

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
    let dispatched = false;

    const set = this.jsonHandlers.get(route);
    if (set && set.size > 0) {
      for (const handler of set) {
        handler(data, metadata);
      }
      dispatched = true;
    }

    // Wildcard handlers receive all messages regardless of route.
    const wildcardSet = this.jsonHandlers.get(WILDCARD_ROUTE);
    if (wildcardSet && wildcardSet.size > 0) {
      for (const handler of wildcardSet) {
        handler(data, metadata);
      }
      dispatched = true;
    }

    return dispatched;
  }

  dispatchBinary(routeKey: string, payload: Uint8Array, metadata: MessageMetadata): boolean {
    let dispatched = false;

    const set = this.binaryHandlers.get(routeKey);
    if (set && set.size > 0) {
      for (const handler of set) {
        handler(payload, metadata);
      }
      dispatched = true;
    }

    const wildcardSet = this.binaryHandlers.get(WILDCARD_ROUTE);
    if (wildcardSet && wildcardSet.size > 0) {
      for (const handler of wildcardSet) {
        handler(payload, metadata);
      }
      dispatched = true;
    }

    return dispatched;
  }

  clear(): void {
    this.jsonHandlers.clear();
    this.binaryHandlers.clear();
  }
}
