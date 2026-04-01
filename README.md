# Celerity WebSocket Client

[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=newstack-cloud_celerity-ws-client&metric=coverage)](https://sonarcloud.io/summary/new_code?id=newstack-cloud_celerity-ws-client)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=newstack-cloud_celerity-ws-client&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=newstack-cloud_celerity-ws-client)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=newstack-cloud_celerity-ws-client&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=newstack-cloud_celerity-ws-client)

TypeScript WebSocket client SDK for the [Celerity](https://celerityframework.com) Runtime Protocol. Works in both Node.js and the browser. Zero bundled dependencies for browser clients; Node.js requires the `ws` peer dependency.

## Features

- Full implementation of the Celerity Runtime Protocol (capabilities negotiation, authentication, heartbeat, acks, deduplication)
- Automatic reconnection with exponential backoff and jitter
- Binary and JSON message support
- Dual ESM/CJS output with separate browser and Node.js entry points
- JSON property-based message routing with wildcard (`"*"`) support
- Zero runtime dependencies for browser clients, `ws` is an optional peer dependency for Node.js.

## Installation

```bash
npm install @celerity-sdk/ws-client

# Node.js also requires the ws library
npm install ws
```

## Quick Start

### Browser

```typescript
import { createWsClient } from "@celerity-sdk/ws-client";

const client = await createWsClient({ url: "wss://example.com/ws" });

client.on("connected", () => {
  console.log("Connected!");
  client.send("greet", { message: "Hello" });
});

client.on("greeting", (data) => {
  console.log("Received:", data);
});

await client.connect();
```

### Node.js

```typescript
import { createWsClient } from "@celerity-sdk/ws-client";

const client = await createWsClient({ url: "wss://example.com/ws" });

client.on("connected", () => {
  client.send("greet", { message: "Hello from Node" });
});

await client.connect();
```

## Authentication

The client supports two authentication strategies:

### Auth Message (works with all servers)

```typescript
const client = await createWsClient({
  url: "wss://example.com/ws",
  auth: {
    strategy: "authMessage",
    token: "your-token",
  },
});
```

### Connect (requires server support for custom close codes)

```typescript
const client = await createWsClient({
  url: "wss://example.com/ws",
  auth: {
    strategy: "connect",
    token: "your-token",
    headerName: "Authorization", // default
    headerPrefix: "Bearer", // default
  },
});
```

Both strategies accept a token string or an async function that resolves to a token.

## Sending Messages

```typescript
// Fire-and-forget
client.send("chat.message", { text: "Hello" });

// With acknowledgement
const ack = await client.sendWithAck("chat.message", { text: "Hello" });
console.log("Acknowledged at:", ack.timestamp);

// Binary messages (requires server capability)
client.sendBinary("audio.chunk", audioBuffer);
const ack = await client.sendBinaryWithAck("audio.chunk", audioBuffer);
```

## Listening for Events

```typescript
// Lifecycle events
client.on("connected", () => {
  /* ... */
});
client.on("disconnected", ({ code, reason, willReconnect }) => {
  /* ... */
});
client.on("reconnecting", ({ attempt, delay }) => {
  /* ... */
});
client.on("authenticated", (userInfo) => {
  /* ... */
});
client.on("error", (err) => {
  /* ... */
});

// Custom message routes
client.on("chat.message", (data) => {
  /* ... */
});

// Wildcard route — receive all application messages regardless of route.
// Wildcard handlers fire alongside route-specific handlers, not instead of them.
client.on("*", (data, metadata) => {
  console.log(`Received message on route "${metadata.route}":`, data);
});

// Binary messages support the same wildcard pattern
client.onBinary("*", (payload, metadata) => {
  /* receives all binary messages */
});

// Binary message routes
client.onBinary("audio.chunk", (payload) => {
  /* ... */
});

// All handlers return an unsubscribe function
const unsub = client.on("chat.message", handler);
unsub(); // stop listening
```

## Configuration

```typescript
const client = await createWsClient({
  url: "wss://example.com/ws", // Required
  auth: {
    /* ... */
  }, // Optional authentication
  routeKey: "event", // Message route field (default: "event")
  protocols: [], // WebSocket sub-protocols
  headers: {}, // Custom upgrade headers (Node.js only)
  handshakeTimeout: 2000, // Capabilities handshake timeout in ms
  messageId: "uuid", // "uuid" or custom generator function
  heartbeat: {
    interval: 10_000, // Ping interval in ms
    timeout: 5_000, // Pong timeout in ms
  },
  reconnect: {
    enabled: true,
    maxRetries: 100,
    baseDelay: 1_000, // Initial backoff delay in ms
    backoffFactor: 1.5,
    maxDelay: 30_000, // Maximum backoff delay in ms
    maxElapsedTime: 300_000, // Give up after 5 minutes (0 = unlimited)
  },
  ack: {
    timeout: 10_000, // Ack wait timeout in ms
    maxRetries: 3,
  },
  deduplication: {
    enabled: true,
    ttl: 300_000, // Dedup window in ms
    maxEntries: 10_000,
  },
});
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commands, and commit conventions.

## License

[Apache-2.0](./LICENSE)
