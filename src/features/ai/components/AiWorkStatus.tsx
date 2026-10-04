import { createPortal } from "react-dom";
import type { AiDockControl } from "../aiDockState";
import { Icon } from "../../../components/primitives/Icon";
import { AiThinkingMark } from "./AiThinking";
import { useAiWorkSlot } from "./AiWorkSlot";

const noun = (value: "flow" | "data model") => value.charAt(0).toUpperCase() + value.slice(1);

export function AiWorkStatus({
  control,
  compact = false,
}: {
  control: AiDockControl;
  compact?: boolean;
}) {
  const { work } = control;
  if (!work) return null;
  const running = work.phase === "running";
  const title = running
    ? `AI is building your ${work.noun}`
    : work.phase === "done"
      ? `${noun(work.noun)} creation completed`
      : work.phase === "stopped"
        ? `${noun(work.noun)} creation stopped`
        : `${noun(work.noun)} creation failed`;
  return (
    <div
      className={`wpn-ai-work wpn-ai-work--${work.phase}${compact ? " wpn-ai-work--compact" : ""}`}
      role="status"
      aria-live="polite"
    >
      {running ? (
        <AiThinkingMark className="wpn-ai-work__mark" provider={work.provider} />
      ) : (
        <span className={`wpn-ai-work__badge wpn-ai-work__badge--${work.phase}`} aria-hidden="true">
          <Icon name={work.phase === "done" ? "check" : "x"} />
        </span>
      )}
      <span className="wpn-ai-work__text">
        <span className="wpn-ai-work__title">{title}</span>
        <span className="wpn-ai-work__detail">
          {running ? <span className="wpn-ai-shimmer">{work.label}</span> : work.label}
        </span>
      </span>
      {work.changes > 0 ? (
        <span className="wpn-ai-work__count">
          {work.changes} {work.changes === 1 ? "change" : "changes"}
        </span>
      ) : null}
      {running && !compact ? (
        <span className="wpn-ai-work__hint">View only until AI finishes</span>
      ) : null}
      {running && work.onStop ? (
        <button type="button" className="wpn-ai-work__btn" onClick={work.onStop}>
          <Icon name="stop" className="wpn-btn__icon" />
          Stop
        </button>
      ) : null}
      {!running && !compact && work.onOpenChat ? (
        <button type="button" className="wpn-ai-work__btn" onClick={work.onOpenChat}>
          Review
        </button>
      ) : null}
    </div>
  );
}

export function AiWorkRow({ control }: { control: AiDockControl }) {
  const slot = useAiWorkSlot();
  if (!control.work) return null;
  if (slot) return createPortal(<AiWorkStatus control={control} compact />, slot);
  if (control.open) return null;
  return (
    <div className="wpn-ai-work-row">
      <AiWorkStatus control={control} />
    </div>
  );
}
