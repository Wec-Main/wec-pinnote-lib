import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from "react";
import type { AiMention, AiMentionKind } from "../../types/ai.types";
import { getInitials } from "../../utils/format";
import { highlightQuery } from "../../utils/mentions";
import { Icon, type IconName } from "../primitives";

export type AiMentionTrigger = "#" | "@";

export interface AiMentionCandidate {
  trigger: AiMentionTrigger;
  mention: AiMention;
  description?: string;
}

interface MentionQuery {
  trigger: AiMentionTrigger;
  start: number;
  query: string;
}

const MAX_RESULTS = 8;
const QUERY = /(^|\s)([#@])([^\s#@]{0,40})$/;

export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  const match = QUERY.exec(text.slice(0, caret));
  if (!match) return null;
  const trigger = match[2] as AiMentionTrigger;
  const query = match[3] ?? "";
  return { trigger, query, start: caret - query.length - 1 };
}

export const MENTION_ICONS: Record<AiMentionKind, IconName> = {
  data_model: "dataModel",
  flow: "flow",
  annotation: "comment",
  epic: "epic",
  user_story: "epic",
  user: "users",
};

const KIND_LABELS: Record<AiMentionKind, string> = {
  data_model: "Data model",
  flow: "Flow",
  annotation: "Comment",
  epic: "Epic",
  user_story: "User story",
  user: "Teammate",
};

export function filterMentionCandidates(
  candidates: readonly AiMentionCandidate[],
  trigger: AiMentionTrigger,
  query: string,
  exclude: readonly AiMention[] = [],
): AiMentionCandidate[] {
  const needle = query.trim().toLowerCase();
  const taken = new Set(exclude.map((mention) => `${mention.kind}:${mention.id}`));
  const scored: { candidate: AiMentionCandidate; score: number }[] = [];
  for (const candidate of candidates) {
    if (candidate.trigger !== trigger) continue;
    const { mention } = candidate;
    if (taken.has(`${mention.kind}:${mention.id}`)) continue;
    const label = mention.label.replace(/^#/, "").toLowerCase();
    if (!needle) {
      scored.push({ candidate, score: 1 });
      continue;
    }
    const index = label.indexOf(needle);
    if (index === 0) scored.push({ candidate, score: 0 });
    else if (index > 0) scored.push({ candidate, score: 1 });
    else if (
      KIND_LABELS[mention.kind].toLowerCase().startsWith(needle) ||
      candidate.description?.toLowerCase().includes(needle)
    ) {
      scored.push({ candidate, score: 2 });
    }
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_RESULTS)
    .map((item) => item.candidate);
}

interface MentionPickerOptions {
  candidates: readonly AiMentionCandidate[];
  mentions: readonly AiMention[];
  setMentions: Dispatch<SetStateAction<AiMention[]>>;
  text: string;
  setText: (text: string) => void;
  fieldRef: RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  onMentionTrigger?: (trigger: AiMentionTrigger) => void;
}

export interface MentionPicker {
  open: boolean;
  listId: string;
  activeOptionId: string | undefined;
  hasResults: boolean;
  update: (value: string, caret: number) => void;
  handleKey: (event: KeyboardEvent<HTMLElement>) => boolean;
  onFieldBlur: () => void;
  close: () => void;
  menu: ReactNode;
}

export function useMentionPicker({
  candidates,
  mentions,
  setMentions,
  text,
  setText,
  fieldRef,
  onMentionTrigger,
}: MentionPickerOptions): MentionPicker {
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const triggered = useRef(new Set<AiMentionTrigger>());
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const needle = search.trim() ? search : (query?.query ?? "");
  const results = useMemo(
    () => (query ? filterMentionCandidates(candidates, query.trigger, needle, mentions) : []),
    [candidates, mentions, needle, query],
  );
  const pickerOpen = query !== null;

  const update = (value: string, caret: number) => {
    const next = findMentionQuery(value, caret);
    if (!next || next.start !== query?.start || next.trigger !== query?.trigger) setSearch("");
    setQuery(next);
    setActiveIndex(0);
    if (next && !triggered.current.has(next.trigger)) {
      triggered.current.add(next.trigger);
      onMentionTrigger?.(next.trigger);
    }
  };

  const close = () => {
    setQuery(null);
    setSearch("");
  };

  const select = (candidate: AiMentionCandidate) => {
    if (!query) return;
    const caret = fieldRef.current?.selectionStart ?? text.length;
    const end = Math.max(caret, query.start + 1 + query.query.length);
    const next = `${text.slice(0, query.start)}${text.slice(end)}`.replace(/ {2,}/g, " ");
    setText(next);
    setMentions((current) => [...current, candidate.mention]);
    close();
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(query.start, query.start);
    });
  };

  const handleKey = (event: KeyboardEvent<HTMLElement>): boolean => {
    if (!pickerOpen) return false;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      fieldRef.current?.focus();
      return true;
    }
    if (results.length === 0) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const candidate = results[activeIndex] ?? results[0];
      if (candidate) select(candidate);
      return true;
    }
    return false;
  };

  const onFieldBlur = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    blurTimer.current = setTimeout(() => {
      blurTimer.current = null;
      const focused = document.activeElement;
      if (focused === fieldRef.current || menuRef.current?.contains(focused)) return;
      close();
    }, 120);
  };

  const menu =
    pickerOpen && query ? (
      <div
        ref={menuRef}
        className="wpn-mention__menu wpn-ai-mention-menu"
        onMouseDown={(event) => {
          if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
        }}
      >
        <label className="wpn-ai-mention-menu__search">
          <Icon name="search" className="wpn-ai-mention-menu__search-icon" />
          <input
            type="search"
            aria-label={query.trigger === "@" ? "Search teammates" : "Search mentions"}
            aria-controls={listId}
            placeholder={
              query.trigger === "@" ? "Search teammates" : "Search models, flows, comments"
            }
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              handleKey(event);
            }}
            onBlur={onFieldBlur}
          />
        </label>
        <div className="wpn-mention__menu-title">
          {query.trigger === "@" ? "Teammates" : "Models, flows and comments"}
        </div>
        {results.length === 0 ? (
          <p className="wpn-mention__empty">
            {query.trigger === "@" ? "No teammates match" : "No models, flows or comments match"}
          </p>
        ) : (
          <ul id={listId} className="wpn-mention__list" role="listbox" aria-label="Mention">
            {results.map((candidate, index) => (
              <li
                key={`${candidate.mention.kind}:${candidate.mention.id}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "wpn-mention__option wpn-mention__option--active"
                    : "wpn-mention__option"
                }
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(candidate)}
              >
                {candidate.mention.kind === "user" ? (
                  <span className="wpn-mention__avatar wpn-mention__avatar--fallback">
                    {getInitials(candidate.mention.label)}
                  </span>
                ) : (
                  <span className="wpn-mention__avatar wpn-ai-mention-menu__kind">
                    <Icon name={MENTION_ICONS[candidate.mention.kind]} />
                  </span>
                )}
                <span className="wpn-mention__copy">
                  <span className="wpn-mention__name">
                    {highlightQuery(candidate.mention.label, needle).map((part, partIndex) =>
                      part.highlighted ? <strong key={partIndex}>{part.text}</strong> : part.text,
                    )}
                  </span>
                  <span className="wpn-mention__email">
                    {candidate.description ?? KIND_LABELS[candidate.mention.kind]}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="wpn-mention__footer" aria-hidden="true">
          <kbd>↑</kbd>
          <kbd>↓</kbd> navigate · <kbd>Enter</kbd> select · <kbd>Esc</kbd> dismiss
        </div>
      </div>
    ) : null;

  return {
    open: pickerOpen,
    listId,
    activeOptionId: pickerOpen && results[activeIndex] ? `${listId}-${activeIndex}` : undefined,
    hasResults: results.length > 0,
    update,
    handleKey,
    onFieldBlur,
    close,
    menu,
  };
}
