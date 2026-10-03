import { useEffect, useRef, useState } from "react";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { Icon, Spinner, Tooltip } from "../primitives";
import { friendlyCommentAiError, resultText } from "./AnnotationAiActions";
import { aiReady, resolveRoute } from "./aiHelpers";
import { useAiAvailable } from "./IntegrationsButton";
import { useAiAction } from "./useAiAction";
import { useAiDefaults } from "./useAiPreferences";

export interface AiImproveButtonProps {
  annotationId: string;
  draft: string;
  onImproved: (text: string) => void;
  disabled?: boolean;
}

export function AiImproveButton(props: AiImproveButtonProps) {
  const available = useAiAvailable();
  if (!available) return null;
  return <AiImproveButtonInner {...props} />;
}

function AiImproveButtonInner({ annotationId, draft, onImproved, disabled }: AiImproveButtonProps) {
  const runtime = useOptionalAiRuntime();
  const me = runtime?.me ?? null;
  const [defaults] = useAiDefaults();
  const { state, run, stop } = useAiAction();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const onImprovedRef = useRef(onImproved);
  onImprovedRef.current = onImproved;
  const sentRef = useRef("");
  const running = state.status === "running";

  useEffect(() => {
    if (!pending || state.status === "running" || state.status === "idle") return;
    setPending(false);
    if (state.status === "error") {
      setError(friendlyCommentAiError(state.error));
      return;
    }
    if (state.status !== "done") return;
    const text = resultText(state, "text");
    if (!text) {
      setError("The AI finished without a suggestion.");
      return;
    }
    setPrevious(sentRef.current);
    onImprovedRef.current(text);
  }, [pending, state]);

  useEffect(() => {
    if (previous !== null && draft.trim() === "") setPrevious(null);
  }, [draft, previous]);

  const improve = () => {
    const route = resolveRoute(me, defaults);
    const text = draft.trim();
    if (!route || !text) return;
    sentRef.current = draft;
    setError(null);
    setPrevious(null);
    setPending(true);
    void run("comment.improve", {
      targetId: annotationId,
      inputs: { draft: text },
      provider: route.provider,
      model: route.model,
      effort: route.effort,
    });
  };

  const hint = !aiReady(me)
    ? "Connect an AI agent in Settings → Integrations"
    : !draft.trim()
      ? "Write a comment first, then improve it with AI"
      : "Improve with AI";

  if (running) {
    return (
      <span className="wpn-ai-improve wpn-ai-improve--running">
        <Spinner label="Improving draft" />
        <span className="wpn-ai-improve__label" aria-hidden="true">
          Improving…
        </span>
        <button
          type="button"
          className="wpn-reply__tool"
          aria-label="Stop improving"
          onClick={stop}
        >
          <Icon name="stop" />
        </button>
      </span>
    );
  }

  return (
    <span className="wpn-ai-improve">
      {previous !== null ? (
        <button
          type="button"
          className="wpn-ai-link wpn-ai-improve__undo"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onImprovedRef.current(previous);
            setPrevious(null);
          }}
        >
          Undo
        </button>
      ) : null}
      <Tooltip label={error ?? hint} placement="top">
        <button
          type="button"
          className={[
            "wpn-reply__tool",
            "wpn-ai-improve__btn",
            error ? "wpn-ai-improve__btn--error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-label="Improve with AI"
          disabled={disabled || !aiReady(me) || !draft.trim()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={improve}
        >
          <Icon name="sparkles" />
        </button>
      </Tooltip>
      {error ? (
        <span className="wpn-sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
