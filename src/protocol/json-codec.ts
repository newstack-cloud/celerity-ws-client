export function encodeJsonMessage(
  routeKey: string,
  route: string,
  data: unknown,
  messageId?: string,
  ack?: boolean,
): string {
  const message: Record<string, unknown> = {
    [routeKey]: route,
    data,
  };
  if (messageId) {
    message.messageId = messageId;
  }
  if (ack && messageId) {
    message.ack = true;
  }
  return JSON.stringify(message);
}

/**
 * Encodes an acknowledgement as JSON text, for a transport that cannot carry
 * binary frames. The key is `event` rather than the configured route key, as
 * the reserved form is fixed by the protocol.
 */
export function encodeJsonAck(messageId: string, timestamp: string): string {
  return JSON.stringify({
    event: "ack",
    data: { messageId, timestamp },
  });
}

export function decodeJsonMessage(raw: string): {
  route: string | undefined;
  data: unknown;
  messageId: string | undefined;
  parsed: Record<string, unknown>;
} | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      route: undefined,
      data: parsed.data,
      messageId: parsed.messageId as string | undefined,
      parsed,
    };
  } catch {
    return null;
  }
}

export function extractRoute(
  parsed: Record<string, unknown>,
  routeKey: string,
): string | undefined {
  const value = parsed[routeKey];
  return typeof value === "string" ? value : undefined;
}
