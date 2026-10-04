import type { AuthSession } from "../../types/auth.types";

function readTokenPayload(token: string): Record<string, unknown> | undefined {
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
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function numericClaim(token: string, claim: string): number | undefined {
  const value = readTokenPayload(token)?.[claim];
  return typeof value === "number" ? value : undefined;
}

export function tokenExpiry(token: string): number | undefined {
  return numericClaim(token, "exp");
}

export function tokenIssuedAt(token: string): number | undefined {
  return numericClaim(token, "iat");
}

export function hasExpiry(token: string): boolean {
  return tokenExpiry(token) !== undefined;
}

export function isTokenUnexpired(token: string): boolean {
  const exp = tokenExpiry(token);
  return exp !== undefined && exp > Date.now() / 1000;
}

export function isSessionShape(value: unknown): value is AuthSession {
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
    hasExpiry(candidate.token) &&
    hasExpiry(candidate.refreshToken)
  );
}

export function isSession(value: unknown): value is AuthSession {
  return isSessionShape(value) && isTokenUnexpired(value.refreshToken);
}
