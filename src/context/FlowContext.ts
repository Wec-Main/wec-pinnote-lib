import { createContext, useContext, type MutableRefObject } from "react";
import { useStoreSelector } from "../hooks/useStoreSelector";
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
  return useStoreSelector(engine.store, selector, equalityFn);
}
