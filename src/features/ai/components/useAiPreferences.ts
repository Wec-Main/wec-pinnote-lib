import { useCallback, useEffect, useState } from "react";
import { isKnownProviderId } from "../providerRegistry";
import { usePersistentState } from "../../../hooks/usePersistentState";
import type { AiRoutePreference } from "./aiHelpers";

const NO_PREFERENCE: AiRoutePreference = { provider: null, model: null, effort: null };
const DEFAULTS_KEY = "wpn-ai:defaults";

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

function isRoutePreference(value: unknown): value is AiRoutePreference {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.provider === null ||
      (typeof candidate.provider === "string" && isKnownProviderId(candidate.provider))) &&
    isNullableString(candidate.model) &&
    isNullableString(candidate.effort)
  );
}

export function useAiDefaults(): [AiRoutePreference, (next: AiRoutePreference) => void] {
  return usePersistentState(DEFAULTS_KEY, NO_PREFERENCE, isRoutePreference);
}

export function useNow(active: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

export function useCountdown(iso: string | null | undefined): number | null {
  const target = iso ? Date.parse(iso) : NaN;
  const now = useNow(Number.isFinite(target));
  return Number.isFinite(target) ? Math.max(0, target - now) : null;
}

export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = useCallback((text: string) => {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard) return;
    clipboard.writeText(text).then(
      () => setCopied(true),
      () => undefined,
    );
  }, []);
  return [copied, copy];
}
