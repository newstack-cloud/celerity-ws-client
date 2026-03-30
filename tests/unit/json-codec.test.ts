import { describe, it, expect } from "vitest";
import { encodeJsonMessage, decodeJsonMessage, extractRoute } from "../../src/protocol/json-codec";

describe("json-codec", () => {
  describe("encodeJsonMessage", () => {
    it("should encode a basic message", () => {
      const result = encodeJsonMessage("event", "chat.send", { text: "hello" });
      const parsed = JSON.parse(result);
      expect(parsed.event).toBe("chat.send");
      expect(parsed.data).toEqual({ text: "hello" });
      expect(parsed.messageId).toBeUndefined();
    });

    it("should include messageId when provided", () => {
      const result = encodeJsonMessage("event", "chat.send", {}, "msg-1");
      const parsed = JSON.parse(result);
      expect(parsed.messageId).toBe("msg-1");
    });

    it("should include ack flag when true and messageId present", () => {
      const result = encodeJsonMessage("event", "chat.send", {}, "msg-1", true);
      const parsed = JSON.parse(result);
      expect(parsed.ack).toBe(true);
    });

    it("should not include ack without messageId", () => {
      const result = encodeJsonMessage("event", "chat.send", {}, undefined, true);
      const parsed = JSON.parse(result);
      expect(parsed.ack).toBeUndefined();
    });
  });

  describe("decodeJsonMessage", () => {
    it("should decode valid JSON", () => {
      const result = decodeJsonMessage('{"event":"test","data":{"x":1},"messageId":"id-1"}');
      expect(result).not.toBeNull();
      expect(result!.data).toEqual({ x: 1 });
      expect(result!.messageId).toBe("id-1");
    });

    it("should return null for invalid JSON", () => {
      expect(decodeJsonMessage("not json")).toBeNull();
    });
  });

  describe("extractRoute", () => {
    it("should extract route by key", () => {
      expect(extractRoute({ event: "chat.send", data: {} }, "event")).toBe("chat.send");
    });

    it("should return undefined for missing key", () => {
      expect(extractRoute({ data: {} }, "event")).toBeUndefined();
    });

    it("should return undefined for non-string value", () => {
      expect(extractRoute({ event: 123, data: {} }, "event")).toBeUndefined();
    });
  });
});
