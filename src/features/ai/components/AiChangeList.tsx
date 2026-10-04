import { CHANGE_MARKS, type AiChangeLine } from "./aiOpChanges";

interface AiChangeListProps {
  lines: readonly AiChangeLine[];
  excluded?: ReadonlySet<number>;
  onToggle?: (opIndex: number) => void;
  disabled?: boolean;
  defaultOpen?: boolean;
}

export function AiChangeList({
  lines,
  excluded,
  onToggle,
  disabled,
  defaultOpen,
}: AiChangeListProps) {
  if (lines.length === 0) return null;
  const selectable = Boolean(onToggle);
  const ops = new Set(lines.map((line) => line.opIndex).filter((index) => index !== undefined));
  const selected = selectable ? [...ops].filter((index) => !excluded?.has(index)).length : null;
  const seen = new Set<number>();
  return (
    <details className="wpn-ai-changelist" open={defaultOpen}>
      <summary>
        {lines.length} {lines.length === 1 ? "change" : "changes"}
        {selected !== null && selected !== ops.size ? ` · ${selected} selected` : ""}
      </summary>
      <ul className="wpn-ai-changelist__items">
        {lines.map((line, index) => {
          const opIndex = line.opIndex;
          const first = opIndex !== undefined && !seen.has(opIndex);
          if (opIndex !== undefined) seen.add(opIndex);
          const off = opIndex !== undefined && excluded?.has(opIndex);
          return (
            <li
              key={`${opIndex ?? "x"}-${index}`}
              className={`wpn-ai-changelist__item${off ? " wpn-ai-changelist__item--off" : ""}`}
            >
              {selectable && opIndex !== undefined ? (
                <input
                  type="checkbox"
                  className="wpn-ai-changelist__check"
                  checked={!off}
                  disabled={disabled || !first}
                  aria-label={`Include ${line.subject}`}
                  onChange={() => onToggle?.(opIndex)}
                />
              ) : null}
              <span
                className={`wpn-ai-batch__mark wpn-ai-batch__mark--${line.kind}`}
                aria-hidden="true"
              >
                {CHANGE_MARKS[line.kind]}
              </span>
              <span className="wpn-sr-only">
                {line.kind === "add" ? "Add" : line.kind === "remove" ? "Remove" : "Change"}
              </span>
              <span>{line.subject}</span>
              {line.detail ? <span className="wpn-ai-muted">{line.detail}</span> : null}
              {line.before !== undefined && line.after !== undefined ? (
                <span className="wpn-ai-muted">
                  {line.before} → {line.after}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
