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
  /** The canvas DOM element; used to convert client coordinates to flow coordinates. */
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  /** Converts a client (viewport) pointer position to flow coordinates. */
  clientToFlow: (point: XYPosition) => XYPosition;
  /** Converts a client pointer position to canvas-relative screen coordinates. */
  clientToCanvas: (point: XYPosition) => XYPosition;
}

export const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlowContext(): FlowContextValue {
  const ctx = useContext(FlowContext);
  if (!ctx)
    throw new Error("Flow components must be rendered inside <FlowProvider> or <FlowEditor>");
  return ctx;
}

/** The FlowEngine of the surrounding provider: call its methods to change the flow. */
export function useFlowEngine(): FlowEngine {
  return useFlowContext().engine;
}

/**
 * Subscribes to a slice of the flow state. The component re-renders only when
 * `equalityFn(previous, next)` is false.
 */
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
