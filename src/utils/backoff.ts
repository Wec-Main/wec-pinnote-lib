export function withJitter(delayMs: number, random: () => number = Math.random): number {
  const half = delayMs / 2;
  return Math.round(half + random() * half);
}
