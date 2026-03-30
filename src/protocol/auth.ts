import type { WebSocketLike } from "../interfaces";
import type { AuthConfig } from "../types";
import { getBoolean, getRecord, getString } from "./parse";

export type AuthCallbacks = {
  onSuccess: (userInfo?: Record<string, unknown>) => void;
  onFailure: (error: Error) => void;
};

export class AuthManager {
  private config: AuthConfig;
  private callbacks: AuthCallbacks;

  constructor(config: AuthConfig, callbacks: AuthCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  async sendAuthMessage(ws: WebSocketLike, routeKey: string): Promise<void> {
    if (this.config.strategy !== "authMessage") return;

    const token = await this.resolveToken();
    const message = JSON.stringify({
      [routeKey]: "authenticate",
      data: { token },
    });
    ws.send(message);
  }

  handleAuthResponse(parsed: Record<string, unknown>): void {
    const data = getRecord(parsed, "data");
    if (getBoolean(data ?? {}, "success") === true) {
      const userInfo = data ? getRecord(data, "userInfo") : undefined;
      this.callbacks.onSuccess(userInfo);
    } else {
      const message = (data ? getString(data, "message") : undefined) ?? "Authentication failed";
      this.callbacks.onFailure(new Error(message));
    }
  }

  async resolveToken(): Promise<string | undefined> {
    if (!("token" in this.config) || this.config.token === undefined) {
      return undefined;
    }
    if (typeof this.config.token === "function") {
      return this.config.token();
    }
    return this.config.token;
  }

  async resolveConnectHeaders(): Promise<Record<string, string> | undefined> {
    if (this.config.strategy !== "connect") return undefined;

    const token = await this.resolveToken();
    if (!token) return undefined;

    const headerName = this.config.headerName ?? "Authorization";
    const prefix = this.config.headerPrefix === undefined ? "Bearer" : this.config.headerPrefix;
    const headerValue = prefix ? `${prefix} ${token}` : token;

    return { [headerName]: headerValue };
  }
}
