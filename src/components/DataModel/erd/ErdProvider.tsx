import { useMemo, useRef, useState, type ReactNode } from "react";
import { ErdEngine, type ErdEngineOptions } from "../../../utils/erd/erdEngine";
import { ErdContext, type ErdContextValue } from "../../../context/ErdContext";
import type { XYPosition } from "../../../types/flowchart.types";

export interface ErdProviderProps extends ErdEngineOptions {
  engine?: ErdEngine;
  children: ReactNode;
}

export function ErdProvider({ engine, children, ...options }: ErdProviderProps) {
  const [instance] = useState(() => engine ?? new ErdEngine(options));
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const value = useMemo<ErdContextValue>(() => {
    const clientToCanvas = (point: XYPosition): XYPosition => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return rect ? { x: point.x - rect.left, y: point.y - rect.top } : point;
    };
    return {
      engine: instance,
      canvasRef,
      clientToCanvas,
      clientToFlow: (point) => instance.screenToFlow(clientToCanvas(point)),
    };
  }, [instance]);

  return <ErdContext.Provider value={value}>{children}</ErdContext.Provider>;
}
