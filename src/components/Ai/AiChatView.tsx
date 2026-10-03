import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAiCurrentSelection } from "../../ai/aiSelectionStore";
import { useAiRuntime } from "../../context/AiRuntimeContext";
import { useAiSession, type AiSessionState } from "../../hooks/useAiSession";
import { createAiSession, sendAiMessage } from "../../services/aiApi";
import type {
  AiMe,
  AiMention,
  AiMessage,
  AiScopeKind,
  SendAiMessageRequest,
  SendAiMessageResponse,
} from "../../types/ai.types";
import { Icon, type IconName } from "../primitives";
import {
  AiComposer,
  writeComposerDraft,
  type AiComposerSeed,
  type AiComposerSendInput,
} from "./AiComposer";
import { AiRoutePicker } from "./AiRoutePicker";
import { AiTranscript, FailureActions } from "./AiTranscript";
import { aiEditorRequests } from "./aiEditorRequests";
import {
  aiErrorCode,
  aiErrorText,
  aiReady,
  connectAgentHint,
  connectedProviders,
  describeAiError,
  isActiveTurn,
  resolveRoute,
  type AiRoute,
} from "./aiHelpers";
import { useAiUi } from "./AiUiContext";
import { useAiMentionCandidates } from "./useAiMentionCandidates";
import { useAiDefaults } from "./useAiPreferences";

export interface AiSuggestion {
  title: string;
  prompt: string;
  hint?: string;
  icon?: IconName;
  tone?: string;
}

export interface AiChatViewProps {
  aiSessionId: string | null;
  onSessionCreated: (aiSessionId: string) => void;
  compact?: boolean;
  initialMentions?: readonly AiMention[];
  initialText?: string;
  scopeKind?: AiScopeKind;
  scopeId?: string | null;
  session?: AiSessionState;
  route?: AiRoute | null;
  onRouteChange?: (route: AiRoute) => void;
  showRoutePicker?: boolean;
  suggestions?: readonly AiSuggestion[];
  autoFocus?: boolean;
}

interface ChatFailure {
  message: string;
  code: string | null;
}

export function newChatDraftKey(scopeKind: AiScopeKind, scopeId: string | null): string {
  return `new:${scopeKind}:${scopeId ?? ""}`;
}

export function otherProviderRoute(me: AiMe | null, route: AiRoute | null): AiRoute | null {
  if (!route) return null;
  const other = connectedProviders(me).find((provider) => provider !== route.provider);
  return other ? resolveRoute(me, { provider: other, model: null, effort: null }) : null;
}

export function useChatRoute(
  me: AiMe | null,
  session: AiSessionState,
  aiSessionId: string | null,
): [AiRoute | null, (route: AiRoute) => void] {
  const [defaults] = useAiDefaults();
  const [override, setOverride] = useState<AiRoute | null>(null);
  const current = session.detail?.session ?? null;
  const previousId = useRef(aiSessionId);
  useEffect(() => {
    if (previousId.current !== null && previousId.current !== aiSessionId) setOverride(null);
    previousId.current = aiSessionId;
  }, [aiSessionId]);
  const preference = current
    ? { provider: current.provider, model: current.model, effort: current.effort }
    : defaults;
  return [override ?? resolveRoute(me, preference), setOverride];
}

function lastUserMessage(session: AiSessionState): AiMessage | null {
  const { order, byId } = session.messages;
  for (let index = order.length - 1; index >= 0; index -= 1) {
    const message = byId[order[index] as string];
    if (message?.role === "user" && message.content.type === "text") return message;
  }
  return null;
}

function inputOf(message: AiMessage): AiComposerSendInput | null {
  if (message.content.type !== "text") return null;
  return {
    text: message.content.text,
    mentions: message.content.mentions ?? [],
    selection: message.content.selection ?? null,
  };
}

