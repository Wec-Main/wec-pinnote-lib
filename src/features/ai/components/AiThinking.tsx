import { useRef } from "react";
import type { AiProviderId } from "../../../types/ai.types";
import { formatElapsed } from "./AiActivity";
import { useNow } from "./useAiPreferences";

interface AiThinkingProps {
  label?: string;
  startedAt?: number | null;
  className?: string;
  provider?: AiProviderId | null;
}

export function AiThinkingMark({
  className,
  provider,
}: {
  className?: string;
  provider?: AiProviderId | null;
}) {
  return (
    <svg
      className={["wpn-ai-mark", provider ? `wpn-ai-mark--${provider}` : "", className]
        .filter(Boolean)
        .join(" ")}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 3v18" />
        <path d="M3 12h18" />
        <path d="M5.6 5.6l12.8 12.8" />
        <path d="M18.4 5.6L5.6 18.4" />
      </g>
    </svg>
  );
}

export function AiThinking({
  label = "Thinking…",
  startedAt,
  className,
  provider,
}: AiThinkingProps) {
  const mountedAt = useRef(Date.now());
  const now = useNow(true, 1000);
  const elapsed = now - (startedAt ?? mountedAt.current);
  return (
    <div
      className={["wpn-ai-thinking", className].filter(Boolean).join(" ")}
      role="status"
      aria-live="polite"
    >
      <AiThinkingMark provider={provider} />
      <span className="wpn-ai-shimmer wpn-ai-thinking__label">{label}</span>
      {elapsed >= 2000 ? (
        <span className="wpn-ai-thinking__time" aria-hidden="true">
          {formatElapsed(elapsed - (elapsed % 1000))}
        </span>
      ) : null}
    </div>
  );
}
