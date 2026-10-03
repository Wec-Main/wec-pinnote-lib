import { useEffect, useRef, useState } from "react";

export const SKELETON_DELAY_MS = 120;
export const SKELETON_MIN_MS = 300;

export interface SkeletonGateOptions {
  delayMs?: number;
  minMs?: number;
}

export function remainingSkeletonMs(shownAt: number, now: number, minMs: number): number {
  return Math.max(0, minMs - (now - shownAt));
}

export function useSkeletonGate(
  pending: boolean,
  { delayMs = SKELETON_DELAY_MS, minMs = SKELETON_MIN_MS }: SkeletonGateOptions = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (pending) {
      if (visible) return undefined;
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }
    if (!visible) return undefined;
    const timer = setTimeout(
      () => setVisible(false),
      remainingSkeletonMs(shownAt.current, Date.now(), minMs),
    );
    return () => clearTimeout(timer);
  }, [pending, visible, delayMs, minMs]);

  return visible;
}
