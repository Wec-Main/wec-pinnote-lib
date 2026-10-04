import { createContext, useContext, type MutableRefObject } from "react";
import { useStoreSelector } from "../../hooks/useStoreSelector";
import type { ErdEngine, ErdState } from "../../utils/erd/erdEngine";
import type { XYPosition } from "../../types/flowchart.types";

export interface ErdContextValue {
  engine: ErdEngine;
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  clientToFlow: (point: XYPosition) => XYPosition;
  clientToCanvas: (point: XYPosition) => XYPosition;
}

export const ErdContext = createContext<ErdContextValue | null>(null);

export function useErdContext(): ErdContextValue {
  const ctx = useContext(ErdContext);
  if (!ctx) throw new Error("ERD components must be rendered inside <ErdProvider>");
  return ctx;
}

export function useErdEngine(): ErdEngine {
  return useErdContext().engine;
}

export function useErdState<T>(
  selector: (state: ErdState) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const { engine } = useErdContext();
  return useStoreSelector(engine.store, selector, equalityFn);
}
