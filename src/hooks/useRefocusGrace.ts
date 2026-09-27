import { useEffect, useRef, useState } from "react";

const GRACE_DURATION_MS = 5000;
const TICK_INTERVAL_MS = 200;

export function useRefocusGrace(active: boolean): number {
  const [remainingMs, setRemainingMs] = useState(0);
  const wasBlurredRef = useRef(false);
  const deadlineRef = useRef(0);
  const intervalRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setRemainingMs(0);
      wasBlurredRef.current = false;
      window.clearInterval(intervalRef.current);
      return;
    }

    const stopTicking = () => {
      window.clearInterval(intervalRef.current);
      intervalRef.current = 0;
    };

    const tick = () => {
      const left = deadlineRef.current - Date.now();
      if (left <= 0) {
        setRemainingMs(0);
        stopTicking();
        return;
      }
      setRemainingMs(left);
    };

    const onBlur = () => {
      wasBlurredRef.current = true;
    };

    const onFocus = () => {
      if (!wasBlurredRef.current) {
        return;
      }
      wasBlurredRef.current = false;
      deadlineRef.current = Date.now() + GRACE_DURATION_MS;
      stopTicking();
      tick();
      intervalRef.current = window.setInterval(tick, TICK_INTERVAL_MS);
    };

    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      stopTicking();
    };
  }, [active]);

  return remainingMs;
}
