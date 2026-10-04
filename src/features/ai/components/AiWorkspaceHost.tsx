import { useOptionalAiRuntime } from "../AiRuntimeContext";
import { AiWorkspaceDialog } from "./AiWorkspaceDialog";
import { useAiUi } from "./AiUiContext";
import { useAiAvailable } from "./IntegrationsButton";

export function AiWorkspaceHost() {
  const runtime = useOptionalAiRuntime();
  const ui = useAiUi();
  const available = useAiAvailable();
  if (!runtime || !available || !ui?.workspaceRequest) return null;
  return (
    <AiWorkspaceDialog
      key={ui.workspaceRequest.nonce}
      request={ui.workspaceRequest}
      onClose={ui.closeWorkspace}
    />
  );
}
