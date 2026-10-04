import {
  useOptionalAiRuntime,
  useOptionalAiRuntimeActions,
  useOptionalAiMe,
} from "../AiRuntimeContext";
import { useAnnotationUi } from "../../../context/AnnotationContext";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { aiReady } from "./aiHelpers";
import { useAiUi } from "./AiUiContext";

export function useAiAvailable(): boolean {
  const enabled = useOptionalAiRuntimeActions()?.enabled ?? false;
  const me = useOptionalAiMe();
  return Boolean(enabled && me?.canUseAi);
}

export function IntegrationsButton() {
  const runtime = useOptionalAiRuntime();
  const ai = useAiUi();
  const { setUserManagementOpen } = useAnnotationUi();
  const available = useAiAvailable();

  if (!runtime?.enabled) return null;
  const hasError = Boolean(runtime.meError) && !available;
  if (!available && !hasError) return null;

  const ready = runtime.me ? aiReady(runtime.me) : false;
  const label = hasError
    ? `AI is temporarily unavailable: ${runtime.meError}. Click to retry.`
    : ready
      ? "AI integrations: connected"
      : "AI integrations: connect Claude, Codex or Gemini";

  return (
    <Tooltip label={label} placement="bottom">
      <button
        type="button"
        className={[
          "wpn-toolbar__publish",
          "wpn-ai-integrations-btn",
          ready ? "wpn-ai-integrations-btn--ready" : "",
          hasError ? "wpn-ai-integrations-btn--error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="AI integrations"
        onClick={() => (ai ? ai.openIntegrations("connectors") : setUserManagementOpen(true))}
      >
        <Icon name="plug" className="wpn-toolbar__publish-icon" />
        <span className="wpn-ai-integrations-btn__dot" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export function AiIntegrationsDialog() {
  return null;
}
