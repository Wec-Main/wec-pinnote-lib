import { useCallback, useMemo, useState } from "react";

export type AiDockBadge = "running" | "proposal" | null;
export type AiDockMode = "compact" | "expanded" | "maximized" | "custom";

export type AiWorkPhase = "running" | "done" | "stopped" | "failed";

export interface AiWorkInfo {
  phase: AiWorkPhase;
  noun: "flow" | "data model";
  label: string;
  changes: number;
  onStop?: () => void;
  onOpenChat?: () => void;
}

export interface AiDockLayout {
  mode: AiDockMode;
  height: number | null;
}

export interface AiDockControl {
  open: boolean;
  focusSignal: number;
  badge: AiDockBadge;
  work: AiWorkInfo | null;
  setWork: (work: AiWorkInfo | null) => void;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  setBadge: (badge: AiDockBadge) => void;
}

export function useAiDockControl(initialOpen = false): AiDockControl {
  const [open, setOpen] = useState(initialOpen);
  const [focusSignal, setFocusSignal] = useState(initialOpen ? 1 : 0);
  const [badge, setBadge] = useState<AiDockBadge>(null);
  const [work, setWorkState] = useState<AiWorkInfo | null>(null);
  const setWork = useCallback((next: AiWorkInfo | null) => {
    setWorkState((current) => {
      if (current === next) return current;
      if (
        current &&
        next &&
        current.phase === next.phase &&
        current.noun === next.noun &&
        current.label === next.label &&
        current.changes === next.changes
      ) {
        return current;
      }
      return next;
    });
  }, []);
  return useMemo(
    () => ({
      open,
      focusSignal,
      badge,
      work,
      setWork,
      show: () => {
        setOpen(true);
        setFocusSignal((value) => value + 1);
      },
      hide: () => setOpen(false),
      toggle: () => {
        setOpen((current) => !current);
        setFocusSignal((value) => value + 1);
      },
      setBadge,
    }),
    [open, focusSignal, badge, work, setWork],
  );
}

const LAYOUT_KEY = "wpn-ai-dock-layout-v3";
const MODES: readonly AiDockMode[] = ["compact", "expanded", "maximized", "custom"];

export const DEFAULT_AI_DOCK_LAYOUT: AiDockLayout = { mode: "compact", height: null };

export function loadAiDockLayout(kind: string): AiDockLayout {
  try {
    const raw = window.localStorage.getItem(`${LAYOUT_KEY}:${kind}`);
    if (!raw) return DEFAULT_AI_DOCK_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<AiDockLayout>;
    if (!parsed.mode || !MODES.includes(parsed.mode)) return DEFAULT_AI_DOCK_LAYOUT;
    const height =
      typeof parsed.height === "number" && Number.isFinite(parsed.height) ? parsed.height : null;
    if (parsed.mode === "custom" && height === null) return DEFAULT_AI_DOCK_LAYOUT;
    return { mode: parsed.mode, height };
  } catch {
    return DEFAULT_AI_DOCK_LAYOUT;
  }
}

export function saveAiDockLayout(kind: string, layout: AiDockLayout): void {
  try {
    window.localStorage.setItem(`${LAYOUT_KEY}:${kind}`, JSON.stringify(layout));
  } catch {
    return;
  }
}
