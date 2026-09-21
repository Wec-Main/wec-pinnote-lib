import type { Annotation } from "../../types/annotation.types";
import { isDoneStatus } from "../../utils/status";

interface AnnotationPinProps {
  annotation: Pick<Annotation, "id" | "number" | "status">;
  x: number;
  y: number;
  resolvedTarget: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

export function AnnotationPin({
  annotation,
  x,
  y,
  resolvedTarget,
  selected,
  onSelect,
}: AnnotationPinProps) {
  const classes = [
    "wpn-pin",
    `wpn-pin--${annotation.status}`,
    resolvedTarget ? "" : "wpn-pin--orphaned",
    selected ? "wpn-pin--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      style={{ left: x, top: y }}
      aria-label={selected ? "Close comment" : "Open comment"}
      onClick={() => onSelect(selected ? null : annotation.id)}
    >
      {isDoneStatus(annotation.status) ? (
        <span className="wpn-pin__check" aria-hidden="true">
          ✓
        </span>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="wpn-pin__icon">
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 19 18H8.5L4.5 21.5V6.5A1.5 1.5 0 0 1 6 5Z"
          />
        </svg>
      )}
    </button>
  );
}
