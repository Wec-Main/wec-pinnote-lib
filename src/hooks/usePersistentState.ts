import { useCallback, useEffect, useRef, useState } from "react";

function read<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures (private browsing, disabled storage, quota).
  }
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const validRef = useRef(isValid);
  validRef.current = isValid;

  const [value, setValue] = useState<T>(() => read(key, fallback, isValid));
  const keyRef = useRef(key);

  useEffect(() => {
    if (keyRef.current === key) {
      return;
    }
    keyRef.current = key;
    setValue(read(key, fallback, validRef.current));
  }, [fallback, key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );

  return [value, update];
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
