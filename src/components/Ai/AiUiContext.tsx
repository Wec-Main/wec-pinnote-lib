import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAnnotationUi } from "../../context/AnnotationContext";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import type { AiMention, AiOpBatchTargetKind, AiScopeKind } from "../../types/ai.types";

export interface AiPanelRequest {
  aiSessionId?: string | null;
  newSession?: boolean;
  mentions?: AiMention[];
  prompt?: string;
  scopeKind?: AiScopeKind;
  scopeId?: string | null;
}

export interface AiWorkspaceRequest {
  mentions?: AiMention[];
  selection?: string[];
  prompt?: string;
  aiSessionId?: string | null;
  nonce: number;
}

export type AiIntegrationsSurface = "popover" | "dialog";

export type IntegrationsSection = "connectors" | "connections";

export interface IntegrationsSettingsRequest {
  section: IntegrationsSection;
  nonce: number;
}

export interface AiUiContextValue {
  panelOpen: boolean;
  openPanel: (request?: AiPanelRequest) => void;
  closePanel: () => void;
  panelRequest: AiPanelRequest | null;
  consumePanelRequest: () => void;
  integrations: AiIntegrationsSurface | null;
  openIntegrations: (section?: IntegrationsSection | AiIntegrationsSurface) => void;
  closeIntegrations: () => void;
  integrationsRequest: IntegrationsSettingsRequest | null;
  openInEditor: (kind: AiOpBatchTargetKind, id: string) => void;
  workspaceRequest: AiWorkspaceRequest | null;
  openWorkspace: (request?: Omit<AiWorkspaceRequest, "nonce">) => void;
  closeWorkspace: () => void;
}

export const AiUiContext = createContext<AiUiContextValue | null>(null);

export function useAiUi(): AiUiContextValue | null {
  return useContext(AiUiContext);
}

export function AiUiProvider({ children }: { children?: ReactNode }) {
  const ui = useAnnotationUi();
  const runtime = useOptionalAiRuntime();
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelRequest, setPanelRequest] = useState<AiPanelRequest | null>(null);
  const [integrationsRequest, setIntegrationsRequest] =
    useState<IntegrationsSettingsRequest | null>(null);
  const integrations: AiIntegrationsSurface | null = null;
  const [workspaceRequest, setWorkspaceRequest] = useState<AiWorkspaceRequest | null>(null);
  const uiRef = useRef(ui);
  uiRef.current = ui;

  const otherSurfaceOpen =
    ui.listOpen ||
    ui.epicFlowOpen ||
    ui.flowOpen ||
    ui.dataModelOpen ||
    ui.userManagementOpen ||
    ui.commentsFullScreenOpen;

  useEffect(() => {
    if (otherSurfaceOpen) setPanelOpen(false);
  }, [otherSurfaceOpen]);

  const openPanel = useCallback((request?: AiPanelRequest) => {
    const current = uiRef.current;
    const show = () => {
      setPanelRequest(request ?? null);
      setPanelOpen(true);
    };
    current.guardFlowLeave("any", () => {
      if (current.listOpen) current.setListOpen(false);
      if (current.epicFlowOpen) current.setEpicFlowOpen(false);
      if (current.flowOpen) current.setFlowOpen(false);
      if (current.dataModelOpen) current.setDataModelOpen(false);
      if (current.userManagementOpen) current.setUserManagementOpen(false);
      if (current.commentsFullScreenOpen) current.setCommentsFullScreenOpen(false);
      setTimeout(show, 0);
    });
  }, []);

  const closePanel = useCallback(() => setPanelOpen(false), []);
  const consumePanelRequest = useCallback(() => setPanelRequest(null), []);
  const openIntegrations = useCallback((section?: IntegrationsSection | AiIntegrationsSurface) => {
    const target: IntegrationsSection = section === "connections" ? "connections" : "connectors";
    setIntegrationsRequest((current) => ({
      section: target,
      nonce: (current?.nonce ?? 0) + 1,
    }));
    setPanelOpen(false);
    uiRef.current.setUserManagementOpen(true);
  }, []);
  const closeIntegrations = useCallback(() => uiRef.current.setUserManagementOpen(false), []);

  const openInEditor = useCallback((kind: AiOpBatchTargetKind, id: string) => {
    setPanelOpen(false);
    if (kind === "workspace") return;
    uiRef.current.openReference({ kind: kind === "data_model" ? "dataModel" : "flow", id });
  }, []);

  const openWorkspace = useCallback((request?: Omit<AiWorkspaceRequest, "nonce">) => {
    setPanelOpen(false);
    setWorkspaceRequest({ ...request, nonce: Date.now() });
  }, []);
  const closeWorkspace = useCallback(() => setWorkspaceRequest(null), []);

  const subscribe = runtime?.subscribe;
  useEffect(() => {
    if (!subscribe) return undefined;
    return subscribe((event) => {
      if (event.type === "ai_open_in_editor") {
        openInEditor(event.target.kind, event.target.id);
      }
    });
  }, [openInEditor, subscribe]);

  const value = useMemo<AiUiContextValue>(
    () => ({
      panelOpen,
      openPanel,
      closePanel,
      panelRequest,
      consumePanelRequest,
      integrations,
      openIntegrations,
      closeIntegrations,
      integrationsRequest,
      openInEditor,
      workspaceRequest,
      openWorkspace,
      closeWorkspace,
    }),
    [
      panelOpen,
      openPanel,
      closePanel,
      panelRequest,
      consumePanelRequest,
      integrations,
      openIntegrations,
      closeIntegrations,
      integrationsRequest,
      openInEditor,
      workspaceRequest,
      openWorkspace,
      closeWorkspace,
    ],
  );

  return <AiUiContext.Provider value={value}>{children}</AiUiContext.Provider>;
}
