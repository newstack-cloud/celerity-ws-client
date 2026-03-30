import { describe, it, expect, vi } from "vitest";
import { calculateBackoff, parseRetryAfter } from "../../src/reconnect/backoff";
import { DEFAULT_RECONNECT } from "../../src/protocol/constants";

describe("backoff", () => {
  describe("calculateBackoff", () => {
    it("should return value within [0, baseDelay] for attempt 0", () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);

      const delay = calculateBackoff(0, DEFAULT_RECONNECT);
      expect(delay).toBe(500);

      vi.restoreAllMocks();
    });

    it("should grow exponentially with backoffFactor", () => {
      vi.spyOn(Math, "random").mockReturnValue(1);

      const d0 = calculateBackoff(0, DEFAULT_RECONNECT);
      const d1 = calculateBackoff(1, DEFAULT_RECONNECT);
      const d2 = calculateBackoff(2, DEFAULT_RECONNECT);

      expect(d0).toBe(1000);
      expect(d1).toBe(1500);
      expect(d2).toBe(2250);

      vi.restoreAllMocks();
    });

    it("should cap at maxDelay", () => {
      vi.spyOn(Math, "random").mockReturnValue(1);

      const delay = calculateBackoff(100, DEFAULT_RECONNECT);
      expect(delay).toBe(DEFAULT_RECONNECT.maxDelay);

      vi.restoreAllMocks();
    });
  });

  describe("parseRetryAfter", () => {
    it("should parse valid retryAfter JSON", () => {
      expect(parseRetryAfter('{"retryAfter":5000}')).toBe(5000);
    });

    it("should return null for non-JSON", () => {
      expect(parseRetryAfter("not json")).toBeNull();
    });

    it("should return null for missing retryAfter", () => {
      expect(parseRetryAfter('{"other":1}')).toBeNull();
    });

    it("should return null for non-positive retryAfter", () => {
      expect(parseRetryAfter('{"retryAfter":0}')).toBeNull();
      expect(parseRetryAfter('{"retryAfter":-1}')).toBeNull();
    });
  });
});
