import { COMMENT_MAX_LENGTH } from "../../types/annotation.types";

const COUNTER_THRESHOLD = 0.8;

export function ComposerHint({ length }: { length: number }) {
  const showCounter = length >= COMMENT_MAX_LENGTH * COUNTER_THRESHOLD;
  return (
    <div className="wpn-composer-hint">
      <span>
        <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line · <kbd>@</kbd> to
        mention
      </span>
      {showCounter ? (
        <span
          className={
            length >= COMMENT_MAX_LENGTH
              ? "wpn-composer-hint__count wpn-composer-hint__count--limit"
              : "wpn-composer-hint__count"
          }
        >
          {length}/{COMMENT_MAX_LENGTH}
        </span>
      ) : null}
    </div>
  );
}
