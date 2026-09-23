import type { AuthSession } from "../types/auth.types";

export function tokenExpiry(token: string): number | undefined {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return undefined;
  }
  const payloadSegment = segments[1];
  if (!payloadSegment) {
    return undefined;
  }
  try {
    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const json = atob(padded);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

export function hasExpiry(token: string): boolean {
  return tokenExpiry(token) !== undefined;
}

export function isTokenUnexpired(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp !== undefined && exp > Date.now() / 1000;
}

export function isSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<AuthSession>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    typeof candidate.roleId === "string" &&
    typeof candidate.token === "string" &&
    candidate.token.length > 0 &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.length > 0 &&
    isTokenUnexpired(candidate.token)
  );
}
