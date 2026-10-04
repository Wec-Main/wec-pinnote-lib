import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useAiPreview } from "../aiPreviewStore";
import type { AiOpBatchApplier } from "../useAiOpBatchApplier";
import { useOptionalAiRuntime } from "../AiRuntimeContext";
import { useAiSession } from "../../../hooks/useAiSession";
import { useAiSessions } from "../../../hooks/useAiSessions";
import { createAiSession, sendAiMessage } from "../../../services/aiService";
import type { AiEditorTargetKind, AiOpBatch } from "../../../types/ai.types";
import { Icon } from "../../../components/primitives/Icon";
import { aiEditorRequests } from "./aiEditorRequests";
import {
  aiReady,
  connectAgentHint,
  describeAiError,
  isActiveTurn,
  resolveRoute,
  routeLabel,
} from "./aiHelpers";
import { AiThinking } from "./AiThinking";
import { useAiUi } from "./AiUiContext";
import { useAiAvailable } from "./IntegrationsButton";
import { useAiDefaults } from "./useAiPreferences";

export interface AiInlineBarProps {
  kind: AiEditorTargetKind;
  targetId: string;
  applier: AiOpBatchApplier;
  getSelectedIds: () => string[];
  selectedCount: number;
  itemNoun: readonly [string, string];
  wholeLabel: string;
  editable?: boolean;
  focusSignal?: number;
}

const HISTORY_LIMIT = 20;

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function AiInlineBar(props: AiInlineBarProps) {
  const runtime = useOptionalAiRuntime();
  const available = useAiAvailable();
  if (!runtime || !available) return null;
  return <AiInlineBarInner {...props} />;
}

