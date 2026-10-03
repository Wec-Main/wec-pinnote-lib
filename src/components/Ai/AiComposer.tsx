import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { AiMention, AiSelection } from "../../types/ai.types";
import { Icon, Spinner } from "../primitives";
import { AiMentionChip } from "./AiMentionChip";
import { formatElapsed } from "./AiActivity";
import { useNow } from "./useAiPreferences";
import {
  MENTION_ICONS,
  filterMentionCandidates,
  findMentionQuery,
  useMentionPicker,
  type AiMentionCandidate,
  type AiMentionTrigger,
} from "./useMentionPicker";

export {
  AiMentionChip,
  MENTION_ICONS,
  filterMentionCandidates,
  findMentionQuery,
  type AiMentionCandidate,
  type AiMentionTrigger,
};

export interface AiComposerSendInput {
  text: string;
  mentions: AiMention[];
  selection?: AiSelection | null;
}

export interface AiComposerSeed {
  text: string;
  mentions?: readonly AiMention[];
  nonce: number;
}

export interface AiComposerSelection {
  selection: AiSelection;
  label: string;
}

export const AI_COMPOSER_MAX_CHARS = 100000;
export const COMPOSER_DRAFT_DEBOUNCE_MS = 400;
const COUNTER_FROM = 0.8;
const DRAFT_PREFIX = "wpn-ai:draft:";

interface StoredDraft {
  text: string;
  mentions: AiMention[];
}

function draftStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readComposerDraft(key: string | null | undefined): StoredDraft | null {
  if (!key) return null;
  try {
    const raw = draftStorage()?.getItem(`${DRAFT_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredDraft>;
    if (typeof parsed.text !== "string") return null;
    return { text: parsed.text, mentions: Array.isArray(parsed.mentions) ? parsed.mentions : [] };
  } catch {
    return null;
  }
}

export function writeComposerDraft(
  key: string | null | undefined,
  draft: StoredDraft | null,
): void {
  if (!key) return;
  try {
    const storage = draftStorage();
    if (!storage) return;
    if (!draft || (!draft.text.trim() && draft.mentions.length === 0)) {
      storage.removeItem(`${DRAFT_PREFIX}${key}`);
    } else {
      storage.setItem(`${DRAFT_PREFIX}${key}`, JSON.stringify(draft));
    }
  } catch {
    return;
  }
}

export interface AiComposerProps {
  candidates: readonly AiMentionCandidate[];
  onMentionTrigger?: (trigger: AiMentionTrigger) => void;
  onSend: (input: AiComposerSendInput) => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string | null;
  active?: boolean;
  onStop?: () => void;
  onEditLast?: () => void;
  activeSince?: number | null;
  toolbar?: ReactNode;
  initialMentions?: readonly AiMention[];
  initialText?: string;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
  draftKey?: string | null;
  seed?: AiComposerSeed | null;
  selection?: AiComposerSelection | null;
  maxLength?: number;
}

function ComposerStatus({ since }: { since: number | null }) {
  const mountedAt = useRef(Date.now());
  const now = useNow(true, 1000);
  const elapsed = Math.max(0, now - (since ?? mountedAt.current));
  return (
    <p className="wpn-ai-composer__status" aria-hidden="true">
      <span className="wpn-ai-composer__status-dot" />
      AI is writing… {formatElapsed(elapsed - (elapsed % 1000))}
      <span className="wpn-ai-composer__status-hint">Esc to stop</span>
    </p>
  );
}

export function AiComposer({
  candidates,
  onMentionTrigger,
  onSend,
  disabled = false,
  disabledReason,
  active = false,
  onStop,
  onEditLast,
  activeSince = null,
  toolbar,
  initialMentions,
  initialText = "",
  placeholder = "Ask AI… (# to mention a model, flow, epic or comment)",
  autoFocus = false,
  compact = false,
  draftKey = null,
  seed = null,
  selection = null,
  maxLength = AI_COMPOSER_MAX_CHARS,
}: AiComposerProps) {
  const [restored] = useState(() => (initialText ? null : readComposerDraft(draftKey)));
  const [text, setText] = useState(initialText || restored?.text || "");
  const [mentions, setMentions] = useState<AiMention[]>(() => [
    ...(initialMentions ?? restored?.mentions ?? []),
  ]);
  const [sending, setSending] = useState(false);
  const [includeSelection, setIncludeSelection] = useState(true);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const draftKeyRef = useRef(draftKey);
  const latestDraftRef = useRef<StoredDraft>({ text, mentions });
  latestDraftRef.current = { text, mentions };
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterId = useId();
  const picker = useMentionPicker({
    candidates,
    mentions,
    setMentions,
    text,
    setText,
    fieldRef,
    onMentionTrigger,
  });

  const flushDraft = useCallback(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
      draftTimerRef.current = null;
    }
    writeComposerDraft(draftKeyRef.current, latestDraftRef.current);
  }, []);

  useEffect(() => {
    if (draftKeyRef.current === draftKey) return;
    flushDraft();
    draftKeyRef.current = draftKey;
    const stored = readComposerDraft(draftKey);
    setText(stored?.text ?? "");
    setMentions(stored?.mentions ?? []);
    picker.close();
  }, [draftKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      draftTimerRef.current = null;
      writeComposerDraft(draftKeyRef.current, latestDraftRef.current);
    }, COMPOSER_DRAFT_DEBOUNCE_MS);
    draftTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [text, mentions]);

  useEffect(
    () => () => {
      writeComposerDraft(draftKeyRef.current, latestDraftRef.current);
    },
    [],
  );

  const seedNonce = seed?.nonce ?? null;
  const seedRef = useRef(seed);
  seedRef.current = seed;
  useEffect(() => {
    const next = seedRef.current;
    if (seedNonce === null || !next) return;
    setText(next.text);
    if (next.mentions) setMentions([...next.mentions]);
    requestAnimationFrame(() => {
      const field = fieldRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(next.text.length, next.text.length);
    });
  }, [seedNonce]);

  const selectionKey = selection
    ? `${selection.selection.kind}:${selection.selection.id}:${selection.selection.itemIds.join(",")}`
    : "";
  useEffect(() => {
    setIncludeSelection(true);
  }, [selectionKey]);

  const seededKey = useRef(
    (initialMentions ?? []).map((mention) => `${mention.kind}:${mention.id}`).join("|"),
  );
  useEffect(() => {
    const key = (initialMentions ?? []).map((mention) => `${mention.kind}:${mention.id}`).join("|");
    if (key === seededKey.current) return;
    seededKey.current = key;
    if (initialMentions?.length) {
      setMentions((current) => {
        const keys = new Set(current.map((m) => `${m.kind}:${m.id}`));
        const added = initialMentions.filter((m) => !keys.has(`${m.kind}:${m.id}`));
        return added.length ? [...current, ...added] : current;
      });
    }
  }, [initialMentions]);

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (autoFocus) fieldRef.current?.focus();
  }, [autoFocus]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    picker.update(event.target.value, event.target.selectionStart ?? event.target.value.length);
  };

  const tooLong = text.length > maxLength;

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending || tooLong) return;
    setSending(true);
    try {
      const input: AiComposerSendInput = { text: trimmed, mentions };
      if (selection && includeSelection) input.selection = selection.selection;
      await onSend(input);
      setText("");
      setMentions([]);
      picker.close();
      latestDraftRef.current = { text: "", mentions: [] };
      flushDraft();
    } catch {
      return;
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (picker.handleKey(event)) return;
    if (event.key === "Escape" && active && onStop) {
      event.preventDefault();
      onStop();
      return;
    }
    if (
      event.key === "ArrowUp" &&
      onEditLast &&
      !active &&
      text === "" &&
      mentions.length === 0 &&
      !event.shiftKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      onEditLast();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const showCounter = text.length >= maxLength * COUNTER_FROM;
  const showChips = mentions.length > 0 || Boolean(selection);

  return (
    <div className={["wpn-ai-composer", compact ? "wpn-ai-composer--compact" : ""].join(" ")}>
      <div
        className={["wpn-ai-composer__box", sending ? "wpn-ai-composer__box--sending" : ""].join(
          " ",
        )}
      >
        {showChips ? (
          <ul className="wpn-ai-chips" aria-label="Mentioned">
            {selection ? (
              <li
                className={[
                  "wpn-ai-mention",
                  "wpn-ai-mention--selection",
                  includeSelection ? "" : "wpn-ai-mention--off",
                ].join(" ")}
              >
                <button
                  type="button"
                  className="wpn-ai-mention__toggle"
                  aria-pressed={includeSelection}
                  onClick={() => setIncludeSelection((value) => !value)}
                >
                  <Icon name={includeSelection ? "check" : "plus"} />
                  Include selection · {selection.label}
                </button>
              </li>
            ) : null}
            {mentions.map((mention) => (
              <li key={`${mention.kind}:${mention.id}`}>
                <AiMentionChip
                  mention={mention}
                  onRemove={() =>
                    setMentions((current) =>
                      current.filter(
                        (item) => !(item.kind === mention.kind && item.id === mention.id),
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="wpn-ai-composer__field-wrap">
          <textarea
            ref={fieldRef}
            className="wpn-ai-composer__field"
            aria-label="Message to AI"
            placeholder={disabled && disabledReason ? disabledReason : placeholder}
            value={text}
            rows={compact ? 2 : 3}
            disabled={disabled}
            role="combobox"
            aria-expanded={picker.open && picker.hasResults}
            aria-controls={picker.open ? picker.listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={picker.activeOptionId}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={(event) =>
              picker.update(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
            }
            onBlur={() => {
              flushDraft();
              picker.onFieldBlur();
            }}
            aria-describedby={showCounter ? counterId : undefined}
            aria-invalid={tooLong || undefined}
          />
          {picker.menu}
        </div>
        {active ? <ComposerStatus since={activeSince} /> : null}
        <div className="wpn-ai-composer__bar">
          <div className="wpn-ai-composer__tools">{toolbar}</div>
          {showCounter ? (
            <span
              id={counterId}
              className={[
                "wpn-ai-composer__counter",
                tooLong ? "wpn-ai-composer__counter--over" : "",
              ].join(" ")}
            >
              {text.length.toLocaleString()} / {maxLength.toLocaleString()}
            </span>
          ) : null}
          {active && onStop ? (
            <button
              type="button"
              className="wpn-ai-composer__send wpn-ai-composer__send--stop"
              aria-label="Stop"
              title="Stop"
              onClick={onStop}
            >
              <Icon name="stop" className="wpn-btn__icon" />
            </button>
          ) : (
            <button
              type="button"
              className="wpn-ai-composer__send"
              aria-label="Send to AI"
              disabled={disabled || sending || !text.trim() || tooLong}
              onClick={() => void send()}
            >
              {sending ? <Spinner /> : <Icon name="send" className="wpn-btn__icon" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
