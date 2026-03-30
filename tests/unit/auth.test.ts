import { describe, it, expect, vi } from "vitest";
import { AuthManager } from "../../src/protocol/auth";
import type { AuthCallbacks } from "../../src/protocol/auth";
import type { WebSocketLike } from "../../src/interfaces";

function mockWs(): WebSocketLike {
  return {
    readyState: vi.fn().mockReturnValue(1),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
    send: vi.fn(),
    close: vi.fn(),
  };
}

function mockCallbacks(): AuthCallbacks {
  return { onSuccess: vi.fn(), onFailure: vi.fn() };
}

describe("AuthManager", () => {
  describe("sendAuthMessage", () => {
    it("should send auth message for authMessage strategy", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "tok123" }, cb);
      const ws = mockWs();

      await mgr.sendAuthMessage(ws, "event");

      expect(ws.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(vi.mocked(ws.send).mock.calls[0][0] as string);
      expect(sent).toEqual({ event: "authenticate", data: { token: "tok123" } });
    });

    it("should use custom route key", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "t" }, cb);
      const ws = mockWs();

      await mgr.sendAuthMessage(ws, "action");

      const sent = JSON.parse(vi.mocked(ws.send).mock.calls[0][0] as string);
      expect(sent.action).toBe("authenticate");
    });

    it("should resolve async token", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: async () => "async-tok" }, cb);
      const ws = mockWs();

      await mgr.sendAuthMessage(ws, "event");

      const sent = JSON.parse(vi.mocked(ws.send).mock.calls[0][0] as string);
      expect(sent.data.token).toBe("async-tok");
    });

    it("should be a no-op for connect strategy", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "connect" }, cb);
      const ws = mockWs();

      await mgr.sendAuthMessage(ws, "event");

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe("handleAuthResponse", () => {
    it("should call onSuccess with userInfo on success", () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "t" }, cb);

      mgr.handleAuthResponse({
        event: "authenticated",
        data: { success: true, userInfo: { id: "1" }, message: "ok" },
      });

      expect(cb.onSuccess).toHaveBeenCalledWith({ id: "1" });
    });

    it("should call onSuccess with undefined when no userInfo", () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "t" }, cb);

      mgr.handleAuthResponse({ event: "authenticated", data: { success: true } });

      expect(cb.onSuccess).toHaveBeenCalledWith(undefined);
    });

    it("should call onFailure with message on failure", () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "t" }, cb);

      mgr.handleAuthResponse({
        event: "authenticated",
        data: { success: false, message: "bad token" },
      });

      expect(cb.onFailure).toHaveBeenCalledOnce();
      expect(vi.mocked(cb.onFailure).mock.calls[0][0].message).toBe("bad token");
    });

    it("should use default message when none provided", () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "t" }, cb);

      mgr.handleAuthResponse({ event: "authenticated", data: { success: false } });

      expect(vi.mocked(cb.onFailure).mock.calls[0][0].message).toBe("Authentication failed");
    });
  });

  describe("resolveConnectHeaders", () => {
    it("should return Authorization Bearer header by default", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "connect", token: "my-jwt" }, cb);

      const headers = await mgr.resolveConnectHeaders();

      expect(headers).toEqual({ Authorization: "Bearer my-jwt" });
    });

    it("should use custom header name", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "connect", token: "t", headerName: "X-Auth" }, cb);

      const headers = await mgr.resolveConnectHeaders();

      expect(headers).toEqual({ "X-Auth": "Bearer t" });
    });

    it("should support null prefix for raw token", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager(
        { strategy: "connect", token: "raw-tok", headerPrefix: null },
        cb,
      );

      const headers = await mgr.resolveConnectHeaders();

      expect(headers).toEqual({ Authorization: "raw-tok" });
    });

    it("should return undefined for browser connect (no token)", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "connect" }, cb);

      const headers = await mgr.resolveConnectHeaders();

      expect(headers).toBeUndefined();
    });

    it("should return undefined for authMessage strategy", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "authMessage", token: "t" }, cb);

      const headers = await mgr.resolveConnectHeaders();

      expect(headers).toBeUndefined();
    });
  });

  describe("resolveToken", () => {
    it("should return undefined when no token configured", async () => {
      const cb = mockCallbacks();
      const mgr = new AuthManager({ strategy: "connect" }, cb);

      expect(await mgr.resolveToken()).toBeUndefined();
    });
  });
});
