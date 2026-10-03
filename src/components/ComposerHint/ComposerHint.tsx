import { useState } from "react";
import { COMMENT_MAX_LENGTH } from "../../types/annotation.types";
import { Icon } from "../primitives";

const COUNTER_THRESHOLD = 0.8;

interface ComposerHintProps {
  length: number;
}

export function ComposerHint({ length }: ComposerHintProps) {
  const showCounter = length >= COMMENT_MAX_LENGTH * COUNTER_THRESHOLD;
  if (!showCounter) {
    return null;
  }
  return (
    <div className="wpn-composer-hint">
      <span
        className={
          length >= COMMENT_MAX_LENGTH
            ? "wpn-composer-hint__count wpn-composer-hint__count--limit"
            : "wpn-composer-hint__count"
        }
      >
        {length}/{COMMENT_MAX_LENGTH}
      </span>
    </div>
  );
}

interface ComposerHintInfoProps {
  showMentionHint?: boolean;
}

export function ComposerHintInfo({ showMentionHint = true }: ComposerHintInfoProps) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="wpn-thread-panel__info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="wpn-link wpn-link--icon"
        aria-label="Composer shortcuts"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Icon name="info" className="wpn-action-icon" />
      </button>
      {open ? (
        <span className="wpn-thread-panel__info-popover" role="tooltip">
          <span>
            <kbd>Enter</kbd> to send
          </span>
          <span>
            <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
          </span>
          {showMentionHint ? (
            <span>
              <kbd>@</kbd> to mention
            </span>
          ) : null}
          {showMentionHint ? (
            <span>
              <kbd>#</kbd> to tag epic, flow, data model
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
