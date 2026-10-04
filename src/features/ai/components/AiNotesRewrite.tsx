import { useCallback, useEffect, useState } from "react";
import type { AiActionRunState } from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { useOptionalAiRuntime } from "../AiRuntimeContext";
import { aiReady, resolveRoute } from "./aiHelpers";
import { useAiAvailable } from "./IntegrationsButton";
import { useAiAction } from "./useAiAction";
import { useAiDefaults } from "./useAiPreferences";

const SHORTER_RATIO = 0.8;
const REWRITE_PROMPT = "Fix the grammar and tidy the layout of these notes.";

function suggestionOf(state: AiActionRunState): string {
  const result = state.result;
  if (result && (result.kind === "text" || result.kind === "markdown")) return result.text;
  return state.text;
}

export interface NotesRewrite {
  available: boolean;
  open: boolean;
  running: boolean;
  state: AiActionRunState;
  suggestion: string;
  start: () => void;
  close: () => void;
}

export function useNotesRewrite(notes: string, resetKey: string): NotesRewrite {
  const runtime = useOptionalAiRuntime();
  const me = runtime?.me ?? null;
  const [defaults] = useAiDefaults();
  const enabled = useAiAvailable();
  const { state, run, stop, reset } = useAiAction();
  const [open, setOpen] = useState(false);
  const route = resolveRoute(me, defaults);

  const close = useCallback(() => {
    stop();
    reset();
    setOpen(false);
  }, [reset, stop]);

  useEffect(() => close, [close, resetKey]);

  const start = () => {
    if (!route || !notes.trim()) return;
    setOpen(true);
    void run("notes.rewrite", {
      prompt: REWRITE_PROMPT,
      inputs: { draft: notes },
      provider: route.provider,
      model: route.model,
      effort: route.effort,
    });
  };

  return {
    available: enabled && aiReady(me) && route !== null,
    open,
    running: state.status === "running",
    state,
    suggestion: suggestionOf(state),
    start,
    close,
  };
}

export interface NotesRewriteReviewProps {
  rewrite: NotesRewrite;
  original: string;
  busy: boolean;
  onApprove: (text: string) => void;
}

export function NotesRewriteReview({
  rewrite,
  original,
  busy,
  onApprove,
}: NotesRewriteReviewProps) {
  if (!rewrite.open) return null;
  const { state, suggestion } = rewrite;
  const text = suggestion.trim();
  const unchanged = state.status === "done" && text === original.trim();
  const shorter =
    state.status === "done" && !unchanged && text.length < original.trim().length * SHORTER_RATIO;

  return (
    <section className="wpn-notes-rewrite" aria-label="Rewrite with AI" aria-live="polite">
      <header className="wpn-notes-rewrite__head">
        <Icon name="sparkles" className="wpn-notes-rewrite__icon" />
        <span className="wpn-notes-rewrite__title">
          {rewrite.running
            ? "Rewriting your notes…"
            : state.status === "error"
              ? "Couldn't rewrite the notes"
              : unchanged
                ? "Your notes already look good"
                : "Suggested notes"}
        </span>
        <span className="wpn-notes-rewrite__hint">Grammar and layout only</span>
      </header>
      {state.status === "error" ? (
        <p className="wpn-notes-rewrite__error" role="alert">
          {state.error?.message ?? "Something went wrong."}
        </p>
      ) : unchanged ? null : (
        <div
          className={[
            "wpn-notes-rewrite__text",
            rewrite.running ? "wpn-notes-rewrite__text--live" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {text || " "}
        </div>
      )}
      {shorter ? (
        <p className="wpn-notes-rewrite__warn" role="status">
          <Icon name="alert" /> This version is noticeably shorter than your notes. Check that
          nothing is missing before you save.
        </p>
      ) : null}
      <footer className="wpn-notes-rewrite__actions">
        {rewrite.running ? (
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={rewrite.close}>
            Stop
          </button>
        ) : (
          <>
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={rewrite.close}>
              {state.status === "done" && !unchanged ? "Discard" : "Close"}
            </button>
            {state.status === "done" && !unchanged && text ? (
              <button
                type="button"
                className="wpn-btn wpn-btn--primary"
                disabled={busy}
                onClick={() => {
                  onApprove(text);
                  rewrite.close();
                }}
              >
                <Icon name="check" className="wpn-btn__icon" />
                Approve and save
              </button>
            ) : null}
          </>
        )}
      </footer>
    </section>
  );
}
