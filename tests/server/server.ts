/**
 * Minimal Celerity Runtime Protocol test server.
 * Implements the subset of the protocol needed for integration testing.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";

const PORT = Number(process.env.PORT ?? 9876);
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? "test-token";
const AUTH_STRATEGY = process.env.AUTH_STRATEGY ?? "authMessage";

const CAPABILITIES = Buffer.from([0x01, 0x05, 0x00, 0x00]);
const PONG_BINARY = Buffer.from([0x01, 0x02, 0x00, 0x00]);
const ACK_PREFIX = Buffer.from([0x01, 0x04, 0x00, 0x00]);

const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`Test server listening on port ${PORT}`);
});

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  // Send capabilities signal immediately
  ws.send(CAPABILITIES);

  // For connect strategy, check the Authorization header at upgrade time
  if (AUTH_STRATEGY === "connect") {
    const authHeader = req.headers["authorization"];
    if (authHeader === `Bearer ${AUTH_TOKEN}`) {
      ws.send(
        JSON.stringify({
          event: "authenticated",
          data: { success: true, userInfo: { id: "user-1" }, message: "Authenticated" },
        }),
      );
    } else {
      ws.send(
        JSON.stringify({
          event: "authenticated",
          data: { success: false, message: "Invalid token" },
        }),
      );
      ws.close(4001, "Unauthorized");
      return;
    }
  }

  ws.on("message", (raw: Buffer, isBinary: boolean) => {
    // Binary message handling
    if (isBinary) {
      // Ping → Pong
      if (raw.length === 4 && raw[0] === 0x01 && raw[1] === 0x01) {
        ws.send(PONG_BINARY);
        return;
      }

      // Binary application message — check for ack flag
      if (raw.length >= 4) {
        const routeLen = raw[0];
        const route = raw.subarray(1, 1 + routeLen).toString("utf8");
        const ackFlag = raw[1 + routeLen];
        const msgIdLen = raw[2 + routeLen];

        if (ackFlag === 0x01 && msgIdLen > 0) {
          const messageId = raw.subarray(3 + routeLen, 3 + routeLen + msgIdLen).toString("utf8");
          const ackPayload = JSON.stringify({
            messageId,
            timestamp: new Date().toISOString(),
          });
          ws.send(Buffer.concat([ACK_PREFIX, Buffer.from(ackPayload)]));
        }

        // Echo binary messages back with a "echo_" prefix on route
        if (route !== "\x01" && route !== "\x05") {
          // re-encode with echo_ prefix
          const payload = raw.subarray(3 + routeLen + msgIdLen);
          const echoRoute = `echo_${route}`;
          const echoRouteLen = Buffer.byteLength(echoRoute);
          const echoBuf = Buffer.alloc(1 + echoRouteLen + 2 + payload.length);
          echoBuf[0] = echoRouteLen;
          echoBuf.write(echoRoute, 1, "utf8");
          echoBuf[1 + echoRouteLen] = 0x00; // no ack
          echoBuf[2 + echoRouteLen] = 0x00; // no msg id
          payload.copy(echoBuf, 3 + echoRouteLen);
          ws.send(echoBuf);
        }
      }
      return;
    }

    // Text message handling
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      return;
    }

    // JSON Ping → Pong
    if (parsed.ping === true) {
      ws.send(JSON.stringify({ pong: true }));
      return;
    }

    // Authentication (authMessage strategy)
    const routeKey = (parsed.event as string) ?? (parsed.action as string);
    if (routeKey === "authenticate") {
      const data = parsed.data as Record<string, unknown> | undefined;
      if (data?.token === AUTH_TOKEN) {
        ws.send(
          JSON.stringify({
            event: "authenticated",
            data: { success: true, userInfo: { id: "user-1" }, message: "Authenticated" },
          }),
        );
      } else {
        ws.send(
          JSON.stringify({
            event: "authenticated",
            data: { success: false, message: "Invalid token" },
          }),
        );
        ws.close(4001, "Unauthorized");
      }
      return;
    }

    // Ack handling for JSON messages
    if (parsed.ack === true && parsed.messageId) {
      ws.send(
        JSON.stringify({
          event: "ack",
          data: {
            messageId: parsed.messageId,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    }

    // Echo: send the message back with "echo_" prefix on route
    if (routeKey && routeKey !== "ack" && routeKey !== "authenticated") {
      ws.send(
        JSON.stringify({
          event: `echo_${routeKey}`,
          data: parsed.data,
          messageId: parsed.messageId,
        }),
      );
    }
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  wss.close(() => process.exit(0));
});
