import {
  forwardRef,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  filterMentionCandidates,
  findMentionQuery,
  type MentionCandidate,
  type MentionQuery,
} from "../../utils/mentions";
import { getInitials } from "../../utils/format";

const MENU_LIMIT = 6;

export interface MentionTextareaHandle {
  focus: () => void;
  startMention: () => void;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  candidates: MentionCandidate[];
  className: string;
  ariaLabel: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  menuPlacement?: "above" | "below";
  onEnter?: () => void;
  onEscape?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const MentionTextarea = forwardRef<MentionTextareaHandle, MentionTextareaProps>(
  function MentionTextarea(
    {
      value,
      onChange,
      candidates,
      className,
      ariaLabel,
      placeholder,
      rows = 1,
      maxLength,
      autoFocus,
      menuPlacement = "above",
      onEnter,
      onEscape,
      onFocusChange,
    },
    ref,
  ) {
    const fieldRef = useRef<HTMLTextAreaElement>(null);
    const pendingCaret = useRef<number | null>(null);
    const [mention, setMention] = useState<MentionQuery | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const listboxId = useId();

    const matches = useMemo(
      () =>
        mention ? filterMentionCandidates(candidates, mention.query).slice(0, MENU_LIMIT) : [],
      [candidates, mention],
    );
    const menuOpen = mention !== null && matches.length > 0;

    useLayoutEffect(() => {
      const field = fieldRef.current;
      if (!field) {
        return;
      }
      field.style.height = "auto";
      field.style.height = `${field.scrollHeight}px`;
      if (pendingCaret.current !== null) {
        field.setSelectionRange(pendingCaret.current, pendingCaret.current);
        pendingCaret.current = null;
      }
    }, [value]);

    const syncMention = (text: string, caret: number) => {
      const next = findMentionQuery(text, caret);
      setMention(next);
      if (next?.query !== mention?.query) {
        setActiveIndex(0);
      }
    };

    const replaceRange = (start: number, end: number, insert: string) => {
      const next = value.slice(0, start) + insert + value.slice(end);
      if (maxLength !== undefined && next.length > maxLength) {
        return;
      }
      pendingCaret.current = start + insert.length;
      onChange(next);
    };

    const choose = (candidate: MentionCandidate) => {
      const field = fieldRef.current;
      if (!mention || !field) {
        return;
      }
      replaceRange(mention.start, field.selectionStart, `@${candidate.name} `);
      setMention(null);
    };

    useImperativeHandle(ref, () => ({
      focus: () => fieldRef.current?.focus(),
      startMention: () => {
        const field = fieldRef.current;
        if (!field) {
          return;
        }
        field.focus();
        const start = field.selectionStart;
        const needsSpace = start > 0 && !/\s/.test(value.charAt(start - 1));
        const insert = needsSpace ? " @" : "@";
        replaceRange(start, field.selectionEnd, insert);
        setMention({ start: start + insert.length - 1, query: "" });
        setActiveIndex(0);
      },
    }));

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) {
        return;
      }
      if (menuOpen) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const step = event.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((current) => (current + step + matches.length) % matches.length);
          return;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          event.preventDefault();
          const candidate = matches[activeIndex];
          if (candidate) {
            choose(candidate);
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setMention(null);
          return;
        }
      }
      if (event.key === "Enter" && !event.shiftKey && onEnter) {
        event.preventDefault();
        onEnter();
        return;
      }
      if (event.key === "Escape" && onEscape) {
        event.stopPropagation();
        onEscape();
      }
    };

    return (
      <div className="wpn-mention">
        <textarea
          ref={fieldRef}
          className={className}
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? listboxId : undefined}
          aria-activedescendant={menuOpen ? `${listboxId}-${activeIndex}` : undefined}
          onChange={(event) => {
            onChange(event.target.value);
            syncMention(event.target.value, event.target.selectionStart);
          }}
          onSelect={(event) =>
            syncMention(event.currentTarget.value, event.currentTarget.selectionStart)
          }
          onKeyDown={onKeyDown}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => {
            setMention(null);
            onFocusChange?.(false);
          }}
        />
        {menuOpen ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="Mention a person"
            className={`wpn-mention__menu wpn-mention__menu--${menuPlacement}`}
          >
            {matches.map((candidate, index) => (
              <li
                key={candidate.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "wpn-mention__option wpn-mention__option--active"
                    : "wpn-mention__option"
                }
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(candidate)}
              >
                {candidate.avatarUrl ? (
                  <img className="wpn-mention__avatar" src={candidate.avatarUrl} alt="" />
                ) : (
                  <span className="wpn-mention__avatar wpn-mention__avatar--fallback">
                    {getInitials(candidate.name)}
                  </span>
                )}
                <span className="wpn-mention__name">{candidate.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  },
);
