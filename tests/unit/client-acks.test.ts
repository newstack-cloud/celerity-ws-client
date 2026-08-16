import { describe, it, expect, afterEach } from "vitest";
import { CelerityWsClient } from "../../src/client";
import { encodeBinaryMessage } from "../../src/protocol/binary-codec";
import { BINARY_PREFIX } from "../../src/protocol/constants";
import { MockWebSocket, MockWebSocketFactory } from "../helpers/mock-ws";

type Harness = {
  client: CelerityWsClient;
  ws: MockWebSocket;
};

const CONSTRAINED_HANDSHAKE_TIMEOUT = 5;

describe("client acknowledgements", () => {
  let harness: Harness | null = null;

  afterEach(() => {
    harness?.client.destroy();
    harness = null;
  });

  // Drives a client to the ready state. Sending the capabilities signal gets
  // full capabilities; withholding it leaves the handshake to time out into the
  // constrained ones, which is the only way to reach that branch.
  async function connect(options: { capabilities: "full" | "constrained" }): Promise<Harness> {
    const factory = new MockWebSocketFactory();
    const client = new CelerityWsClient(
      {
        url: "wss://example.com/ws",
        WebSocket: factory,
        reconnect: { enabled: false },
        heartbeat: { interval: 60_000 },
        handshakeTimeout: CONSTRAINED_HANDSHAKE_TIMEOUT,
      },
      factory,
    );

    const ready = client.connect();
    const ws = factory.latest;
    ws.simulateOpen();

    if (options.capabilities === "full") {
      ws.simulateMessage(BINARY_PREFIX.CAPABILITIES);
    }

    await ready;
    ws.sentMessages.length = 0;

    harness = { client, ws };
    return harness;
  }

  function sentAcks(ws: MockWebSocket): { messageId: string; timestamp: string }[] {
    return ws.sentMessages.map((sent) => {
      if (typeof sent === "string") {
        const parsed = JSON.parse(sent) as {
          event: string;
          data: { messageId: string; timestamp: string };
        };
        expect(parsed.event).toBe("ack");
        return parsed.data;
      }

      const bytes = sent instanceof Uint8Array ? sent : new Uint8Array(sent);
      expect(Array.from(bytes.subarray(0, 4))).toEqual(Array.from(BINARY_PREFIX.ACK));
      return JSON.parse(new TextDecoder().decode(bytes.subarray(4))) as {
        messageId: string;
        timestamp: string;
      };
    });
  }

  it("should acknowledge a binary message that asked to be", async () => {
    const { ws } = await connect({ capabilities: "full" });

    ws.simulateMessage(encodeBinaryMessage("updates", new Uint8Array([1, 2]), "msg-1", true));

    expect(sentAcks(ws)).toEqual([
      { messageId: "msg-1", timestamp: expect.any(String) as unknown as string },
    ]);
  });

  it("should acknowledge a JSON message that asked to be", async () => {
    const { ws } = await connect({ capabilities: "full" });

    ws.simulateMessage(
      JSON.stringify({ event: "updates", data: { x: 1 }, messageId: "msg-1", ack: true }),
    );

    expect(sentAcks(ws)).toEqual([
      { messageId: "msg-1", timestamp: expect.any(String) as unknown as string },
    ]);
  });

  it("should stay quiet for messages that did not ask", async () => {
    const { ws } = await connect({ capabilities: "full" });

    // Carries an id but does not opt in.
    ws.simulateMessage(JSON.stringify({ event: "updates", data: {}, messageId: "msg-1" }));
    ws.simulateMessage(encodeBinaryMessage("updates", new Uint8Array([1]), "msg-2", false));
    // Opts in with no id, so there is nothing an acknowledgement could name.
    ws.simulateMessage(JSON.stringify({ event: "updates", data: {}, ack: true }));
    ws.simulateMessage(encodeBinaryMessage("updates", new Uint8Array([1]), "", true));

    expect(ws.sentMessages).toEqual([]);
  });

  it("should acknowledge a resend the deduplication store suppresses", async () => {
    const { client, ws } = await connect({ capabilities: "full" });

    const delivered: string[] = [];
    client.on("updates", (_data, metadata) => {
      delivered.push(metadata.messageId);
    });

    const message = JSON.stringify({
      event: "updates",
      data: { x: 1 },
      messageId: "msg-1",
      ack: true,
    });
    ws.simulateMessage(message);
    ws.simulateMessage(message);

    // The application sees it once, but the server hears about both, otherwise
    // it keeps resending a message that already arrived.
    expect(delivered).toEqual(["msg-1"]);
    expect(sentAcks(ws).map((ack) => ack.messageId)).toEqual(["msg-1", "msg-1"]);
  });

  it("should answer in JSON when the transport carries no binary frames", async () => {
    const { ws } = await connect({ capabilities: "constrained" });

    ws.simulateMessage(
      JSON.stringify({ event: "updates", data: { x: 1 }, messageId: "msg-1", ack: true }),
    );

    expect(ws.sentMessages.every((sent) => typeof sent === "string")).toBe(true);
    expect(sentAcks(ws).map((ack) => ack.messageId)).toEqual(["msg-1"]);
  });

  it("should answer in a binary frame when the transport carries them", async () => {
    const { ws } = await connect({ capabilities: "full" });

    // Asked for in JSON, answered in binary. The form follows the negotiated
    // capabilities rather than the form the message arrived in.
    ws.simulateMessage(
      JSON.stringify({ event: "updates", data: { x: 1 }, messageId: "msg-1", ack: true }),
    );

    expect(ws.sentMessages.every((sent) => typeof sent !== "string")).toBe(true);
    expect(sentAcks(ws).map((ack) => ack.messageId)).toEqual(["msg-1"]);
  });
});
