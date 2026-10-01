import { useEffect, useMemo, useRef } from "react";
import { useErdEngine } from "../../context/ErdContext";

export function useErdEditSession() {
  const engine = useErdEngine();
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
