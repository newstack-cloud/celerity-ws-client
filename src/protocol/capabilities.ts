import type { ServerCapabilities } from "../types";
import { BINARY_PREFIX, BINARY_PREFIX_LENGTH } from "./constants";

export const DEFAULT_CAPABILITIES: ServerCapabilities = {
  binary: false,
  customCloseCodes: false,
  ackFormat: "json",
};

export const FULL_CAPABILITIES: ServerCapabilities = {
  binary: true,
  customCloseCodes: true,
  ackFormat: "binary",
};

export function isCapabilitiesSignal(data: unknown): boolean {
  const bytes = toUint8Array(data);
  if (!bytes || bytes.byteLength !== BINARY_PREFIX_LENGTH) return false;

  return (
    bytes[0] === BINARY_PREFIX.CAPABILITIES[0] &&
    bytes[1] === BINARY_PREFIX.CAPABILITIES[1] &&
    bytes[2] === BINARY_PREFIX.CAPABILITIES[2] &&
    bytes[3] === BINARY_PREFIX.CAPABILITIES[3]
  );
}

function toUint8Array(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);

  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

  if (typeof data === "object" && data !== null && "data" in data) {
    return toUint8Array((data as { data: unknown }).data);
  }

  return null;
}
