import { useEffect, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";

export interface AnnotationToggleButtonProps {
  className?: string;
}

export function AnnotationToggleButton({ className }: AnnotationToggleButtonProps) {
  const { modeEnabled, setModeEnabled, config, activeAccount } = useAnnotationContext();
  const [loginError, setLoginError] = useState(false);
  const loggedOut = !activeAccount;

  useEffect(() => {
    if (!loggedOut) {
      setLoginError(false);
    }
  }, [loggedOut]);

  if (!config.enabled) {
    return null;
  }

  return (
    <>
      <Tooltip
        label={
          loggedOut
            ? "Log in first"
            : modeEnabled
              ? "Stop annotating"
              : "Annotate"
        }
        placement="bottom"
      >
        <button
          type="button"
          className={[
            "wpn-toggle",
            modeEnabled ? "wpn-toggle--active" : "",
            loggedOut ? "wpn-toggle--blocked" : "",
            className ?? "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-pressed={modeEnabled}
          aria-disabled={loggedOut}
          aria-label={modeEnabled ? "Disable annotation mode" : "Enable annotation mode"}
          onClick={() => {
            if (loggedOut) {
              setLoginError(true);
              return;
            }
            setModeEnabled(!modeEnabled);
          }}
        >
          <Icon name="pen" className="wpn-toggle__icon" />
        </button>
      </Tooltip>
      {loginError ? <span className="wpn-toolbar__name-error">Log in to annotate</span> : null}
    </>
  );
}
