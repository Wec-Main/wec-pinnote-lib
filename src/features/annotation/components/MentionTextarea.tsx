import {
  forwardRef,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnnotationDataContext } from "../../../context/AnnotationContext";
import { caretPosition } from "../../../utils/dom/caretPosition";
import {
  REFERENCE_KIND_LABELS,
  filterMentionCandidates,
  filterReferenceCandidates,
  findMentionQuery,
  type MentionCandidate,
  type MentionQuery,
  type MentionTrigger,
  type ReferenceCandidate,
} from "../../../utils/mentions";
import { getInitials } from "../../../utils/format";
import { ReferenceIcon } from "./CommentMessage";

const MENU_LIMIT = 6;
const NO_REFERENCES: ReferenceCandidate[] = [];
const MENU_GAP = 4;
const VIEWPORT_MARGIN = 8;
const HIDDEN_MENU: CSSProperties = { top: 0, left: 0, visibility: "hidden" };

function useCaretMenuStyle(
  fieldRef: RefObject<HTMLTextAreaElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  anchorIndex: number | null,
  layoutKey: unknown,
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(HIDDEN_MENU);

  useLayoutEffect(() => {
    if (anchorIndex === null) {
      setStyle(HIDDEN_MENU);
      return;
    }
    const place = () => {
      const field = fieldRef.current;
      const menu = menuRef.current;
      if (!field || !menu) {
        return;
      }
      const fieldRect = field.getBoundingClientRect();
      const caret = caretPosition(field, anchorIndex);
      const lineTop = fieldRect.top + caret.top;
      const lineBottom = lineTop + caret.lineHeight;
      const { width, height } = menu.getBoundingClientRect();
      const fitsBelow = lineBottom + MENU_GAP + height <= window.innerHeight - VIEWPORT_MARGIN;
      const fitsAbove = lineTop - MENU_GAP - height >= VIEWPORT_MARGIN;
      const top = fitsBelow || !fitsAbove ? lineBottom + MENU_GAP : lineTop - MENU_GAP - height;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, fieldRect.left + caret.left),
        window.innerWidth - VIEWPORT_MARGIN - width,
      );
      setStyle({ top, left: Math.max(VIEWPORT_MARGIN, left) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorIndex, fieldRef, layoutKey, menuRef]);

  return style;
}

export interface MentionTextareaHandle {
  focus: () => void;
  startMention: () => void;
  startReference: () => void;
}

type MenuItem =
  | { type: "person"; key: string; candidate: MentionCandidate }
  | { type: "reference"; key: string; reference: ReferenceCandidate };

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
  onEnter?: () => void;
  onEscape?: () => void;
  onFocusChange?: (focused: boolean) => void;
  references?: ReferenceCandidate[];
  referencesLoading?: boolean;
  onReferenceTrigger?: () => void;
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
      onEnter,
      onEscape,
      onFocusChange,
      references = NO_REFERENCES,
      referencesLoading = false,
      onReferenceTrigger,
    },
    ref,
  ) {
    const fieldRef = useRef<HTMLTextAreaElement>(null);
    const pendingCaret = useRef<number | null>(autoFocus ? value.length : null);
    const autoFocusRef = useRef(Boolean(autoFocus));
    const resizedManuallyRef = useRef(false);
    const settingHeightRef = useRef(false);
    const [mention, setMention] = useState<MentionQuery | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const listboxId = useId();
    const menuRef = useRef<HTMLElement | null>(null);
    const zIndex = useContext(AnnotationDataContext)?.config.zIndex;

    const referencesEnabled = onReferenceTrigger !== undefined;
    const activeMention = mention?.trigger === "#" && !referencesEnabled ? null : mention;
    const matches = useMemo<MenuItem[]>(() => {
      if (!activeMention) {
        return [];
      }
      if (activeMention.trigger === "#") {
        return filterReferenceCandidates(references, activeMention.query).map((reference) => ({
          type: "reference",
          key: `${reference.kind}:${reference.id}`,
          reference,
        }));
      }
      return filterMentionCandidates(candidates, activeMention.query)
        .slice(0, MENU_LIMIT)
        .map((candidate) => ({ type: "person", key: candidate.id, candidate }));
    }, [activeMention, candidates, references]);
    const mentionActive = activeMention !== null;
    const menuOpen = mentionActive && matches.length > 0;
    const referenceStatus =
      activeMention?.trigger === "#" && !menuOpen && activeMention.query === ""
        ? referencesLoading
          ? "Loading epics, flows and data models…"
          : "No epics, flows or data models to link yet"
        : null;
    const menuVisible = menuOpen || referenceStatus !== null;
    const menuStyle = useCaretMenuStyle(
      fieldRef,
      menuRef,
      menuVisible && activeMention ? activeMention.start : null,
      `${value}|${matches.length}|${referenceStatus ?? ""}`,
    );

    useEffect(() => {
      if (menuOpen) {
        document.getElementById(`${listboxId}-${activeIndex}`)?.scrollIntoView({
          block: "nearest",
        });
      }
    }, [activeIndex, listboxId, menuOpen]);

    useLayoutEffect(() => {
      const field = fieldRef.current;
      if (!field) {
        return;
      }
      if (!resizedManuallyRef.current) {
        settingHeightRef.current = true;
        field.style.height = "auto";
        field.style.height = `${field.scrollHeight}px`;
        settingHeightRef.current = false;
      }
      if (pendingCaret.current !== null) {
        if (autoFocusRef.current) {
          autoFocusRef.current = false;
          field.focus();
        }
        field.setSelectionRange(pendingCaret.current, pendingCaret.current);
        pendingCaret.current = null;
      }
    }, [value]);

    useLayoutEffect(() => {
      const field = fieldRef.current;
      if (!field || typeof ResizeObserver === "undefined") {
        return;
      }
      const observer = new ResizeObserver(() => {
        if (!settingHeightRef.current) {
          resizedManuallyRef.current = true;
        }
      });
      observer.observe(field);
      return () => observer.disconnect();
    }, []);

    const syncMention = (text: string, caret: number) => {
      const next = findMentionQuery(text, caret);
      if (next?.trigger === "#") {
        onReferenceTrigger?.();
      }
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

    const choose = (item: MenuItem) => {
      const field = fieldRef.current;
      if (!mention || !field) {
        return;
      }
      const insert =
        item.type === "person" ? `@${item.candidate.name} ` : `#${item.reference.name} `;
      replaceRange(mention.start, field.selectionStart, insert);
      setMention(null);
    };

    const startTrigger = (trigger: MentionTrigger) => {
      const field = fieldRef.current;
      if (!field) {
        return;
      }
      field.focus();
      const start = field.selectionStart;
      const needsSpace = start > 0 && !/\s/.test(value.charAt(start - 1));
      const insert = needsSpace ? ` ${trigger}` : trigger;
      replaceRange(start, field.selectionEnd, insert);
      if (trigger === "#") {
        onReferenceTrigger?.();
      }
      setMention({ start: start + insert.length - 1, query: "", trigger });
      setActiveIndex(0);
    };

    useImperativeHandle(ref, () => ({
      focus: () => fieldRef.current?.focus(),
      startMention: () => startTrigger("@"),
      startReference: () => startTrigger("#"),
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
          const item = matches[activeIndex];
          if (item) {
            choose(item);
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
      if (mentionActive && !menuOpen && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        setMention(null);
        return;
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
        {menuVisible
          ? createPortal(
              <div className="wpn-root wpn-mention-portal" style={{ zIndex }}>
                {menuOpen ? (
                  <ul
                    ref={(node) => {
                      menuRef.current = node;
                    }}
                    style={menuStyle}
                    onMouseDown={(event) => event.preventDefault()}
                    id={listboxId}
                    role="listbox"
                    aria-label={
                      activeMention?.trigger === "#"
                        ? "Link an epic, flow or data model"
                        : "Mention a person"
                    }
                    className="wpn-mention__menu wpn-mention__menu--floating"
                  >
                    {matches.map((item, index) => {
                      const previous = matches[index - 1];
                      const groupHeader =
                        item.type === "reference" &&
                        (previous?.type !== "reference" ||
                          previous.reference.kind !== item.reference.kind)
                          ? REFERENCE_KIND_LABELS[item.reference.kind]
                          : null;
                      return [
                        groupHeader ? (
                          <li
                            key={`${item.key}-group`}
                            role="presentation"
                            className="wpn-mention__group"
                          >
                            {groupHeader}s
                          </li>
                        ) : null,
                        <li
                          key={item.key}
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
                          onClick={() => choose(item)}
                        >
                          {item.type === "person" ? (
                            <>
                              {item.candidate.avatarUrl ? (
                                <img
                                  className="wpn-mention__avatar"
                                  src={item.candidate.avatarUrl}
                                  alt=""
                                />
                              ) : (
                                <span className="wpn-mention__avatar wpn-mention__avatar--fallback">
                                  {getInitials(item.candidate.name)}
                                </span>
                              )}
                              <span className="wpn-mention__name">{item.candidate.name}</span>
                            </>
                          ) : (
                            <>
                              <ReferenceIcon kind={item.reference.kind} />
                              <span className="wpn-mention__copy">
                                <span className="wpn-mention__name">{item.reference.name}</span>
                                {item.reference.description ? (
                                  <span className="wpn-mention__email">
                                    {item.reference.description}
                                  </span>
                                ) : null}
                              </span>
                            </>
                          )}
                        </li>,
                      ];
                    })}
                  </ul>
                ) : referenceStatus ? (
                  <div
                    ref={(node) => {
                      menuRef.current = node;
                    }}
                    style={menuStyle}
                    className="wpn-mention__menu wpn-mention__menu--floating wpn-mention__status"
                    role="status"
                  >
                    {referenceStatus}
                  </div>
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </div>
    );
  },
);
