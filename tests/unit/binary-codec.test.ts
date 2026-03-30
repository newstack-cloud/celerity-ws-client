import { describe, it, expect } from "vitest";
import {
  encodeBinaryMessage,
  decodeBinaryMessage,
  identifyBinaryControl,
  extractBinaryControlPayload,
} from "../../src/protocol/binary-codec";
import { BINARY_PREFIX } from "../../src/protocol/constants";

describe("binary-codec", () => {
  describe("encodeBinaryMessage / decodeBinaryMessage", () => {
    it("should roundtrip a binary message", () => {
      const payload = new Uint8Array([10, 20, 30]);
      const encoded = encodeBinaryMessage("chat.message", payload, "msg-123", false);
      const decoded = decodeBinaryMessage(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded!.routeKey).toBe("chat.message");
      expect(decoded!.messageId).toBe("msg-123");
      expect(decoded!.ack).toBe(false);
      expect(decoded!.payload).toEqual(payload);
    });

    it("should encode ack flag", () => {
      const payload = new Uint8Array([1]);
      const encoded = encodeBinaryMessage("test", payload, "id", true);
      const decoded = decodeBinaryMessage(encoded);

      expect(decoded!.ack).toBe(true);
    });

    it("should handle empty payload", () => {
      const payload = new Uint8Array(0);
      const encoded = encodeBinaryMessage("route", payload, "id", false);
      const decoded = decodeBinaryMessage(encoded);

      expect(decoded!.payload.length).toBe(0);
    });

    it("should return null for too-short data", () => {
      expect(decodeBinaryMessage(new Uint8Array([1, 2]))).toBeNull();
    });
  });

  describe("identifyBinaryControl", () => {
    it("should identify ping", () => {
      expect(identifyBinaryControl(BINARY_PREFIX.PING)).toBe("ping");
    });

    it("should identify pong", () => {
      expect(identifyBinaryControl(BINARY_PREFIX.PONG)).toBe("pong");
    });

    it("should identify ack", () => {
      expect(identifyBinaryControl(BINARY_PREFIX.ACK)).toBe("ack");
    });

    it("should identify lost message", () => {
      expect(identifyBinaryControl(BINARY_PREFIX.LOST_MESSAGE)).toBe("lostMessage");
    });

    it("should identify capabilities", () => {
      expect(identifyBinaryControl(BINARY_PREFIX.CAPABILITIES)).toBe("capabilities");
    });

    it("should return null for unknown prefix", () => {
      expect(identifyBinaryControl(new Uint8Array([0, 0, 0, 0]))).toBeNull();
    });

    it("should return null for short data", () => {
      expect(identifyBinaryControl(new Uint8Array([1]))).toBeNull();
    });
  });

  describe("extractBinaryControlPayload", () => {
    it("should extract JSON payload after prefix", () => {
      const json = '{"messageId":"123","timestamp":"2026-01-01T00:00:00Z"}';
      const encoder = new TextEncoder();
      const jsonBytes = encoder.encode(json);
      const data = new Uint8Array(4 + jsonBytes.length);
      data.set(BINARY_PREFIX.ACK, 0);
      data.set(jsonBytes, 4);

      expect(extractBinaryControlPayload(data)).toBe(json);
    });
  });
});
