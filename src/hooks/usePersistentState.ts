import { useCallback, useEffect, useRef, useState } from "react";
import { isBoolean, isNumber } from "../utils/valueGuards";

export { isBoolean, isNumber };

function read<T>(key: string, fallback: T, isValid: (value: unknown) => value is T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
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
    return;
  }
}

export function usePersistentState<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (value: T) => void] {
  const validRef = useRef(isValid);
  validRef.current = isValid;

  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    setValue(read(key, fallback, validRef.current));
  }, [fallback, key]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) {
        return;
      }
      setValue(read(key, fallback, validRef.current));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [fallback, key]);

  const update = useCallback(
    (next: T) => {
      setValue((current) => {
        if (current === next) {
          return current;
        }
        write(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, update];
}
