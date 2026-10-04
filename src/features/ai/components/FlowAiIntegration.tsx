import { Suspense, useEffect } from "react";
import { useFlowEngine } from "../../flowchart/FlowContext";
import type { FlowEngine } from "../../../utils/flowchart/flowEngine";
import {
  getLazyFlowAiDockHost,
  resetLazyAiDockHosts,
  useAiDockMounted,
  usePrefetchAiDockOnMount,
} from "./aiDockLoader";
import { AiDockBoundary, AiDockSkeleton } from "./AiDockBoundary";
import type { FlowAiBarProps } from "./FlowAiDockHost";
import { useAiAvailable } from "./IntegrationsButton";

export type { FlowAiBarProps } from "./FlowAiDockHost";

export function FlowEngineReporter({
  onEngine,
}: {
  onEngine: (engine: FlowEngine | null) => void;
}) {
  const engine = useFlowEngine();
  useEffect(() => {
    onEngine(engine);
    return () => onEngine(null);
  }, [engine, onEngine]);
  return null;
}

export function FlowAiBar(props: FlowAiBarProps) {
  const available = useAiAvailable();
  usePrefetchAiDockOnMount(available, "flow");
  const mounted = useAiDockMounted("flow", props.flowId, props.control, available);
  if (!mounted) return null;
  const Host = getLazyFlowAiDockHost();
  return (
    <AiDockBoundary onRetry={resetLazyAiDockHosts}>
      <Suspense fallback={<AiDockSkeleton open={props.control.open} />}>
        <Host {...props} />
      </Suspense>
    </AiDockBoundary>
  );
}
