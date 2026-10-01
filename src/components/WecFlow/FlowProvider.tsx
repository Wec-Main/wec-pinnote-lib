import { useMemo, useRef, useState, type ReactNode } from "react";
import { FlowEngine, type FlowEngineOptions } from "../../utils/flowchart/flowEngine";
import { FlowContext, type FlowContextValue } from "../../context/FlowContext";
import type { XYPosition } from "../../types/flowchart.types";

export interface FlowProviderProps extends FlowEngineOptions {
  engine?: FlowEngine;
  children: ReactNode;
}

export function FlowProvider({ engine, children, ...options }: FlowProviderProps) {
  const [instance] = useState(() => engine ?? new FlowEngine(options));
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const value = useMemo<FlowContextValue>(() => {
    const clientToCanvas = (p: XYPosition): XYPosition => {
      const rect = canvasRef.current?.getBoundingClientRect();
      return rect ? { x: p.x - rect.left, y: p.y - rect.top } : p;
    };
    return {
      engine: instance,
      canvasRef,
      clientToCanvas,
      clientToFlow: (p) => instance.screenToFlow(clientToCanvas(p)),
    };
  }, [instance]);

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}
