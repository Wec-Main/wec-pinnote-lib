import { memo } from "react";
import { Icon } from "../primitives/Icon";
import type { AnnotationStatus } from "../../types/annotation.types";
import { isDoneStatus, statusLabel } from "../../utils/status";

interface AnnotationPinProps {
  id: string;
  number: number;
  status: AnnotationStatus;
  elementIdentifier?: string;
  commentsCount?: number;
  x: number;
  y: number;
  resolvedTarget: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

function AnnotationPinComponent({
  id,
  number,
  status,
  elementIdentifier,
  commentsCount,
  x,
  y,
  resolvedTarget,
  selected,
  onSelect,
}: AnnotationPinProps) {
  const classes = [
    "wpn-pin",
    `wpn-pin--${status}`,
    resolvedTarget ? "" : "wpn-pin--orphaned",
    selected ? "wpn-pin--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const label = [
    `Comment ${number}`,
    statusLabel(status),
    elementIdentifier ? `on ${elementIdentifier}` : null,
    typeof commentsCount === "number"
      ? `${commentsCount} ${commentsCount === 1 ? "reply" : "replies"}`
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      className={classes}
      style={{ left: x, top: y }}
      aria-label={selected ? `Close ${label}` : `Open ${label}`}
      onClick={() => onSelect(selected ? null : id)}
    >
      {isDoneStatus(status) ? (
        <span className="wpn-pin__check" aria-hidden="true">
          ✓
        </span>
      ) : (
        <Icon name="comment" className="wpn-pin__icon" />
      )}
    </button>
  );
}

export const AnnotationPin = memo(AnnotationPinComponent);
