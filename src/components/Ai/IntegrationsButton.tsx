import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { useAnnotationUi } from "../../context/AnnotationContext";
import { Icon, Tooltip } from "../primitives";
import { aiReady } from "./aiHelpers";
import { useAiUi } from "./AiUiContext";

export function useAiAvailable(): boolean {
  const runtime = useOptionalAiRuntime();
  return Boolean(runtime?.enabled && runtime.me && runtime.me.canUseAi);
}

export function IntegrationsButton() {
  const runtime = useOptionalAiRuntime();
  const ai = useAiUi();
  const { setUserManagementOpen } = useAnnotationUi();
  const available = useAiAvailable();

  if (!available || !runtime?.me) return null;
  const me = runtime.me;
  const ready = aiReady(me);
  const label = ready
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
