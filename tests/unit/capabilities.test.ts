import { describe, it, expect } from "vitest";
import {
  isCapabilitiesSignal,
  FULL_CAPABILITIES,
  DEFAULT_CAPABILITIES,
} from "../../src/protocol/capabilities";
import { BINARY_PREFIX } from "../../src/protocol/constants";

describe("capabilities", () => {
  describe("isCapabilitiesSignal", () => {
    it("should detect the capabilities signal from Uint8Array", () => {
      expect(isCapabilitiesSignal(BINARY_PREFIX.CAPABILITIES)).toBe(true);
    });

    it("should detect from ArrayBuffer", () => {
      const buf = new Uint8Array([0x1, 0x5, 0x0, 0x0]).buffer;
      expect(isCapabilitiesSignal(buf)).toBe(true);
    });

    it("should detect from message event shape", () => {
      const data = { data: new Uint8Array([0x1, 0x5, 0x0, 0x0]) };
      expect(isCapabilitiesSignal(data)).toBe(true);
    });

    it("should reject wrong bytes", () => {
      expect(isCapabilitiesSignal(new Uint8Array([0x1, 0x1, 0x0, 0x0]))).toBe(false);
    });

    it("should reject strings", () => {
      expect(isCapabilitiesSignal("not binary")).toBe(false);
    });

    it("should reject too short data", () => {
      expect(isCapabilitiesSignal(new Uint8Array([0x1, 0x5]))).toBe(false);
    });

    it("should reject too long data", () => {
      expect(isCapabilitiesSignal(new Uint8Array([0x1, 0x5, 0x0, 0x0, 0x1]))).toBe(false);
    });
  });

  describe("capability defaults", () => {
    it("should define full capabilities", () => {
      expect(FULL_CAPABILITIES.binary).toBe(true);
      expect(FULL_CAPABILITIES.customCloseCodes).toBe(true);
      expect(FULL_CAPABILITIES.ackFormat).toBe("binary");
    });

    it("should define constrained capabilities", () => {
      expect(DEFAULT_CAPABILITIES.binary).toBe(false);
      expect(DEFAULT_CAPABILITIES.customCloseCodes).toBe(false);
      expect(DEFAULT_CAPABILITIES.ackFormat).toBe("json");
    });
  });
});
