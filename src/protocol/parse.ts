export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" ? value : undefined;
}

export function getRecord(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = obj[key];
  return isRecord(value) ? value : undefined;
}

export function getBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const value = obj[key];
  return typeof value === "boolean" ? value : undefined;
}

export function parseJsonPayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
