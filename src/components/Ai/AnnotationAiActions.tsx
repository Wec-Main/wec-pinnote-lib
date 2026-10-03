import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import type { AiActionError, AiActionKey, AiActionRunState } from "../../types/ai.types";
import type { Annotation } from "../../types/annotation.types";
import { useAiActionHistory } from "../../hooks/useAiActionHistory";
import { Icon } from "../primitives";
import { AiActionHistory } from "./AiActionHistory";
import { AiActivity } from "./AiActivity";
import { AiMarkdown } from "./AiMarkdown";
import { aiErrorText, aiReady, connectAgentHint, resolveRoute } from "./aiHelpers";
import { useAiUi } from "./AiUiContext";
import { useAiAvailable } from "./IntegrationsButton";
import { useAiAction } from "./useAiAction";
import { useAiDefaults } from "./useAiPreferences";

interface AnnotationAiActionsProps {
  annotation: Annotation;
  onDraftReply: (message: string) => void;
}

export const NO_CONTEXT_MESSAGE = "Mark comments with 'Add to AI context' first.";
export const DRAFT_REQUIRED_MESSAGE = "Type a comment first, then ask AI to improve it.";
export const ACTION_DISABLED_MESSAGE = "This AI action is turned off for your organisation.";

const summaries = new Map<string, string>();
const MAX_SUMMARIES = 50;

const summaryKey = (annotation: Annotation) =>
  `${annotation.id}:${annotation.comments.length}:${annotation.updatedAt}`;

function rememberSummary(key: string, text: string): void {
  summaries.delete(key);
  summaries.set(key, text);
  while (summaries.size > MAX_SUMMARIES) {
    const oldest = summaries.keys().next().value;
    if (oldest === undefined) break;
    summaries.delete(oldest);
  }
}

export function rememberedSummary(key: string): string | null {
  return summaries.get(key) ?? null;
}

export function forgetSummaries(): void {
  summaries.clear();
}

export function friendlyCommentAiError(error: AiActionError | null): string | null {
  if (!error) return null;
  if (error.code === "no_context") return NO_CONTEXT_MESSAGE;
  if (error.code === "draft_required") return DRAFT_REQUIRED_MESSAGE;
  if (error.code === "rate_limited" || error.code === "http_429") {
    return error.message || "You already have several AI actions running. Try again in a moment.";
  }
  if (error.code === "runtime_busy" || error.code === "http_503") {
    return "The AI is busy right now. Try again in a moment.";
  }
  if (error.code === "connector_required") return connectAgentHint();
  if (error.code === "action_disabled") return ACTION_DISABLED_MESSAGE;
  return aiErrorText(error.code, error.message || "The AI could not finish.");
}

export function resultText(state: AiActionRunState, key: string): string | null {
  const result = state.result;
  if (!result) return null;
  if (result.kind === "markdown" || result.kind === "text") return result.text;
  if ((result.kind === "json" || result.kind === "op_batch") && result.value) {
    const value = result.value[key];
    return typeof value === "string" && value.trim() ? value : null;
  }
  return null;
}

export function AnnotationAiActions(props: AnnotationAiActionsProps) {
  const available = useAiAvailable();
  if (!available) return null;
  return <AnnotationAiActionsInner {...props} />;
}

