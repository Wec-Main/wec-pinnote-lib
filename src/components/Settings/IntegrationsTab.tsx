import { useCallback, useEffect, useState } from "react";
import { prefetchAiActionTemplates } from "../../ai/prefetch";
import { useSkeletonGate } from "../../hooks/useSkeletonGate";
import { IntegrationsSkeleton } from "../loading/ScreenSkeletons";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { Icon, Spinner, type IconName } from "../primitives";
import type { IntegrationsSection } from "../Ai/AiUiContext";
import { ConnectionsPanel, ConnectorsPanel, connectionRows } from "../Ai/ConnectorsPanel";
import { PromptsWorkbench } from "../Ai/prompts/PromptsWorkbench";

type TabSection = IntegrationsSection | "prompts";

const SECTIONS: { id: TabSection; label: string; icon: IconName }[] = [
  { id: "connectors", label: "Connectors", icon: "sparkles" },
  { id: "connections", label: "Connections", icon: "plug" },
  { id: "prompts", label: "Prompts", icon: "editNote" },
];

interface IntegrationsTabProps {
  section?: IntegrationsSection;
}

export function IntegrationsTab({ section: requestedSection }: IntegrationsTabProps = {}) {
  const runtime = useOptionalAiRuntime();
  const [section, setSection] = useState<TabSection>(requestedSection ?? "connectors");
  const me = runtime?.me ?? null;
  const pending = Boolean(runtime?.enabled && runtime.projectId && !runtime.meError && !me);
  const showSkeleton = useSkeletonGate(pending);
  const canManageTemplates = Boolean(me?.canManageAiTemplates);
  const warmPrompts = useCallback(() => {
    if (!runtime || !runtime.enabled || !canManageTemplates) return;
    void prefetchAiActionTemplates({
      apiBaseUrl: runtime.apiBaseUrl,
      projectId: runtime.projectId,
      getToken: runtime.getToken,
    });
  }, [canManageTemplates, runtime]);

  useEffect(() => {
    warmPrompts();
  }, [warmPrompts]);

  useEffect(() => {
    if (requestedSection) setSection(requestedSection);
  }, [requestedSection]);

  if (!runtime || !runtime.enabled || !me || showSkeleton) {
    return (
      <div className="wpn-settings-tab">
        {pending || showSkeleton ? (
          showSkeleton ? (
            <div role="status" aria-label="Loading integrations" data-wpn-loading="skeleton">
              <IntegrationsSkeleton />
            </div>
          ) : (
            <div aria-busy="true" data-wpn-loading="pending" style={{ minHeight: 240 }} />
          )
        ) : runtime?.enabled && runtime.meError ? (
          <div className="wpn-inline-error" role="alert">
            <span>
              Could not load AI integrations: {runtime.meError}
              {runtime.meRetrying ? " Retrying automatically…" : ""}
            </span>
            <button
              type="button"
              className="wpn-btn wpn-btn--ghost"
              disabled={runtime.meLoading}
              onClick={runtime.refreshMe}
            >
              {runtime.meLoading ? <Spinner /> : null}
              Retry now
            </button>
          </div>
        ) : (
          <p className="wpn-ai-muted">
            {runtime?.enabled
              ? "AI integrations are not available for this project."
              : "AI integrations are turned off for this app, or you are not signed in."}
          </p>
        )}
      </div>
    );
  }

  const connectedCount = connectionRows(me.connectors).length;
  const canManagePrompts = Boolean(me.canManageAiTemplates);
  const sections = SECTIONS.filter((item) => item.id !== "prompts" || canManagePrompts);
  const active = section === "prompts" && !canManagePrompts ? "connectors" : section;

  return (
    <div className="wpn-settings-tab wpn-ai-settings wpn-reveal" data-wpn-loading="ready">
      <div className="wpn-ai-subtabs" role="tablist" aria-label="Integrations">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`wpn-ai-subtab-${item.id}`}
            aria-selected={active === item.id}
            aria-controls={`wpn-ai-subpanel-${item.id}`}
            className={["wpn-ai-subtab", active === item.id ? "wpn-ai-subtab--active" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSection(item.id)}
            onPointerEnter={item.id === "prompts" ? warmPrompts : undefined}
            onFocus={item.id === "prompts" ? warmPrompts : undefined}
          >
            <Icon name={item.icon} className="wpn-ai-subtab__icon" />
            {item.label}
            {item.id === "connections" && connectedCount > 0 ? (
              <span className="wpn-ai-subtab__count">{connectedCount}</span>
            ) : null}
          </button>
        ))}
      </div>
      {active === "connectors" ? (
        <div
          role="tabpanel"
          id="wpn-ai-subpanel-connectors"
          aria-labelledby="wpn-ai-subtab-connectors"
        >
          <ConnectorsPanel />
        </div>
      ) : active === "prompts" ? (
        <div role="tabpanel" id="wpn-ai-subpanel-prompts" aria-labelledby="wpn-ai-subtab-prompts">
          <PromptsWorkbench />
        </div>
      ) : (
        <div
          role="tabpanel"
          id="wpn-ai-subpanel-connections"
          aria-labelledby="wpn-ai-subtab-connections"
        >
          <ConnectionsPanel onGoToConnectors={() => setSection("connectors")} />
        </div>
      )}
    </div>
  );
}
