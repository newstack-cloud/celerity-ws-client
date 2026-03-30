import { describe, it, expect, beforeEach } from "vitest";
import { ConnectionStateMachine } from "../../src/state/machine";

describe("ConnectionStateMachine", () => {
  let machine: ConnectionStateMachine;

  beforeEach(() => {
    machine = new ConnectionStateMachine();
  });

  it("should start in disconnected state", () => {
    expect(machine.state).toBe("disconnected");
  });

  it("should transition through the connect flow without auth", () => {
    machine.transition("CONNECT");
    expect(machine.state).toBe("connecting");

    machine.transition("WS_OPEN");
    expect(machine.state).toBe("handshaking");

    machine.transition("CAPABILITIES_DETERMINED_NO_AUTH");
    expect(machine.state).toBe("ready");
  });

  it("should transition through the connect flow with auth", () => {
    machine.transition("CONNECT");
    machine.transition("WS_OPEN");
    machine.transition("CAPABILITIES_DETERMINED_AUTH");
    expect(machine.state).toBe("authenticating");

    machine.transition("AUTH_SUCCESS");
    expect(machine.state).toBe("ready");
  });

  it("should handle disconnect flow", () => {
    machine.transition("CONNECT");
    machine.transition("WS_OPEN");
    machine.transition("CAPABILITIES_DETERMINED_NO_AUTH");
    machine.transition("DISCONNECT");
    expect(machine.state).toBe("disconnecting");

    machine.transition("WS_CLOSED");
    expect(machine.state).toBe("disconnected");
  });

  it("should handle reconnection flow", () => {
    machine.transition("CONNECT");
    machine.transition("WS_OPEN");
    machine.transition("CAPABILITIES_DETERMINED_NO_AUTH");
    machine.transition("WS_UNEXPECTED_CLOSE");
    expect(machine.state).toBe("reconnecting");

    machine.transition("RETRY");
    expect(machine.state).toBe("connecting");
  });

  it("should handle heartbeat timeout", () => {
    machine.transition("CONNECT");
    machine.transition("WS_OPEN");
    machine.transition("CAPABILITIES_DETERMINED_NO_AUTH");
    machine.transition("HEARTBEAT_TIMEOUT");
    expect(machine.state).toBe("reconnecting");
  });

  it("should handle retry exhaustion", () => {
    machine.transition("CONNECT");
    machine.transition("WS_OPEN");
    machine.transition("CAPABILITIES_DETERMINED_NO_AUTH");
    machine.transition("WS_UNEXPECTED_CLOSE");
    machine.transition("RETRY_EXHAUSTED");
    expect(machine.state).toBe("disconnected");
  });

  it("should throw on invalid transition", () => {
    expect(() => machine.transition("WS_OPEN")).toThrow("Invalid state transition");
  });

  it("should report canTransition correctly", () => {
    expect(machine.canTransition("CONNECT")).toBe(true);
    expect(machine.canTransition("WS_OPEN")).toBe(false);
  });

  it("should call onTransition handler", () => {
    const transitions: Array<{ from: string; to: string; event: string }> = [];
    machine.onTransition = (from, to, event) => {
      transitions.push({ from, to, event });
    };

    machine.transition("CONNECT");

    expect(transitions).toEqual([{ from: "disconnected", to: "connecting", event: "CONNECT" }]);
  });

  it("should reset to disconnected", () => {
    machine.transition("CONNECT");
    machine.reset();
    expect(machine.state).toBe("disconnected");
  });

  it("should handle auth failure to disconnected", () => {
    machine.transition("CONNECT");
    machine.transition("WS_OPEN");
    machine.transition("CAPABILITIES_DETERMINED_AUTH");
    machine.transition("AUTH_FAILURE");
    expect(machine.state).toBe("disconnected");
  });
});
