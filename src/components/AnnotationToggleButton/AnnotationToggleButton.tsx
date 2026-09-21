import { useEffect, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import penIcon from "../../assets/pen_icon.png?inline";

export interface AnnotationToggleButtonProps {
  className?: string;
}

export function AnnotationToggleButton({ className }: AnnotationToggleButtonProps) {
  const { modeEnabled, setModeEnabled, config, authorName } = useAnnotationContext();
  const [nameError, setNameError] = useState(false);
  const nameMissing = !authorName.trim();

  useEffect(() => {
    if (!nameMissing) {
      setNameError(false);
    }
  }, [nameMissing]);

  if (!config.enabled) {
    return null;
  }

  return (
    <>
    <button
      type="button"
      className={[
        "wpn-toggle",
        modeEnabled ? "wpn-toggle--active" : "",
        nameMissing ? "wpn-toggle--blocked" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={modeEnabled}
      aria-disabled={nameMissing}
      aria-label={modeEnabled ? "Disable annotation mode" : "Enable annotation mode"}
      onClick={() => {
        if (nameMissing) {
          setNameError(true);
          return;
        }
        setModeEnabled(!modeEnabled);
      }}
    >
      <img src={penIcon} alt="" className="wpn-toggle__icon" />
    </button>
    {nameError ? <span className="wpn-toolbar__name-error">Enter your name</span> : null}
    </>
  );
}
