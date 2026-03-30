import { describe, it, expect, afterEach } from "vitest";
import { createWsClient } from "../../src/index";
import type { CelerityWsClient } from "../../src/index";
import type { Unsubscribe } from "../../src/types";

const SERVER_URL = process.env.WS_SERVER_URL ?? "ws://localhost:9876";
const CONNECT_SERVER_URL = process.env.WS_CONNECT_SERVER_URL ?? "ws://localhost:9877";
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "test-token";

describe("CelerityWsClient integration", () => {
  let client: CelerityWsClient;
  const unsubs: Unsubscribe[] = [];

  afterEach(async () => {
    unsubs.forEach((u) => u());
    unsubs.length = 0;
    if (client?.state !== "disconnected") {
      await client?.disconnect().catch(() => {});
    }
    client?.destroy();
  });

  describe("connection lifecycle", () => {
    it("should connect and receive capabilities", async () => {
      client = await createWsClient({ url: SERVER_URL });

      const connected = new Promise<void>((resolve) => {
        unsubs.push(client.on("connected", resolve as () => void));
      });

      await client.connect();
      await connected;

      expect(client.state).toBe("ready");
      expect(client.capabilities).toBeDefined();
      expect(client.capabilities!.binary).toBe(true);
    });

    it("should disconnect cleanly", async () => {
      client = await createWsClient({ url: SERVER_URL });

      await client.connect();
      await client.disconnect();

      expect(client.state).toBe("disconnected");
    });
  });

  describe("authMessage strategy", () => {
    it("should authenticate with valid token", async () => {
      client = await createWsClient({
        url: SERVER_URL,
        auth: { strategy: "authMessage", token: AUTH_TOKEN },
      });

      const authPromise = new Promise<Record<string, unknown> | undefined>((resolve) => {
        unsubs.push(client.on("authenticated", resolve as () => void));
      });

      await client.connect();

      const userInfo = await authPromise;
      expect(client.state).toBe("ready");
      expect(userInfo).toBeDefined();
    });

    it("should fail authentication with invalid token", async () => {
      client = await createWsClient({
        url: SERVER_URL,
        auth: { strategy: "authMessage", token: "wrong-token" },
        reconnect: { enabled: false },
      });

      const authFailed = new Promise<Error>((resolve) => {
        unsubs.push(client.on("authFailed", resolve as () => void));
      });

      await expect(client.connect()).rejects.toThrow();
      const error = await authFailed;
      expect(error.message).toBe("Invalid token");
    });
  });

  describe("connect strategy", () => {
    it("should authenticate via header with valid token", async () => {
      client = await createWsClient({
        url: CONNECT_SERVER_URL,
        auth: { strategy: "connect", token: AUTH_TOKEN },
      });

      const authPromise = new Promise<void>((resolve) => {
        unsubs.push(client.on("authenticated", resolve as () => void));
      });

      await client.connect();
      await authPromise;

      expect(client.state).toBe("ready");
    });
  });

  describe("messaging", () => {
    it("should send and receive JSON messages", async () => {
      client = await createWsClient({ url: SERVER_URL });
      await client.connect();

      const received = new Promise<unknown>((resolve) => {
        unsubs.push(client.on("echo_chat", resolve as () => void));
      });

      client.send("chat", { text: "hello" });

      const data = await received;
      expect(data).toEqual({ text: "hello" });
    });

    it("should send and receive acked JSON messages", async () => {
      client = await createWsClient({ url: SERVER_URL });
      await client.connect();

      const ackResponse = await client.sendWithAck("chat", { text: "acked" });

      expect(ackResponse.messageId).toBeDefined();
      expect(ackResponse.timestamp).toBeDefined();
    });

    it("should send and receive binary messages", async () => {
      client = await createWsClient({ url: SERVER_URL });
      await client.connect();

      const received = new Promise<Uint8Array>((resolve) => {
        unsubs.push(
          client.onBinary("echo_data", (payload) => {
            resolve(payload);
          }),
        );
      });

      const payload = new Uint8Array([0x10, 0x20, 0x30]);
      client.sendBinary("data", payload);

      const echoed = await received;
      expect([...echoed]).toEqual([...payload]);
    });
  });

  describe("heartbeat", () => {
    it("should exchange ping/pong within heartbeat cycle", async () => {
      client = await createWsClient({
        url: SERVER_URL,
        heartbeat: { interval: 200, timeout: 1000 },
      });

      await client.connect();

      // Wait for at least one heartbeat cycle
      await new Promise((r) => setTimeout(r, 500));

      // If heartbeat failed, state would not be "ready"
      expect(client.state).toBe("ready");
    });
  });
});
