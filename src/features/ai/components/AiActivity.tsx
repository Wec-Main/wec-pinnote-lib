import { memo, useId, useState, useSyncExternalStore } from "react";
import type { AiActionRunState, AiActionStep } from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { Spinner } from "../../../components/primitives/Spinner";
import { AiMarkdown } from "./AiMarkdown";
import { aiErrorText } from "./aiHelpers";
import { AiThinkingMark } from "./AiThinking";
import type { AiLiveTextStore } from "./useAiAction";
import { useNow } from "./useAiPreferences";

export interface AiActivityProps {
  state: AiActionRunState;
  compact?: boolean;
  hideText?: boolean;
  className?: string;
  live?: AiLiveTextStore;
}

const LiveReasoning = memo(function LiveReasoning({ store }: { store: AiLiveTextStore }) {
  const reasoning = useSyncExternalStore(store.subscribe, () => store.get().reasoning);
  return reasoning ? <div className="wpn-ai-activity__reasoning">{reasoning}</div> : null;
});

const LiveText = memo(function LiveText({ store }: { store: AiLiveTextStore }) {
  const text = useSyncExternalStore(store.subscribe, () => store.get().text);
  return text ? (
    <div className="wpn-ai-activity__text wpn-ai-fade-up">
      <AiMarkdown text={text} streaming />
    </div>
  ) : null;
});

export function formatElapsed(ms: number): string {
  const safe = Math.max(0, ms);
  if (safe < 1000) return `${Math.round(safe)}ms`;
  if (safe < 60_000) return `${(safe / 1000).toFixed(1)}s`;
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

export function formatTokens(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function activitySummary(state: AiActionRunState, elapsedMs: number): string {
  const time = formatElapsed(elapsedMs);
  const parts = [
    state.status === "cancelled"
      ? `Stopped after ${time}`
      : state.status === "error"
        ? `Failed after ${time}`
        : `Worked for ${time}`,
  ];
  if (state.steps.length > 0) parts.push(plural(state.steps.length, "step"));
  return parts.join(" · ");
}

function StepIcon({ status }: { status: AiActionStep["status"] }) {
  if (status === "running") return <Spinner className="wpn-ai-step__spinner" />;
  return (
    <span className={`wpn-ai-step__badge wpn-ai-step__badge--${status}`} aria-hidden="true">
      <Icon name={status === "done" ? "check" : "x"} />
    </span>
  );
}

function StepTimeline({ steps }: { steps: AiActionStep[] }) {
  return (
    <ol className="wpn-ai-steps">
      {steps.map((step) => (
        <li key={step.id} className={`wpn-ai-step wpn-ai-step--${step.status}`}>
          <StepIcon status={step.status} />
          <span className="wpn-ai-step__body">
            <span className="wpn-ai-step__label">{step.label}</span>
            {step.detail ? <span className="wpn-ai-step__detail">{step.detail}</span> : null}
          </span>
          <span className="wpn-sr-only">
            {step.status === "running" ? "in progress" : step.status === "done" ? "done" : "failed"}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function AiActivity({
  state,
  compact = false,
  hideText = false,
  className,
  live,
}: AiActivityProps) {
  const running = state.status === "running";
  const now = useNow(running, 250);
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  if (state.status === "idle") return null;

  const elapsed =
    state.startedAt === null ? 0 : (running ? now : (state.finishedAt ?? now)) - state.startedAt;
  const resultText =
    state.result && (state.result.kind === "markdown" || state.result.kind === "text")
      ? state.result.text
      : "";
  const streamLive = Boolean(live) && running;
  const text = hideText && running ? "" : state.text || resultText;
  const plainText = !state.text && state.result?.kind === "text";
  const currentStep = [...state.steps].reverse().find((step) => step.status === "running");
  const showTimeline = running || expanded;
  const hasDetails = state.steps.length > 0 || Boolean(state.reasoning);

  return (
    <div
      className={[
        "wpn-ai-activity",
        `wpn-ai-activity--${state.status}`,
        compact ? "wpn-ai-activity--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={running}
    >
      {running ? (
        <div className="wpn-ai-activity__head" role="status" aria-live="polite">
          <AiThinkingMark className="wpn-ai-activity__spark" provider={state.provider} />
          <span className="wpn-ai-shimmer">
            {currentStep?.label ?? "Thinking…"}
            {currentStep?.detail ? ` · ${currentStep.detail}` : ""}
          </span>
          <span className="wpn-ai-activity__meta">
            {state.progress > 0 ? (
              <span className="wpn-ai-activity__ops">{plural(state.progress, "change")}</span>
            ) : null}
            <span className="wpn-ai-activity__timer" aria-hidden="true">
              {formatElapsed(elapsed)}
            </span>
          </span>
        </div>
      ) : hasDetails ? (
        <button
          type="button"
          className="wpn-ai-activity__toggle"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((open) => !open)}
        >
          <span>{activitySummary(state, elapsed)}</span>
          <Icon name="chevronDown" className="wpn-ai-activity__chevron" />
        </button>
      ) : (
        <div className="wpn-ai-activity__toggle wpn-ai-activity__toggle--static">
          {activitySummary(state, elapsed)}
        </div>
      )}

      {hasDetails ? (
        <div
          id={detailsId}
          className="wpn-ai-activity__details"
          data-open={showTimeline || undefined}
          hidden={!showTimeline}
        >
          {state.steps.length > 0 ? <StepTimeline steps={state.steps} /> : null}
          {streamLive && live ? (
            <LiveReasoning store={live} />
          ) : state.reasoning ? (
            <div className="wpn-ai-activity__reasoning">{state.reasoning}</div>
          ) : null}
        </div>
      ) : null}

      {streamLive && live && !hideText ? (
        <LiveText store={live} />
      ) : text ? (
        <div className="wpn-ai-activity__text wpn-ai-fade-up">
          {plainText ? (
            <p className="wpn-ai-activity__plain">{text}</p>
          ) : (
            <AiMarkdown text={text} streaming={running} />
          )}
        </div>
      ) : null}

      {state.error && state.status === "error" ? (
        <div className="wpn-ai-error wpn-ai-activity__error" role="alert">
          {aiErrorText(state.error.code, state.error.message)}
        </div>
      ) : null}

      {state.usage ? (
        <div className="wpn-ai-activity__footer">
          <span title="Input tokens">
            {formatTokens(state.usage.inputTokens)} in
            {state.usage.cachedInputTokens
              ? ` (${formatTokens(state.usage.cachedInputTokens)} cached)`
              : ""}
          </span>
          <span title="Output tokens">{formatTokens(state.usage.outputTokens)} out</span>
          <span title="Time to first token">TTFT {formatElapsed(state.usage.ttftMs)}</span>
        </div>
      ) : null}
    </div>
  );
}