function AnnotationAiActionsInner({ annotation, onDraftReply }: AnnotationAiActionsProps) {
  const runtime = useOptionalAiRuntime();
  const ui = useAiUi();
  const [defaults] = useAiDefaults();
  const { state, run, stop, reset } = useAiAction();
  const [mode, setMode] = useState<"summary" | "draft" | null>(null);
  const [summary, setSummary] = useState<string | null>(() =>
    rememberedSummary(summaryKey(annotation)),
  );
  const currentSummaryKey = summaryKey(annotation);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const history = useAiActionHistory("annotation", annotation.id, { refreshKey });
  const onDraftRef = useRef(onDraftReply);
  onDraftRef.current = onDraftReply;
  const me = runtime?.me ?? null;
  const ready = aiReady(me);
  const running = state.status === "running";

  useEffect(() => {
    setSummary(rememberedSummary(currentSummaryKey));
  }, [currentSummaryKey]);

  useEffect(() => {
    setError(null);
    setMode(null);
    reset();
  }, [annotation.id, reset]);

  useLayoutEffect(() => {
    if (!mode || state.status === "running" || state.status === "idle") return;
    if (state.status === "error") {
      setError(friendlyCommentAiError(state.error));
    } else if (state.status === "done") {
      if (mode === "summary") {
        const text = resultText(state, "summary") ?? (state.text || null);
        if (text) {
          rememberSummary(currentSummaryKey, text);
          setSummary(text);
        } else {
          setError("The AI finished without a summary.");
        }
      } else {
        const reply = resultText(state, "reply");
        if (reply) onDraftRef.current(reply);
        else setError("The AI finished without drafting a reply.");
      }
    }
    setMode(null);
    setRefreshKey((key) => key + 1);
  }, [annotation.id, mode, state]);

  const ask = (kind: "summary" | "draft") => {
    const route = resolveRoute(me, defaults);
    if (!route) return;
    const actionKey: AiActionKey = kind === "summary" ? "comment.summarize" : "comment.draft_reply";
    setError(null);
    setMode(kind);
    void run(actionKey, {
      targetId: annotation.id,
      provider: route.provider,
      model: route.model,
      effort: route.effort,
    });
  };

  const disabledTitle = ready ? undefined : connectAgentHint(me);
  const showActivity = running && mode !== null;
  const activityState = mode === "draft" ? { ...state, text: "" } : state;

  return (
    <div className="wpn-ai-thread-actions">
      <div className="wpn-ai-thread-actions__row">
        <button
          type="button"
          className="wpn-ai-chip-btn"
          disabled={!ready || running}
          title={disabledTitle}
          onClick={() => ask("summary")}
        >
          <Icon name="sparkles" /> {summary ? "Refresh summary" : "Summarise thread"}
        </button>
        <button
          type="button"
          className="wpn-ai-chip-btn"
          disabled={!ready || running}
          title={disabledTitle}
          onClick={() => ask("draft")}
        >
          <Icon name="reply" /> Draft reply with AI
        </button>
        {summary && !running ? (
          <button
            type="button"
            className="wpn-ai-chip-btn wpn-ai-chip-btn--close"
            onClick={() => {
              summaries.delete(currentSummaryKey);
              setSummary(null);
            }}
          >
            <Icon name="x" /> Close summary
          </button>
        ) : null}
        {running ? (
          <button type="button" className="wpn-ai-chip-btn" onClick={stop}>
            <Icon name="stop" /> Stop
          </button>
        ) : null}
      </div>
      {showActivity ? <AiActivity state={activityState} compact hideText /> : null}
      {error ? (
        <p className="wpn-ai-card__warn" role="alert">
          {error}
        </p>
      ) : null}
      {history.messages.length > 0 && !running ? (
        <details className="wpn-ai-history__details">
          <summary>AI history ({history.messages.length})</summary>
          <AiActionHistory messages={history.messages} />
        </details>
      ) : null}
      {summary && !(running && mode === "summary") ? (
        <div className="wpn-ai-thread-actions__summary wpn-ai-fade-up">
          <AiMarkdown text={summary} />
          <div className="wpn-ai-thread-actions__row">
            {ui ? (
              <button
                type="button"
                className="wpn-ai-link"
                onClick={() =>
                  ui.openPanel({
                    newSession: true,
                    scopeKind: "annotation",
                    scopeId: annotation.id,
                    mentions: [
                      { kind: "annotation", id: annotation.id, label: `#${annotation.number}` },
                    ],
                  })
                }
              >
                Open in chat
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
