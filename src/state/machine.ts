import type { ConnectionState } from "../types";
import { type StateEvent, TRANSITIONS } from "./transitions";

export type StateChangeHandler = (
  from: ConnectionState,
  to: ConnectionState,
  event: StateEvent,
) => void;

export class ConnectionStateMachine {
  private _state: ConnectionState = "disconnected";
  private _onTransition: StateChangeHandler | null = null;

  get state(): ConnectionState {
    return this._state;
  }

  set onTransition(handler: StateChangeHandler | null) {
    this._onTransition = handler;
  }

  transition(event: StateEvent): ConnectionState {
    const nextState = TRANSITIONS[this._state]?.[event];
    if (!nextState) {
      throw new Error(`Invalid state transition: ${this._state} + ${event}`);
    }
    const prev = this._state;
    this._state = nextState;
    this._onTransition?.(prev, nextState, event);
    return nextState;
  }

  canTransition(event: StateEvent): boolean {
    return TRANSITIONS[this._state]?.[event] !== undefined;
  }

  reset(): void {
    this._state = "disconnected";
  }
}
