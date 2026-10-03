import type { AiActionRunState } from "../../types/ai.types";
import { Icon } from "../primitives";
import { AiThinking } from "./AiThinking";

interface AiDockStatusProps {
  state: AiActionRunState;
  onStop: () => void;
  drawing?: boolean;
  latest?: string | null;
}

export function currentPhase(state: AiActionRunState): string {
  const running = [...state.steps].reverse().find((step) => step.status === "running");
  if (running) return running.label;
  if (state.progress > 0) return "Writing changes…";
  if (state.reasoning) return "Thinking it through…";
  if (state.text) return "Writing the answer…";
  return "Thinking…";
}

export function AiDockStatus({ state, onStop, drawing = false, latest = null }: AiDockStatusProps) {
  const done = state.steps.filter((step) => step.status === "done").length;
  return (
    <div className="wpn-ai-dockstatus">
      <AiThinking
        label={drawing ? `${latest ?? "Drawing on canvas"}…` : currentPhase(state)}
        startedAt={state.startedAt}
      />
      <span className="wpn-ai-dockstatus__meta">
        {state.progress > 0 ? (
          <span className="wpn-ai-dockstatus__count">
            {state.progress} {state.progress === 1 ? "change" : "changes"} so far
          </span>
        ) : null}
        {state.steps.length > 0 ? (
          <span>
            Step {Math.min(done + 1, state.steps.length)} of {state.steps.length}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        className="wpn-btn wpn-btn--ghost wpn-ai-dockstatus__stop"
        onClick={onStop}
      >
        <Icon name="stop" className="wpn-btn__icon" />
        Stop
      </button>
    </div>
  );
}
