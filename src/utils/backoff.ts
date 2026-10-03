export function withJitter(delayMs: number, random: () => number = Math.random): number {
  const half = delayMs / 2;
  return Math.round(half + random() * half);
}

export interface BackoffOptions {
  baseMs: number;
  maxMs: number;
}

export function computeBackoffDelay(attempt: number, { baseMs, maxMs }: BackoffOptions): number {
  return Math.min(baseMs * 2 ** attempt, maxMs);
}
