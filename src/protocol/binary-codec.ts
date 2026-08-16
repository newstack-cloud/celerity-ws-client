import { BINARY_PREFIX, BINARY_PREFIX_LENGTH } from "./constants";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

export function encodeBinaryMessage(
  routeKey: string,
  payload: Uint8Array,
  messageId: string,
  ack: boolean,
): Uint8Array {
  const routeBytes = TEXT_ENCODER.encode(routeKey);
  const messageIdBytes = TEXT_ENCODER.encode(messageId);

  const totalLength = 1 + routeBytes.length + 1 + 1 + messageIdBytes.length + payload.length;

  const buffer = new Uint8Array(totalLength);
  let offset = 0;

  buffer[offset++] = routeBytes.length;
  buffer.set(routeBytes, offset);
  offset += routeBytes.length;

  buffer[offset++] = ack ? 1 : 0;

  buffer[offset++] = messageIdBytes.length;
  buffer.set(messageIdBytes, offset);
  offset += messageIdBytes.length;

  buffer.set(payload, offset);

  return buffer;
}

/**
 * Encodes an acknowledgement as a reserved binary frame:
 * [0x1 0x4 0x0 0x0] followed by the JSON body naming the message and the time.
 * The two trailing zero bytes say that the acknowledgement asks for none of its
 * own and carries no id of its own.
 */
export function encodeBinaryAck(messageId: string, timestamp: string): Uint8Array {
  const body = TEXT_ENCODER.encode(JSON.stringify({ messageId, timestamp }));

  const frame = new Uint8Array(BINARY_PREFIX_LENGTH + body.length);
  frame.set(BINARY_PREFIX.ACK, 0);
  frame.set(body, BINARY_PREFIX_LENGTH);

  return frame;
}

export type DecodedBinaryMessage = {
  routeKey: string;
  ack: boolean;
  messageId: string;
  payload: Uint8Array;
};

/**
 * Decodes a Celerity Binary Message:
 * [routeKeyLen(1)] [routeKey(N)] [ackFlag(1)] [msgIdLen(1)] [msgId(N)] [payload(...)]
 */
export function decodeBinaryMessage(data: Uint8Array): DecodedBinaryMessage | null {
  if (data.length < 3) return null;

  let offset = 0;

  const routeKeyLength = data[offset++];
  if (offset + routeKeyLength > data.length) return null;
  const routeKey = TEXT_DECODER.decode(data.subarray(offset, offset + routeKeyLength));
  offset += routeKeyLength;

  if (offset >= data.length) return null;
  const ack = data[offset++] === 1;

  if (offset >= data.length) return null;
  const messageIdLength = data[offset++];
  if (offset + messageIdLength > data.length) return null;
  const messageId = TEXT_DECODER.decode(data.subarray(offset, offset + messageIdLength));
  offset += messageIdLength;

  const payload = data.subarray(offset);

  return { routeKey, ack, messageId, payload };
}

export type BinaryControlType = "ping" | "pong" | "lostMessage" | "ack" | "capabilities";

export function identifyBinaryControl(data: Uint8Array): BinaryControlType | null {
  if (data.length < BINARY_PREFIX_LENGTH) return null;

  const prefix = data.subarray(0, BINARY_PREFIX_LENGTH);

  if (matchesPrefix(prefix, BINARY_PREFIX.PING)) return "ping";
  if (matchesPrefix(prefix, BINARY_PREFIX.PONG)) return "pong";
  if (matchesPrefix(prefix, BINARY_PREFIX.LOST_MESSAGE)) return "lostMessage";
  if (matchesPrefix(prefix, BINARY_PREFIX.ACK)) return "ack";
  if (matchesPrefix(prefix, BINARY_PREFIX.CAPABILITIES)) return "capabilities";

  return null;
}

export function extractBinaryControlPayload(data: Uint8Array): string {
  return TEXT_DECODER.decode(data.subarray(BINARY_PREFIX_LENGTH));
}

function matchesPrefix(data: Uint8Array, prefix: Uint8Array): boolean {
  for (let i = 0; i < prefix.length; i++) {
    if (data[i] !== prefix[i]) return false;
  }
  return true;
}
