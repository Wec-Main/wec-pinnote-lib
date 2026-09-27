import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
} from "react";
import type { FlowEngine, FlowState } from "../utils/flowchart/flowEngine";
import type { XYPosition } from "../types/flowchart.types";

export interface FlowContextValue {
  engine: FlowEngine;

  canvasRef: MutableRefObject<HTMLDivElement | null>;

  clientToFlow: (point: XYPosition) => XYPosition;

  clientToCanvas: (point: XYPosition) => XYPosition;
}

export const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlowContext(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx)
    throw new Error("Flow components must be rendered inside <FlowProvider> or <FlowEditor>");
  return ctx;
}

export function useFlowEngine(): FlowEngine {
  return useFlowContext().engine;
}

export function useFlowState<T>(
  selector: (state: FlowState) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const { engine } = useFlowContext();
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = () => {
    const next = selector(engine.store.getState());
    if (cache.current && equalityFn(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  };
  return useSyncExternalStore(engine.store.subscribe, getSnapshot, getSnapshot);
}
