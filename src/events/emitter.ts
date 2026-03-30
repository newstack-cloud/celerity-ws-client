import type { Unsubscribe } from "../types";

type EventMap = Record<string, (...args: never[]) => void>;

export class TypedEventEmitter<T extends EventMap> {
  private listeners = new Map<keyof T, Set<T[keyof T]>>();

  on<K extends keyof T>(event: K, handler: T[K]): Unsubscribe {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) this.listeners.delete(event);
    };
  }

  emit<K extends keyof T>(event: K, ...args: Parameters<T[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as (...args: Parameters<T[K]>) => void)(...args);
    }
  }

  removeAllListeners(event?: keyof T): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: keyof T): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
