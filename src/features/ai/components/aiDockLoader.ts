import { lazy, useEffect, useState } from "react";
import type { AiDockControl } from "../aiDockState";
import { prefetchOpsRunners } from "../opBatchApplier";
import type { AiEditorTargetKind } from "../../../types/ai.types";
import { aiEditorRequests } from "./aiEditorRequests";

const prefetched = new Set<string>();

const loadErdHost = () => import("./ErdAiDockHost");
const loadFlowHost = () => import("./FlowAiDockHost");

const makeErdHost = () =>
  lazy(() => loadErdHost().then((module) => ({ default: module.ErdAiDockHost })));
const makeFlowHost = () =>
  lazy(() => loadFlowHost().then((module) => ({ default: module.FlowAiDockHost })));

let erdHost = makeErdHost();
let flowHost = makeFlowHost();

export const getLazyErdAiDockHost = () => erdHost;
export const getLazyFlowAiDockHost = () => flowHost;

export function resetLazyAiDockHosts(): void {
  erdHost = makeErdHost();
  flowHost = makeFlowHost();
  prefetched.clear();
}

export function prefetchAiDock(kind?: AiEditorTargetKind): void {
  const key = kind ?? "any";
  if (prefetched.has(key)) return;
  prefetched.add(key);
  const loading =
    kind === "data_model"
      ? loadErdHost()
      : kind === "flow"
        ? loadFlowHost()
        : import("./AiEditorDock");
  loading.catch(() => prefetched.delete(key));
  prefetchOpsRunners();
}

export function usePrefetchAiDockOnMount(enabled: boolean, kind?: AiEditorTargetKind): void {
  useEffect(() => {
    if (enabled && typeof window !== "undefined") prefetchAiDock(kind);
  }, [enabled, kind]);
}

export function useAiDockMounted(
  kind: AiEditorTargetKind,
  targetId: string,
  control: AiDockControl,
  enabled: boolean,
): boolean {
  const [everWanted, setEverWanted] = useState(false);
  const [requested, setRequested] = useState(() => aiEditorRequests.peek(kind, targetId) !== null);
  useEffect(
    () =>
      aiEditorRequests.subscribe(() => {
        if (aiEditorRequests.peek(kind, targetId)) setRequested(true);
      }),
    [kind, targetId],
  );
  const wanted = enabled && (control.open || control.badge !== null || requested);
  useEffect(() => {
    if (wanted) setEverWanted(true);
  }, [wanted]);
  const mounted = enabled && (everWanted || wanted);
  const { show } = control;
  useEffect(() => {
    if (!enabled || mounted) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "i") return;
      const target = event.target as Node | null;
      const stage = target instanceof Element ? target.closest(".wpn-flow-stage") : null;
      if (kind === "flow" && !stage && target !== document.body) return;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      show();
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [enabled, kind, mounted, show]);
  return mounted;
}
