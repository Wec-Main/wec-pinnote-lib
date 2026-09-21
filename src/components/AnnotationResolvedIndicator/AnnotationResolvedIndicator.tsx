import type { AnnotationStatus } from "../../types/annotation.types";
import { statusLabel } from "../../utils/status";

interface AnnotationResolvedIndicatorProps {
  status: AnnotationStatus;
}

export function AnnotationResolvedIndicator({ status }: AnnotationResolvedIndicatorProps) {
  return (
    <span className={`wpn-status-chip wpn-tone--${status}`}>
      <span className="wpn-status__dot" />
      {statusLabel(status)}
    </span>
  );
}