export function AiChatView({
  aiSessionId,
  onSessionCreated,
  compact = false,
  initialMentions,
  initialText,
  scopeKind = "project",
  scopeId = null,
  session: sessionFromParent,
  route: routeProp,
  onRouteChange,
  showRoutePicker,
  suggestions,
  autoFocus = true,
}: AiChatViewProps) {
  const runtime = useAiRuntime();
  const { me, apiBaseUrl, getToken, projectId, currentUserId } = runtime;
  const ai = useAiUi();
  const ownSession = useAiSession(sessionFromParent ? null : aiSessionId);
  const session = sessionFromParent ?? ownSession;
  const mentions = useAiMentionCandidates();
  const selection = useAiCurrentSelection();
  const [ownRoute, setOwnRoute] = useChatRoute(me, session, aiSessionId);
  const controlled = routeProp !== undefined;
  const route = controlled ? routeProp : ownRoute;
  const setRoute = useCallback(
    (next: AiRoute) => {
      if (!controlled) setOwnRoute(next);
      onRouteChange?.(next);
    },
    [controlled, onRouteChange, setOwnRoute],
  );
  const [failure, setFailure] = useState<ChatFailure | null>(null);
  const [seed, setSeed] = useState<AiComposerSeed | null>(null);
  const [optimistic, setOptimistic] = useState<{
    text: string;
    mentions: AiMention[];
    at: number;
  } | null>(null);
  const createdRef = useRef<string | null>(null);
  const sessionIdRef = useRef(aiSessionId);
  sessionIdRef.current = aiSessionId;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const lastAttemptRef = useRef<AiComposerSendInput | null>(null);
  const current = session.detail?.session ?? null;

  useEffect(() => {
    if (aiSessionId && aiSessionId === createdRef.current) return;
    createdRef.current = null;
    setFailure(null);
  }, [aiSessionId]);

  const ready = aiReady(me);
  const active = isActiveTurn(current?.activeTurn);
  const alternate = useMemo(() => otherProviderRoute(me, route), [me, route]);
  const newKey = newChatDraftKey(scopeKind, scopeId);

  const submit = useCallback(
    async (input: AiComposerSendInput, routeOverride?: AiRoute | null) => {
      const target = routeOverride ?? route;
      if (!target) return;
      setFailure(null);
      lastAttemptRef.current = input;
      const request: SendAiMessageRequest = {
        text: input.text,
        mentions: input.mentions,
        mode: "model",
        provider: target.provider,
        model: target.model,
        effort: target.effort,
      };
      if (input.selection) request.selection = input.selection;
      try {
        let id = sessionIdRef.current ?? createdRef.current;
        if (!id) {
          const authToken = await getToken();
          const created = await createAiSession(apiBaseUrl, authToken, {
            projectId,
            mode: "model",
            scopeKind,
            scopeId,
            provider: target.provider,
            model: target.model,
            effort: target.effort,
          });
          id = created.aiSessionId;
          createdRef.current = id;
          writeComposerDraft(newKey, null);
          onSessionCreated(id);
        }
        const live = sessionRef.current;
        let response: SendAiMessageResponse;
        if (live.detail?.session.aiSessionId === id) {
          response = await live.send(request);
        } else {
          const authToken = await getToken();
          response = await sendAiMessage(apiBaseUrl, authToken, id, request);
        }
        aiEditorRequests.rememberTurn(response.turn.aiTurnId);
      } catch (err) {
        const code = aiErrorCode(err);
        setFailure({ code, message: describeAiError(err, "Could not send to AI") });
        throw err;
      }
    },
    [apiBaseUrl, getToken, newKey, onSessionCreated, projectId, route, scopeId, scopeKind],
  );

  const resend = useCallback(
    (routeOverride?: AiRoute | null) => {
      const last = lastUserMessage(sessionRef.current);
      const input = (last && inputOf(last)) ?? lastAttemptRef.current;
      if (!input) return;
      if (routeOverride) setRoute(routeOverride);
      void submit(input, routeOverride).catch(() => undefined);
    },
    [setRoute, submit],
  );

  const sendNow = useCallback(
    (input: AiComposerSendInput) => {
      setOptimistic({ text: input.text, mentions: input.mentions, at: Date.now() });
      submit(input).catch(() => {
        setOptimistic(null);
        setSeed((value) => ({
          text: input.text,
          mentions: input.mentions,
          nonce: (value?.nonce ?? 0) + 1,
        }));
      });
    },
    [submit],
  );

  const answerQuestions = useCallback(
    (answers: string) => sendNow({ text: answers, mentions: [] }),
    [sendNow],
  );

  const retry = useCallback(() => resend(), [resend]);
  const retryWithOther = useCallback(() => resend(alternate), [alternate, resend]);
  const openIntegrations = useCallback(() => ai?.openIntegrations("connectors"), [ai]);
  const editLast = useCallback((message: AiMessage) => {
    const input = inputOf(message);
    if (!input) return;
    setSeed((value) => ({
      text: input.text,
      mentions: input.mentions,
      nonce: (value?.nonce ?? 0) + 1,
    }));
  }, []);

  const retryAttempt = () => {
    const input = lastAttemptRef.current;
    if (input) void submit(input).catch(() => undefined);
  };
  const retryAttemptWithOther = () => {
    const input = lastAttemptRef.current;
    if (!input || !alternate) return;
    setRoute(alternate);
    void submit(input, alternate).catch(() => undefined);
  };

  const stop = () => {
    session
      .interrupt()
      .catch((err: unknown) =>
        setFailure({ code: aiErrorCode(err), message: describeAiError(err, "Could not stop") }),
      );
  };

  const optimisticMatched = Boolean(
    optimistic &&
    session.messages.order.some((id) => {
      const message = session.messages.byId[id];
      return (
        message?.role === "user" &&
        message.content.type === "text" &&
        message.content.text === optimistic.text &&
        Date.parse(message.createdAt) >= optimistic.at - 60_000
      );
    }),
  );
  useEffect(() => {
    if (optimisticMatched) setOptimistic(null);
  }, [optimisticMatched]);
  const pendingUser = optimistic && !optimisticMatched ? optimistic : null;

  const disabledReason = !ready ? connectAgentHint(me) : null;
  const pickSuggestion = (prompt: string) =>
    setSeed((value) => ({ text: prompt, nonce: (value?.nonce ?? 0) + 1 }));

  const emptyHint = (
    <div className="wpn-ai-empty">
      <span className="wpn-ai-empty__icon" aria-hidden="true">
        <Icon name="sparkles" />
      </span>
      <p className="wpn-ai-empty__title">How can I help?</p>
      <p className="wpn-ai-muted">
        Pick a starting point, or type your own request. Mention a data model, flow or comment with{" "}
        <kbd>#</kbd>.
      </p>
      {suggestions && suggestions.length > 0 ? (
        <div className="wpn-ai-suggestions" role="list">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.title}
              type="button"
              role="listitem"
              className="wpn-ai-suggestion"
              disabled={!ready}
              onClick={() => pickSuggestion(suggestion.prompt)}
            >
              <span
                className="wpn-ai-suggestion__tile"
                data-tone={suggestion.tone ?? suggestion.icon ?? "sparkles"}
                aria-hidden="true"
              >
                <Icon name={suggestion.icon ?? "sparkles"} className="wpn-ai-suggestion__icon" />
              </span>
              <span className="wpn-ai-suggestion__text">
                <span className="wpn-ai-suggestion__title">{suggestion.title}</span>
                {suggestion.hint ? (
                  <span className="wpn-ai-suggestion__hint">{suggestion.hint}</span>
                ) : null}
              </span>
              <Icon name="chevronRight" className="wpn-ai-suggestion__go" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const pickerVisible = showRoutePicker ?? !controlled;

  return (
    <div className={["wpn-ai-chat", compact ? "wpn-ai-chat--compact" : ""].join(" ")}>
      <AiTranscript
        key={aiSessionId ?? "new"}
        session={session}
        currentUserId={currentUserId}
        canApplyModelOps={Boolean(me?.canApplyModelOps)}
        compact={compact}
        emptyHint={emptyHint}
        canSwitchProvider={Boolean(alternate)}
        onRetry={route ? retry : undefined}
        onRetryWithProvider={alternate ? retryWithOther : undefined}
        onEditLast={editLast}
        onOpenIntegrations={ai ? openIntegrations : undefined}
        pendingUser={pendingUser}
        onAnswerQuestions={ready ? answerQuestions : undefined}
      />
      {failure ? (
        <div className="wpn-ai-failure wpn-ai-failure--error wpn-ai-chat__failure" role="alert">
          <p className="wpn-ai-notice wpn-ai-notice--error">
            <Icon name="alert" /> {aiErrorText(failure.code, failure.message)}
          </p>
          <FailureActions
            code={failure.code}
            canSwitchProvider={Boolean(alternate)}
            onRetry={lastAttemptRef.current ? retryAttempt : undefined}
            onRetryWithProvider={alternate ? retryAttemptWithOther : undefined}
            onOpenIntegrations={ai ? openIntegrations : undefined}
          />
        </div>
      ) : null}
      {disabledReason ? (
        <div className="wpn-ai-chat__disabled">
          <span>{disabledReason}</span>
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={openIntegrations}>
            <Icon name="plug" className="wpn-btn__icon" />
            Connect
          </button>
        </div>
      ) : null}
      <AiComposer
        candidates={mentions.candidates}
        onMentionTrigger={mentions.request}
        onSend={sendNow}
        disabled={!ready || !route}
        disabledReason={disabledReason}
        active={active && current?.activeTurn?.userId === currentUserId}
        onStop={stop}
        initialMentions={initialMentions}
        initialText={initialText}
        autoFocus={autoFocus}
        compact={compact}
        draftKey={aiSessionId ?? newKey}
        seed={seed}
        selection={selection}
        toolbar={pickerVisible ? <AiRoutePicker me={me} value={route} onChange={setRoute} /> : null}
      />
    </div>
  );
}