function AiInlineBarInner({
  kind,
  targetId,
  applier,
  getSelectedIds,
  selectedCount,
  itemNoun,
  wholeLabel,
  editable = true,
  focusSignal = 0,
}: AiInlineBarProps) {
  const runtime = useOptionalAiRuntime();
  const ai = useAiUi();
  const me = runtime?.me ?? null;
  const [defaults] = useAiDefaults();
  const { sessions } = useAiSessions({ scopeKind: kind, scopeId: targetId, mine: true, limit: 5 });
  const [createdId, setCreatedId] = useState<string | null>(null);
  useEffect(() => {
    setCreatedId(null);
  }, [kind, targetId]);
  const aiSessionId = createdId ?? sessions[0]?.aiSessionId ?? null;
  const session = useAiSession(aiSessionId);
  const overlay = useAiPreview(kind, targetId);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const applierRef = useRef(applier);
  applierRef.current = applier;
  const sessionIdRef = useRef(aiSessionId);
  sessionIdRef.current = aiSessionId;

  const route = resolveRoute(me, defaults);
  const ready = aiReady(me);
  const canApply = Boolean(me?.canApplyModelOps) && editable;
  const activeTurn = session.detail?.session.activeTurn ?? null;
  const running = isActiveTurn(activeTurn);
  const previewing = applier.previewingBatchId !== null;

  const preview = useCallback(async (batch: AiOpBatch) => {
    setConflict(null);
    const outcome = await applierRef.current.preview(batch);
    if (!outcome.ok) {
      setConflict(outcome.detail);
    }
  }, []);

  const subscribe = runtime?.subscribe;
  useEffect(() => {
    if (!subscribe || !canApply) return undefined;
    return subscribe((event) => {
      if (event.type !== "ai_op_batch.upserted") return;
      const { batch } = event;
      if (batch.targetKind !== kind || batch.targetId !== targetId || batch.status !== "proposed") {
        return;
      }
      if (aiEditorRequests.isMyTurn(batch.aiTurnId) || batch.aiSessionId === sessionIdRef.current) {
        void preview(batch);
      }
    });
  }, [canApply, kind, preview, subscribe, targetId]);

  useEffect(() => {
    if (!canApply) return undefined;
    const check = () => {
      const batch = aiEditorRequests.take(kind, targetId);
      if (batch) void preview(batch);
    };
    check();
    return aiEditorRequests.subscribe(check);
  }, [canApply, kind, preview, targetId]);

  useEffect(() => {
    if (focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal]);

  useEffect(() => {
    const scope = rootRef.current?.closest(".wpn-flow-stage") ?? null;
    const handler = (event: globalThis.KeyboardEvent) => {
      const target = event.target as Node | null;
      const inScope =
        !scope || (target instanceof Node && scope.contains(target)) || target === document.body;
      if (!inScope) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (!applierRef.current.previewingBatchId || event.target === inputRef.current) return;
      if (isEditable(event.target)) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("button, a, [role='dialog']")
      ) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        applierRef.current.accept();
      } else if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        void applierRef.current.reject();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !route || sending || running) return;
    setSending(true);
    setMessage(null);
    setConflict(null);
    const itemIds = getSelectedIds();
    try {
      const authToken = await runtime?.getToken();
      const apiBaseUrl = runtime?.apiBaseUrl ?? "";
      let id = sessionIdRef.current;
      if (!id) {
        const created = await createAiSession(apiBaseUrl, authToken, {
          projectId: runtime?.projectId ?? "",
          mode: "model",
          scopeKind: kind,
          scopeId: targetId,
          provider: route.provider,
          model: route.model,
          effort: route.effort,
        });
        id = created.aiSessionId;
        setCreatedId(id);
        sessionIdRef.current = id;
      }
      const response = await sendAiMessage(apiBaseUrl, authToken, id, {
        text: trimmed,
        mentions: [],
        selection: { kind, id: targetId, itemIds },
        mode: "model",
        provider: route.provider,
        model: route.model,
        effort: route.effort,
      });
      aiEditorRequests.rememberTurn(response.turn.aiTurnId);
      history.current = [trimmed, ...history.current.filter((item) => item !== trimmed)].slice(
        0,
        HISTORY_LIMIT,
      );
      historyIndex.current = -1;
      setPrompt("");
      if (sessionIdRef.current === id) session.reload();
    } catch (err) {
      setMessage({ tone: "error", text: describeAiError(err, "Could not send to AI") });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      if (previewing && !prompt.trim()) applier.accept();
      else void send(prompt);
      return;
    }
    if (event.key === "Escape") {
      if (previewing) {
        event.preventDefault();
        event.stopPropagation();
        void applier.reject();
      } else if (prompt) {
        event.stopPropagation();
        setPrompt("");
      } else {
        inputRef.current?.blur();
      }
      return;
    }
    if (event.key === "ArrowUp" && history.current.length > 0) {
      event.preventDefault();
      const next = Math.min(historyIndex.current + 1, history.current.length - 1);
      historyIndex.current = next;
      setPrompt(history.current[next] ?? "");
      return;
    }
    if (event.key === "ArrowDown" && historyIndex.current >= 0) {
      event.preventDefault();
      const next = historyIndex.current - 1;
      historyIndex.current = next;
      setPrompt(next >= 0 ? (history.current[next] ?? "") : "");
    }
    event.stopPropagation();
  };

  const scopeText =
    selectedCount > 0
      ? `${selectedCount} ${selectedCount === 1 ? itemNoun[0] : itemNoun[1]} selected`
      : wholeLabel;
  const disabledReason = !canApply
    ? editable
      ? "Your role can't apply AI changes to this document"
      : "This document is read-only"
    : !ready
      ? connectAgentHint(me)
      : null;

  const status = running
    ? activeTurn?.status === "queued"
      ? "Queued…"
      : session.draft?.status || "Thinking…"
    : null;
  const removed = overlay?.removed.size ?? 0;

  return (
    <div
      ref={rootRef}
      className={["wpn-ai-bar", previewing ? "wpn-ai-bar--previewing" : ""].join(" ")}
      role="region"
      aria-label="Ask AI"
      onPointerDown={(event) => event.stopPropagation()}
    >
      {previewing && overlay ? (
        <div className="wpn-ai-bar__preview" role="status">
          <span className="wpn-ai-bar__counts">
            <span className="wpn-ai-batch__added">+{overlay.added.size}</span>{" "}
            <span className="wpn-ai-batch__changed">~{overlay.changed.size}</span>{" "}
            <span className="wpn-ai-batch__removed">−{removed}</span>
            {removed > 0 ? <span className="wpn-ai-muted"> ({removed} removed)</span> : null}
          </span>
          <span className="wpn-ai-muted">Enter to accept · Esc to reject</span>
          <button
            type="button"
            className="wpn-btn wpn-btn--primary"
            onClick={() => applier.accept()}
          >
            <Icon name="check" className="wpn-btn__icon" />
            Accept
          </button>
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={() => void applier.reject()}
          >
            <Icon name="x" className="wpn-btn__icon" />
            Reject
          </button>
        </div>
      ) : null}
      {conflict ? (
        <div className="wpn-ai-bar__line wpn-ai-card__warn" role="alert">
          Couldn't apply the AI change: {conflict}
          <button
            type="button"
            className="wpn-ai-link"
            onClick={() =>
              void send(
                `The previous change could not be applied to the current document: ${conflict}. Please read it again and retry.`,
              )
            }
          >
            Retry with AI
          </button>
        </div>
      ) : null}
      {status || message || applier.error ? (
        <div
          className={`wpn-ai-bar__line wpn-ai-bar__line--${message?.tone ?? (applier.error ? "error" : "info")}`}
          aria-live="polite"
        >
          {status ? (
            <AiThinking label={status} provider={route?.provider} />
          ) : (
            (message?.text ?? applier.error)
          )}
        </div>
      ) : null}
      <div className="wpn-ai-bar__row">
        <Icon name="sparkles" className="wpn-ai-bar__icon" />
        <span className="wpn-ai-bar__scope">{scopeText}</span>
        <input
          ref={inputRef}
          className="wpn-ai-bar__input"
          aria-label="Ask AI to change this document"
          placeholder={disabledReason ?? "Ask AI to change this… (⌘I)"}
          value={prompt}
          disabled={Boolean(disabledReason) || sending}
          onChange={(event) => {
            setPrompt(event.target.value);
            historyIndex.current = -1;
          }}
          onKeyDown={onKeyDown}
        />
        {disabledReason && canApply ? (
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={() => ai?.openIntegrations("connectors")}
          >
            <Icon name="plug" className="wpn-btn__icon" />
            Connect
          </button>
        ) : (
          <span className="wpn-ai-bar__route">{routeLabel(route, me)}</span>
        )}
        {running ? (
          <button
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={() => void session.interrupt().catch(() => undefined)}
          >
            <Icon name="stop" className="wpn-btn__icon" />
            Stop
          </button>
        ) : null}
        {aiSessionId && ai ? (
          <button
            type="button"
            className="wpn-ai-link"
            onClick={() => ai.openPanel({ aiSessionId })}
          >
            <Icon name="open" className="wpn-btn__icon" />
            Open in chat
          </button>
        ) : null}
      </div>
    </div>
  );
}
