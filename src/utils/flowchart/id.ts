let counter = 0;

const randomSuffix = (): string => {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID().replace(/-/g, "").slice(0, 12);
  if (globalCrypto?.getRandomValues) {
    const bytes = globalCrypto.getRandomValues(new Uint8Array(6));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2).padStart(10, "0").slice(0, 10);
};

export function createId(prefix = "id"): string {
  counter = (counter + 1) % 1296;
  return `${prefix}_${randomSuffix()}${counter.toString(36).padStart(2, "0")}`;
}
