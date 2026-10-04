import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAiRuntimeActions, useAiRuntimeState } from "../AiRuntimeContext";
import { isMissingSessionStatus, useAiSession } from "../../../hooks/useAiSession";
import { useAiSessions } from "../../../hooks/useAiSessions";
import { useEscapeKey } from "../../../hooks/useEscapeKey";
import { usePersistentState } from "../../../hooks/usePersistentState";
import type { AiMention, AiScopeKind } from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { Tooltip } from "../../../components/primitives/Tooltip";
import { AiChatView, useChatRoute, type AiSuggestion } from "./AiChatView";
import { AiSessionList, InlineRename, sessionTitle } from "./AiSessionList";
import { isActiveTurn } from "./aiHelpers";
import { useAiUi } from "./AiUiContext";

interface NewSessionSeed {
  key: number;
  mentions?: AiMention[];
  prompt?: string;
  scopeKind?: AiScopeKind;
  scopeId?: string | null;
}

type Drawer = "sessions" | null;

const CREATE_SUGGESTIONS: AiSuggestion[] = [
  {
    title: "Create an epic",
    hint: "Outline a goal with scope and outcomes",
    prompt: "Create an epic for ",
    icon: "epic",
  },
  {
    title: "Write user stories",
    hint: "Break a feature into stories with acceptance criteria",
    prompt: "Write user stories for ",
    icon: "list",
  },
  {
    title: "Design a flow",
    hint: "Map steps, branches and edge cases",
    prompt: "Create a flow for ",
    icon: "flow",
  },
  {
    title: "Design a data model",
    hint: "Draft entities, fields and relations",
    prompt: "Create a data model for ",
    icon: "dataModel",
  },
];

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

const canStream = typeof EventSource !== "undefined";

export function AiPanel() {
  const ai = useAiUi();
  const { projectId, reconnect, currentUserId } = useAiRuntimeActions();
  const { me, connection } = useAiRuntimeState();
  const titleId = useId();
  const openerRef = useRef<HTMLElement | null>(null);
  if (openerRef.current === null && typeof document !== "undefined") {
    const focused = document.activeElement;
    openerRef.current =
      focused instanceof HTMLElement && focused !== document.body ? focused : null;
  }
  useEffect(
    () => () => {
      const opener = openerRef.current;
      if (opener && opener.isConnected) opener.focus();
    },
    [],
  );
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

  const activeTurn = session.detail?.session.activeTurn;
  const stoppable = isActiveTurn(activeTurn) && activeTurn?.userId === currentUserId;
  const { interrupt } = session;
  const close = useCallback(() => {
    if (drawer) {
      setDrawer(null);
      return;
    }
    const focused = typeof document !== "undefined" ? document.activeElement : null;
    if (stoppable && focused instanceof HTMLElement && focused.closest(".wpn-ai-composer")) {
      void interrupt().catch(() => undefined);
      return;
    }
    ai?.closePanel();
  }, [ai, drawer, interrupt, stoppable]);
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
      aria-modal="false"
      aria-labelledby={titleId}
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
          <span className="wpn-flow-panel__brand-icon wpn-flow-panel__brand-icon--ai">
            <Icon name="sparkles" />
          </span>
          <span id={titleId} className="wpn-panel__title">
            WeCollab
          </span>
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
      {me && (connection === "unauthenticated" || connection === "closed") && canStream ? (
        <div className="wpn-ai-reconnecting wpn-ai-reconnecting--offline" role="status">
          <span className="wpn-ai-reconnecting__dot" aria-hidden="true" />
          {connection === "unauthenticated"
            ? "Live updates need you to sign in again."
            : "Live updates are paused."}
          <button type="button" className="wpn-ai-link" onClick={reconnect}>
            Reconnect
          </button>
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
            suggestions={CREATE_SUGGESTIONS}
          />
        </main>
      </div>
    </div>
  );
}
