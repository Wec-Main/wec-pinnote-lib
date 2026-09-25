import { useEffect, useMemo, useRef } from "react";
import { useFlowEngine } from "../../context/FlowContext";

/**
 * Focus/blur handlers that group all edits made while a form field is focused
 * into a single undo step (instead of one step per keystroke).
 */
export function useEditSession() {
  const engine = useFlowEngine();
  const active = useRef(false);
  useEffect(
    () => () => {
      if (active.current) engine.endInteraction();
    },
    [engine],
  );
  return useMemo(
    () => ({
      onFocus: () => {
        if (active.current) return;
        active.current = true;
        engine.beginInteraction();
      },
      onBlur: () => {
        if (!active.current) return;
        active.current = false;
        engine.endInteraction();
      },
    }),
    [engine],
  );
}
