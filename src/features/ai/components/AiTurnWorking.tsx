import { useRef, useState } from "react";
import type { AiProviderId } from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { Spinner } from "../../../components/primitives/Spinner";
import { formatElapsed } from "./AiActivity";
import { AiThinkingMark } from "./AiThinking";
import { useNow } from "./useAiPreferences";

export function workTitle(toolNames: readonly string[]): string {
  const names = toolNames.join(" ");
  if (/propose_flow_ops/.test(names)) return "AI is building your flow";
  if (/propose_data_model_ops/.test(names)) return "AI is building your data model";
  if (/propose_workspace_ops/.test(names)) return "AI is planning your workspace";
  if (/draft_comment_reply/.test(names)) return "AI is drafting a reply";
  return "AI is working on your request";
}

export function idleDetail(elapsedMs: number): string {
  if (elapsedMs < 3000) return "Thinking…";
  if (elapsedMs < 9000) return "Reading your project…";
  if (elapsedMs < 20000) return "Planning the details…";
  if (elapsedMs < 45000) return "Drafting your result…";
  return "Still working. Bigger requests can take a minute…";
}

interface AiTurnWorkingProps {
  title?: string;
  detail?: string | null;
  startedAt?: number | null;
  onStop?: () => void | Promise<unknown>;
  className?: string;
  silent?: boolean;
  provider?: AiProviderId | null;
}

export function AiTurnWorking({
  title = "AI is working on your request",
  detail,
  startedAt,
  onStop,
  className,
  silent = false,
  provider,
}: AiTurnWorkingProps) {
  const mountedAt = useRef(Date.now());
  const now = useNow(true, 1000);
  const elapsed = Math.max(0, now - (startedAt ?? mountedAt.current));
  const [stopping, setStopping] = useState(false);
  return (
    <div
      className={["wpn-ai-work", "wpn-ai-work--running", "wpn-ai-work--chat", className]
        .filter(Boolean)
        .join(" ")}
      role={silent ? undefined : "status"}
      aria-live={silent ? undefined : "polite"}
    >
      <AiThinkingMark className="wpn-ai-work__mark" provider={provider} />
      <span className="wpn-ai-work__text">
        <span className="wpn-ai-work__title">{title}</span>
        <span className="wpn-ai-work__detail">
          <span
            className="wpn-ai-shimmer"
            key={stopping ? "stopping" : detail || idleDetail(elapsed)}
          >
            {stopping ? "Stopping…" : detail || idleDetail(elapsed)}
          </span>
        </span>
      </span>
      <span className="wpn-ai-work__count" aria-hidden="true">
        {formatElapsed(elapsed - (elapsed % 1000))}
      </span>
      {onStop ? (
        <button
          type="button"
          className="wpn-ai-work__btn"
          disabled={stopping}
          onClick={() => {
            setStopping(true);
            Promise.resolve(onStop()).catch(() => setStopping(false));
          }}
        >
          {stopping ? (
            <Spinner className="wpn-btn__icon" />
          ) : (
            <Icon name="stop" className="wpn-btn__icon" />
          )}
          {stopping ? "Stopping" : "Stop"}
        </button>
      ) : null}
    </div>
  );
}
