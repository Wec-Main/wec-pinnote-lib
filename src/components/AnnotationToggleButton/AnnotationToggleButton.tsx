import { useEffect, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";

export interface AnnotationToggleButtonProps {
  className?: string;
}

export function AnnotationToggleButton({ className }: AnnotationToggleButtonProps) {
  const { modeEnabled, setModeEnabled, config, activeAccount } = useAnnotationContext();
  const [nudge, setNudge] = useState(false);
  const loggedOut = !activeAccount;

  useEffect(() => {
    if (!loggedOut) {
      setNudge(false);
    }
  }, [loggedOut]);

  // Refusing the click shakes the button instead of appending a label, so the
  // toolbar never changes width; the tooltip already states why on hover.
  useEffect(() => {
    if (!nudge) {
      return;
    }
    const timer = window.setTimeout(() => setNudge(false), 400);
    return () => window.clearTimeout(timer);
  }, [nudge]);

  if (!config.enabled) {
    return null;
  }

  const label = loggedOut
    ? "Select your name to start annotating"
    : modeEnabled
      ? "Stop annotating"
      : "Annotate";

  return (
    <Tooltip label={label} placement="bottom">
      <button
        type="button"
        className={[
          "wpn-toggle",
          modeEnabled ? "wpn-toggle--active" : "",
          loggedOut ? "wpn-toggle--blocked" : "",
          nudge ? "wpn-toggle--nudge" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-pressed={modeEnabled}
        aria-disabled={loggedOut}
        aria-label={loggedOut ? "Log in to annotate" : "Toggle annotation mode"}
        onClick={() => {
          if (loggedOut) {
            setNudge(true);
            return;
          }
          setModeEnabled(!modeEnabled);
        }}
      >
        <Icon name="pen" className="wpn-toggle__icon" />
      </button>
    </Tooltip>
  );
}
