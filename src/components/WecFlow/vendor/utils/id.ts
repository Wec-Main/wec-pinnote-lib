/**
 * Generates a reasonably unique identifier string.
 *
 * Uses `crypto.randomUUID()` when available (modern browsers / Node 16.7+),
 * and falls back to a timestamp + random-based string for older
 * environments where that API is absent.
 *
 * @param prefix - Optional prefix. When provided, the id is formatted as
 *                 `${prefix}-${uuid}`; otherwise the raw uuid is returned.
 */
export function generateId(prefix?: string): string {
  const uuid = createUniquePart();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

function createUniquePart(): string {
  const globalCrypto = getCrypto();

  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }

  return fallbackId();
}

interface CryptoLike {
  randomUUID?: () => string;
}

function getCrypto(): CryptoLike | undefined {
  if (typeof globalThis !== "undefined") {
    const maybeCrypto = (globalThis as { crypto?: CryptoLike }).crypto;
    if (maybeCrypto) {
      return maybeCrypto;
    }
  }
  return undefined;
}

function fallbackId(): string {
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  const randomPart2 = Math.random().toString(36).slice(2, 10);
  return `${timePart}-${randomPart}-${randomPart2}`;
}
