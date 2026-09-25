import { useMemo, useRef, useState, type ReactNode } from "react";
import { FlowEngine, type FlowEngineOptions } from "../../utils/flowchart/flowEngine";
import { FlowContext, type FlowContextValue } from "../../context/FlowContext";
import type { XYPosition } from "../../types/flowchart.types";

export interface FlowProviderProps extends FlowEngineOptions {
  /** Use an existing engine (e.g. one created with `createFlowEngine`). Options are ignored then. */
  engine?: FlowEngine;
  children: ReactNode;
}

/**
 * Makes a FlowEngine available to every flow component and hook below it.
 * Lets you compose your own layout from FlowCanvas, Sidebar, Toolbar, etc.
 */
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
