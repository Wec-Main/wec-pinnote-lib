import { useCallback, useEffect, useState } from "react";
import { useAiRuntime } from "../../context/AiRuntimeContext";
import { isMissingSessionStatus, useAiSession } from "../../hooks/useAiSession";
import { useAiSessions } from "../../hooks/useAiSessions";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { usePersistentState } from "../../hooks/usePersistentState";
import type { AiMention, AiScopeKind } from "../../types/ai.types";
import { Icon, Tooltip } from "../primitives";
import { AiChatView, useChatRoute } from "./AiChatView";
import { AiSessionList, InlineRename, sessionTitle } from "./AiSessionList";
import { useAiUi } from "./AiUiContext";
import { AiWorkspaceButton } from "./AiWorkspaceButton";

interface NewSessionSeed {
  key: number;
  mentions?: AiMention[];
  prompt?: string;
  scopeKind?: AiScopeKind;
  scopeId?: string | null;
}

type Drawer = "sessions" | null;

export const AI_PANEL_DRAWER_BREAKPOINT = 900;

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

function useNarrow(breakpoint: number): boolean {
  const read = () => typeof window !== "undefined" && window.innerWidth < breakpoint;
  const [narrow, setNarrow] = useState(read);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return narrow;
}

export function AiPanel() {
  const ai = useAiUi();
  const { projectId, me, connection } = useAiRuntime();
  const [selectedId, setSelectedId] = usePersistentState<string | null>(
    `wpn-ui:${projectId}:aiSession`,
    null,
    isNullableString,
  );
  const [seed, setSeed] = useState<NewSessionSeed>({ key: 0 });
  const [renaming, setRenaming] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const narrow = useNarrow(AI_PANEL_DRAWER_BREAKPOINT);
  const session = useAiSession(selectedId);
  const sessionsState = useAiSessions({ limit: 50, includeActions: true });
  const [route, setRoute] = useChatRoute(me, session, selectedId);
  const request = ai?.panelRequest ?? null;
  const consume = ai?.consumePanelRequest;

  useEffect(() => {
    if (!request) return;
    if (request.aiSessionId) {
      setSelectedId(request.aiSessionId);
    } else if (request.newSession || request.mentions || request.prompt) {
      setSelectedId(null);
      setSeed((current) => ({
        key: current.key + 1,
        mentions: request.mentions,
        prompt: request.prompt,
        scopeKind: request.scopeKind,
        scopeId: request.scopeId,
      }));
    }
    consume?.();
  }, [consume, request, setSelectedId]);

  const archived = Boolean(session.detail?.session.archivedAt);
  useEffect(() => {
    if (!selectedId) return;
    if (session.deleted || archived || isMissingSessionStatus(session.errorStatus)) {
      setSelectedId(null);
    }
  }, [archived, selectedId, session.deleted, session.errorStatus, setSelectedId]);

  useEffect(() => {
    if (!narrow) setDrawer(null);
  }, [narrow]);

  useEffect(() => {
    setRenaming(false);
  }, [selectedId]);

  const close = useCallback(() => {
    if (drawer) setDrawer(null);
    else ai?.closePanel();
  }, [ai, drawer]);
  useEscapeKey(close, !renaming);

  const detail = session.detail;
  const current = detail?.session ?? null;
  const startNew = () => {
    setSelectedId(null);
    setSeed((value) => ({ key: value.key + 1 }));
    setDrawer(null);
  };

  return (
    <div
      className={[
        "wpn-flow-panel",
        "wpn-ai-panel",
        narrow ? "wpn-ai-panel--narrow" : "",
        drawer ? `wpn-ai-panel--drawer-${drawer}` : "",
      ].join(" ")}
      role="dialog"
      aria-label="AI assistant"
    >
      <div className="wpn-flow-panel__header">
        <span className="wpn-flow-panel__brand">
          {narrow ? (
            <button
              type="button"
              className="wpn-icon-btn"
              aria-label="Show chats"
              aria-expanded={drawer === "sessions"}
              onClick={() => setDrawer((value) => (value === "sessions" ? null : "sessions"))}
            >
              <Icon name="sidebar" />
            </button>
          ) : null}
          <span className="wpn-flow-panel__brand-icon">
            <Icon name="sparkles" />
          </span>
          <span className="wpn-panel__title">WeCollab AI</span>
          {current ? (
            renaming ? (
              <InlineRename
                key={current.aiSessionId}
                value={sessionTitle(current)}
                onSave={(title) => session.update({ title })}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <button
                type="button"
                className="wpn-ai-panel__session-title"
                title="Rename chat"
                onClick={() => setRenaming(true)}
              >
                {sessionTitle(current)}
              </button>
            )
          ) : null}
        </span>
        <div className="wpn-flow-panel__header-actions">
          <AiWorkspaceButton
            label="Create"
            tooltip="Create or update epics, user stories, flows and data models with AI"
          />
          {narrow ? (
            <Tooltip label="New chat" placement="bottom">
              <button
                type="button"
                className="wpn-icon-btn"
                aria-label="New chat"
                onClick={startNew}
              >
                <Icon name="newChat" />
              </button>
            </Tooltip>
          ) : null}
          <Tooltip label="Close" placement="bottom">
            <button
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close AI"
              onClick={() => ai?.closePanel()}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>
      </div>
      {connection === "reconnecting" ? (
        <div className="wpn-ai-reconnecting" role="status">
          <span className="wpn-ai-reconnecting__dot" aria-hidden="true" />
          Reconnecting…
        </div>
      ) : null}
      <div className="wpn-flow-panel__body wpn-ai-panel__body">
        {narrow && drawer ? (
          <button
            type="button"
            className="wpn-ai-drawer-scrim"
            aria-label="Close drawer"
            tabIndex={-1}
            onClick={() => setDrawer(null)}
          />
        ) : null}
        <AiSessionList
          className={narrow ? "wpn-ai-drawer wpn-ai-drawer--left" : undefined}
          state={sessionsState}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setDrawer(null);
          }}
          onNew={startNew}
          onClose={narrow ? () => setDrawer(null) : undefined}
        />
        <main className="wpn-ai-panel__main">
          <AiChatView
            key={`chat-${seed.key}`}
            aiSessionId={selectedId}
            session={session}
            onSessionCreated={setSelectedId}
            initialMentions={selectedId ? undefined : seed.mentions}
            initialText={selectedId ? undefined : seed.prompt}
            scopeKind={seed.scopeKind}
            scopeId={seed.scopeId}
            route={route}
            onRouteChange={setRoute}
            showRoutePicker
          />
        </main>
      </div>
    </div>
  );
}
