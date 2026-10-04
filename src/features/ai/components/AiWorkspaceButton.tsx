import type { AiMention } from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { useAiUi } from "./AiUiContext";
import { useAiAvailable } from "./IntegrationsButton";

export interface AiWorkspaceButtonProps {
  mentions?: AiMention[];
  selection?: string[];
  prompt?: string;
  label?: string;
  tooltip?: string;
  disabled?: boolean;
  className?: string;
}

export function AiWorkspaceButton({
  mentions,
  selection,
  prompt,
  label = "Ask AI",
  tooltip = "Ask AI to create or update epics, user stories, flows and data models",
  disabled = false,
  className,
}: AiWorkspaceButtonProps) {
  const ui = useAiUi();
  const available = useAiAvailable();
  if (!ui || !available) return null;
  return (
    <Tooltip label={tooltip} placement="bottom">
      <button
        type="button"
        className={["wpn-ai-ws-trigger", className].filter(Boolean).join(" ")}
        aria-label={tooltip}
        disabled={disabled}
        onClick={() => ui.openWorkspace({ mentions, selection, prompt })}
      >
        <Icon name="sparkles" className="wpn-ai-ws-trigger__icon" />
        <span>{label}</span>
      </button>
    </Tooltip>
  );
}
