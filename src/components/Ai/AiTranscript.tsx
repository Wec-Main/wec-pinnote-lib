import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AiSessionState } from "../../hooks/useAiSession";
import { staticDraftStore, useAiDraft, type AiDraftStore } from "../../ai/sessionViewStore";
import type {
  AiMention,
  AiCommentDraft,
  AiMessage,
  AiOpBatch,
  AiTurn,
  AiUsage,
} from "../../types/ai.types";
import { useSkeletonGate } from "../../hooks/useSkeletonGate";
import { Icon, Spinner } from "../primitives";
import { TranscriptSkeleton } from "../loading/ScreenSkeletons";
import { formatElapsed, formatTokens } from "./AiActivity";
import { AiMentionChip } from "./AiMentionChip";
import { AiMarkdown } from "./AiMarkdown";
import { useAiOpBatch } from "../../hooks/useAiOpBatch";
import { BatchCard } from "./BatchCard";
import { isWorkspaceBatch } from "./useAiWorkspaceApplier";
import { DraftCommentCard } from "./DraftCommentCard";
import { aiErrorActions, aiErrorText, isActiveTurn, type AiErrorAction } from "./aiHelpers";
import { useAiCardActions } from "./useAiCardActions";
import { AiQuestionsCard } from "./AiQuestionsCard";
import { AiTurnWorking, workTitle } from "./AiTurnWorking";

import { AiDockBoundary } from "./AiDockBoundary";

const WorkspaceBatchCard = lazy(() =>
  import("./WorkspaceBatchCard").then((module) => ({ default: module.WorkspaceBatchCard })),
);

type CardActions = ReturnType<typeof useAiCardActions>;

export type AiFeedback = "up" | "down";

export interface AiTranscriptProps {
  session: AiSessionState;
  currentUserId: string | null;
  canApplyModelOps: boolean;
  compact?: boolean;
  emptyHint?: ReactNode;
  canSwitchProvider?: boolean;
  onRetry?: () => void;
  onRetryWithProvider?: () => void;
  onEditLast?: (message: AiMessage) => void;
  onOpenIntegrations?: () => void;
  onFeedback?: (aiMessageId: string, value: AiFeedback | null) => void;
  onAnswerQuestions?: (answers: string) => void;
  pendingUser?: { text: string; mentions: AiMention[]; at: number } | null;
  supersededUserMessageId?: string | null;
}

export const NEAR_BOTTOM_PX = 80;

export interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export function isNearBottom(metrics: ScrollMetrics, threshold = NEAR_BOTTOM_PX): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold;
}

export function shouldAutoScroll(wasNearBottom: boolean, ownNewMessage: boolean): boolean {
  return wasNearBottom || ownNewMessage;
}

export function restoredScrollTop(
  before: { scrollTop: number; scrollHeight: number },
  nextScrollHeight: number,
): number {
  return Math.max(0, nextScrollHeight - (before.scrollHeight - before.scrollTop));
}

export type ToolStepStatus = "running" | "done" | "failed" | "stopped";

export function resolveToolStatus(
  status: "running" | "ok" | "error",
  turnActive: boolean,
  turn: AiTurn | undefined,
): ToolStepStatus {
  if (status === "ok") return "done";
  if (status === "error") return "failed";
  if (turnActive) return "running";
  return turn?.status === "failed" ? "failed" : "stopped";
}

export function turnFailureText(turn: AiTurn): string | null {
  if (turn.status === "interrupted" || turn.status === "cancelled") {
    return turn.errorCode && turn.errorCode !== "interrupted"
      ? aiErrorText(turn.errorCode, "Stopped.")
      : "Stopped.";
  }
  if (turn.status !== "failed") return null;
  return aiErrorText(turn.errorCode, turn.errorMessage || "The turn failed.");
}

export function hasUsage(usage: AiUsage): boolean {
  return Boolean(
    usage.inputTokens || usage.outputTokens || usage.cachedInputTokens || usage.costUsd,
  );
}

export function usageText(usage: AiUsage): string {
  const parts: string[] = [];
  if (usage.inputTokens) {
    const cached = usage.cachedInputTokens
      ? ` (${formatTokens(usage.cachedInputTokens)} cached)`
      : "";
    parts.push(`${formatTokens(usage.inputTokens)} in${cached}`);
  }
  if (usage.outputTokens) parts.push(`${formatTokens(usage.outputTokens)} out`);
  if (usage.costUsd) parts.push(`$${usage.costUsd < 0.01 ? "<0.01" : usage.costUsd.toFixed(2)}`);
  return parts.join(" · ");
}

type Row =
  | { kind: "user"; key: string; message: AiMessage }
  | {
      kind: "turn";
      key: string;
      aiTurnId: string | null;
      messages: AiMessage[];
      precedingUserId: string | null;
    };

export interface TranscriptRows {
  rows: Row[];
  lastTurnRowIndex: number;
  lastUserIndex: number;
}

function buildRows(order: readonly string[], byId: Readonly<Record<string, AiMessage>>): Row[] {
  const rows: Row[] = [];
  let precedingUserId: string | null = null;
  for (const id of order) {
    const message = byId[id];
    if (!message) continue;
    if (message.role === "user") {
      rows.push({ kind: "user", key: message.aiMessageId, message });
      precedingUserId = message.aiMessageId;
      continue;
    }
    const last = rows[rows.length - 1];
    if (
      last &&
      last.kind === "turn" &&
      last.aiTurnId !== null &&
      last.aiTurnId === message.aiTurnId
    ) {
      last.messages.push(message);
    } else {
      rows.push({
        kind: "turn",
        key: message.aiTurnId
          ? `turn:${message.aiTurnId}:${message.aiMessageId}`
          : message.aiMessageId,
        aiTurnId: message.aiTurnId,
        messages: [message],
        precedingUserId,
      });
    }
  }
  return rows;
}

export function buildTranscriptRows(
  order: readonly string[],
  byId: Readonly<Record<string, AiMessage>>,
): TranscriptRows {
  const rows = buildRows(order, byId);
  let lastTurnRowIndex = -1;
  let lastUserIndex = -1;
  rows.forEach((row, index) => {
    if (row.kind === "turn") lastTurnRowIndex = index;
    else lastUserIndex = index;
  });
  return { rows, lastTurnRowIndex, lastUserIndex };
}

interface RowData {
  batches: AiOpBatch[];
  drafts: AiCommentDraft[];
}

const NO_ROW_DATA: RowData = { batches: [], drafts: [] };

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export function collectRowData(
  rows: readonly Row[],
  opBatches: readonly AiOpBatch[],
  commentDrafts: readonly AiCommentDraft[],
  previous: ReadonlyMap<string, RowData>,
): Map<string, RowData> {
  const batchById = new Map(opBatches.map((batch) => [batch.aiOpBatchId, batch]));
  const draftById = new Map(commentDrafts.map((draft) => [draft.aiCommentDraftId, draft]));
  const next = new Map<string, RowData>();
  for (const row of rows) {
    if (row.kind !== "turn") continue;
    const batches: AiOpBatch[] = [];
    const drafts: AiCommentDraft[] = [];
    for (const message of row.messages) {
      const { content } = message;
      if (content.type === "op_batch") {
        const batch = batchById.get(content.aiOpBatchId);
        if (batch) batches.push(batch);
      } else if (content.type === "comment_draft") {
        const draft = draftById.get(content.aiCommentDraftId);
        if (draft) drafts.push(draft);
      }
    }
    const before = previous.get(row.key);
    if (batches.length === 0 && drafts.length === 0) {
      next.set(row.key, NO_ROW_DATA);
    } else if (before && sameItems(before.batches, batches) && sameItems(before.drafts, drafts)) {
      next.set(row.key, before);
    } else {
      next.set(row.key, { batches, drafts });
    }
  }
  return next;
}

function textOf(message: AiMessage): string {
  return message.content.type === "text" ? message.content.text : "";
}

function copyText(text: string): void {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  void clipboard?.writeText(text).catch(() => undefined);
}

function ToolbarButton({
  label,
  icon,
  onClick,
  pressed,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className="wpn-ai-msgbar__btn"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <ToolbarButton
      label={copied ? "Copied" : "Copy"}
      icon={copied ? "check" : "copy"}
      onClick={() => {
        copyText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    />
  );
}

interface UserRowProps {
  message: AiMessage;
  canEdit: boolean;
  onEdit?: (message: AiMessage) => void;
  onOpenMention?: (mention: AiMention) => void;
}

const LONG_MESSAGE_CHARS = 480;
const LONG_MESSAGE_LINES = 8;

export function parseAnswers(text: string): { question: string; answer: string }[] | null {
  if (!/^here are my answers:/i.test(text.trim())) return null;
  const rows: { question: string; answer: string }[] = [];
  for (const line of text.split("\n").slice(1)) {
    const match = /^\d+\.\s+(.*?)\s+→\s+(.*)$/.exec(line.trim());
    if (match) rows.push({ question: match[1] ?? "", answer: match[2] ?? "" });
  }
  return rows.length > 0 ? rows : null;
}

const UserRow = memo(function UserRow({ message, canEdit, onEdit, onOpenMention }: UserRowProps) {
  const { content } = message;
  const [expanded, setExpanded] = useState(false);
  if (content.type !== "text") return null;
  const answers = parseAnswers(content.text);
  if (answers) {
    return (
      <div className="wpn-ai-transcript__item wpn-ai-row wpn-ai-row--user">
        <div className="wpn-ai-msg wpn-ai-msg--user">
          <div className="wpn-ai-msg__bubble wpn-ai-answers">
            <p className="wpn-ai-answers__title">
              <Icon name="check" /> My answers
            </p>
            <dl className="wpn-ai-answers__list">
              {answers.map((row, index) => (
                <div key={`${index}-${row.question}`} className="wpn-ai-answers__item">
                  <dt>{row.question}</dt>
                  <dd>{row.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    );
  }
  const long =
    content.text.length > LONG_MESSAGE_CHARS ||
    content.text.split("\n").length > LONG_MESSAGE_LINES;
  return (
    <div className="wpn-ai-transcript__item wpn-ai-row wpn-ai-row--user">
      <div className="wpn-ai-msg wpn-ai-msg--user">
        <div className="wpn-ai-msg__bubble">
          {content.mentions?.length ? (
            <span className="wpn-ai-chips">
              {content.mentions.map((mention) => (
                <AiMentionChip
                  key={`${mention.kind}:${mention.id}`}
                  mention={mention}
                  onOpen={onOpenMention}
                />
              ))}
            </span>
          ) : null}
          <p
            className={[
              "wpn-ai-msg__text",
              long && !expanded ? "wpn-ai-msg__text--clamped" : "",
            ].join(" ")}
          >
            {content.text}
          </p>
          {long ? (
            <button
              type="button"
              className="wpn-ai-msg__more"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      </div>
      <div
        className="wpn-ai-msgbar wpn-ai-msgbar--user"
        role="toolbar"
        aria-label="Message actions"
      >
        <CopyButton text={content.text} />
        {canEdit && onEdit ? (
          <ToolbarButton label="Edit and resend" icon="edit" onClick={() => onEdit(message)} />
        ) : null}
      </div>
    </div>
  );
});

function StepList({
  messages,
  active,
  turn,
}: {
  messages: AiMessage[];
  active: boolean;
  turn: AiTurn | undefined;
}) {
  return (
    <ol className="wpn-ai-steps wpn-ai-turn__steps">
      {messages.map((message) => {
        if (message.content.type !== "tool") return null;
        const status = resolveToolStatus(message.content.status, active, turn);
        return (
          <li
            key={message.aiMessageId}
            className={`wpn-ai-step wpn-ai-step--${status}`}
            data-status={status}
          >
            {status === "running" ? (
              <Spinner className="wpn-ai-step__spinner" />
            ) : (
              <span
                className={`wpn-ai-step__badge wpn-ai-step__badge--${status}`}
                aria-hidden="true"
              >
                <Icon name={status === "done" ? "check" : status === "failed" ? "x" : "stop"} />
              </span>
            )}
            <span className="wpn-ai-step__body">
              <span className="wpn-ai-step__label">
                {message.content.summary || message.content.name}
              </span>
            </span>
            <span className="wpn-sr-only">
              {status === "running"
                ? "in progress"
                : status === "done"
                  ? "done"
                  : status === "failed"
                    ? "failed"
                    : "stopped"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function workedMs(messages: AiMessage[], turn: AiTurn | undefined): number {
  const start = Date.parse(turn?.startedAt ?? turn?.createdAt ?? messages[0]?.createdAt ?? "");
  const lastMessage = messages[messages.length - 1];
  const end = Date.parse(turn?.finishedAt ?? lastMessage?.updatedAt ?? "");
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}

interface TurnRowProps {
  messages: AiMessage[];
  turn: AiTurn | undefined;
  active: boolean;
  isLast: boolean;
  opBatches: readonly AiOpBatch[];
  commentDrafts: readonly AiCommentDraft[];
  canApplyModelOps: boolean;
  canSwitchProvider: boolean;
  feedback: AiFeedback | undefined;
  onFeedback: ((aiMessageId: string, value: AiFeedback | null) => void) | undefined;
  actions: CardActions;
  superseded: boolean;
  onRetry?: () => void;
  onRetryWithProvider?: () => void;
  onOpenIntegrations?: () => void;
  onAnswerQuestions?: (answers: string) => void;
}

function sameMessages(a: AiMessage[], b: AiMessage[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((message, index) => message === b[index]);
}

function turnRowEqual(prev: TurnRowProps, next: TurnRowProps): boolean {
  return (
    sameMessages(prev.messages, next.messages) &&
    prev.turn === next.turn &&
    prev.active === next.active &&
    prev.isLast === next.isLast &&
    prev.opBatches === next.opBatches &&
    prev.commentDrafts === next.commentDrafts &&
    prev.canApplyModelOps === next.canApplyModelOps &&
    prev.canSwitchProvider === next.canSwitchProvider &&
    prev.feedback === next.feedback &&
    prev.onFeedback === next.onFeedback &&
    prev.actions === next.actions &&
    prev.superseded === next.superseded &&
    prev.onRetry === next.onRetry &&
    prev.onRetryWithProvider === next.onRetryWithProvider &&
    prev.onOpenIntegrations === next.onOpenIntegrations &&
    prev.onAnswerQuestions === next.onAnswerQuestions
  );
}

export function FailureActions({
  code,
  canSwitchProvider,
  onRetry,
  onRetryWithProvider,
  onOpenIntegrations,
}: {
  code: string | null | undefined;
  canSwitchProvider: boolean;
  onRetry?: () => void;
  onRetryWithProvider?: () => void;
  onOpenIntegrations?: () => void;
}) {
  const actions = aiErrorActions(code).filter((action: AiErrorAction) => {
    if (action === "retry") return Boolean(onRetry);
    if (action === "switch_provider") return canSwitchProvider && Boolean(onRetryWithProvider);
    return Boolean(onOpenIntegrations);
  });
  if (actions.length === 0) return null;
  return (
    <div className="wpn-ai-failure__actions">
      {actions.map((action) =>
        action === "retry" ? (
          <button key={action} type="button" className="wpn-btn wpn-btn--ghost" onClick={onRetry}>
            <Icon name="refresh" className="wpn-btn__icon" />
            Retry
          </button>
        ) : action === "switch_provider" ? (
          <button
            key={action}
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onRetryWithProvider}
          >
            <Icon name="sparkles" className="wpn-btn__icon" />
            Retry with other provider
          </button>
        ) : (
          <button
            key={action}
            type="button"
            className="wpn-btn wpn-btn--ghost"
            onClick={onOpenIntegrations}
          >
            <Icon name="plug" className="wpn-btn__icon" />
            Open Integrations
          </button>
        ),
      )}
    </div>
  );
}

function OpBatchSlot({
  aiOpBatchId,
  batch,
  canApply,
  actions,
}: {
  aiOpBatchId: string;
  batch: AiOpBatch | undefined;
  canApply: boolean;
  actions: CardActions;
}) {
  const fetched = useAiOpBatch(aiOpBatchId, batch !== undefined);
  const resolved = batch ?? fetched;
  if (!resolved) return null;
  if (isWorkspaceBatch(resolved)) {
    return (
      <AiDockBoundary label="This card could not load.">
        <Suspense fallback={<div className="wpn-ai-card-loading" aria-busy="true" />}>
          <WorkspaceBatchCard batch={resolved} canApply={canApply} />
        </Suspense>
      </AiDockBoundary>
    );
  }
  return (
    <BatchCard
      batch={resolved}
      canApply={canApply}
      onPreview={actions.previewBatch}
      onReject={actions.rejectBatch}
      onOpen={actions.openBatch}
    />
  );
}

const TurnRow = memo(function TurnRow({
  messages,
  turn,
  active,
  isLast,
  opBatches,
  commentDrafts,
  canApplyModelOps,
  canSwitchProvider,
  feedback,
  onFeedback,
  actions,
  superseded,
  onRetry,
  onRetryWithProvider,
  onOpenIntegrations,
  onAnswerQuestions,
}: TurnRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const stepsId = useId();
  const tools = messages.filter((message) => message.content.type === "tool");
  const rest = messages.filter((message) => message.content.type !== "tool");
  const answer = rest.map(textOf).filter(Boolean).join("\n\n");
  const lastAssistant = [...rest].reverse().find((message) => message.content.type === "text");
  const failure = turn && !active ? turnFailureText(turn) : null;
  const failed = turn?.status === "failed";
  const showSteps = active || expanded;

  if (superseded && !active && !showSuperseded) {
    return (
      <div className="wpn-ai-transcript__item wpn-ai-row wpn-ai-row--assistant wpn-ai-row--superseded">
        <button
          type="button"
          className="wpn-ai-superseded__toggle"
          aria-expanded={false}
          onClick={() => setShowSuperseded(true)}
        >
          <Icon name="chevronRight" />
          Earlier response, replaced by your edit
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        "wpn-ai-transcript__item wpn-ai-row wpn-ai-row--assistant",
        superseded ? "wpn-ai-row--superseded" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {tools.length > 0 ? (
        <div className={["wpn-ai-turn__activity", active ? "wpn-ai-running-glow" : ""].join(" ")}>
          {active ? null : (
            <button
              type="button"
              className="wpn-ai-activity__toggle"
              aria-expanded={expanded}
              aria-controls={stepsId}
              onClick={() => setExpanded((open) => !open)}
            >
              <span>
                {failed ? "Failed after" : "Worked for"} {formatElapsed(workedMs(messages, turn))} ·{" "}
                {tools.length} step{tools.length === 1 ? "" : "s"}
              </span>
              <Icon name="chevronDown" className="wpn-ai-activity__chevron" />
            </button>
          )}
          <div id={stepsId} hidden={!showSteps}>
            <StepList messages={tools} active={active} turn={turn} />
          </div>
        </div>
      ) : null}
      {rest.map((message) => {
        const { content } = message;
        switch (content.type) {
          case "text":
            return (
              <div key={message.aiMessageId} className="wpn-ai-msg wpn-ai-msg--assistant">
                <AiMarkdown text={content.text} />
              </div>
            );
          case "notice":
            return (
              <p
                key={message.aiMessageId}
                className={`wpn-ai-notice wpn-ai-notice--${content.level}`}
              >
                {content.level !== "info" ? <Icon name="alert" /> : null}{" "}
                {content.code ? aiErrorText(content.code, content.text) : content.text}
              </p>
            );
          case "op_batch":
            return (
              <OpBatchSlot
                key={message.aiMessageId}
                aiOpBatchId={content.aiOpBatchId}
                batch={opBatches.find((item) => item.aiOpBatchId === content.aiOpBatchId)}
                canApply={canApplyModelOps}
                actions={actions}
              />
            );
          case "comment_draft": {
            const draft = commentDrafts.find(
              (item) => item.aiCommentDraftId === content.aiCommentDraftId,
            );
            return draft ? (
              <DraftCommentCard
                key={message.aiMessageId}
                draft={draft}
                onPost={actions.postDraft}
                onDiscard={actions.discardDraft}
                onOpenAnnotation={actions.openAnnotation}
              />
            ) : null;
          }
          case "questions":
            return (
              <AiQuestionsCard
                key={message.aiMessageId}
                questions={content.questions}
                onSubmit={isLast && !failure ? onAnswerQuestions : undefined}
              />
            );
          default:
            return null;
        }
      })}
      {failure ? (
        <div
          className={[
            "wpn-ai-failure",
            failed ? "wpn-ai-failure--error" : "wpn-ai-failure--info",
          ].join(" ")}
          data-code={turn?.errorCode ?? undefined}
          role={failed ? "alert" : undefined}
        >
          <p className={`wpn-ai-notice wpn-ai-notice--${failed ? "error" : "info"}`}>
            {failed ? <Icon name="alert" /> : null} {failure}
          </p>
          {isLast ? (
            <FailureActions
              code={failed ? turn?.errorCode : "interrupted"}
              canSwitchProvider={canSwitchProvider}
              onRetry={onRetry}
              onRetryWithProvider={onRetryWithProvider}
              onOpenIntegrations={onOpenIntegrations}
            />
          ) : null}
        </div>
      ) : null}
      {!active && turn?.usage && hasUsage(turn.usage) ? (
        <p className="wpn-ai-turn__usage">{usageText(turn.usage)}</p>
      ) : null}
      {!active && (answer || (isLast && onRetry)) ? (
        <div className="wpn-ai-msgbar" role="toolbar" aria-label="Response actions">
          {answer ? <CopyButton text={answer} /> : null}
          {isLast && onRetry && !failure ? (
            <ToolbarButton label="Retry" icon="refresh" onClick={onRetry} />
          ) : null}
          {lastAssistant && onFeedback ? (
            <>
              <ToolbarButton
                label="Good response"
                icon="thumbsUp"
                pressed={feedback === "up"}
                onClick={() =>
                  onFeedback(lastAssistant.aiMessageId, feedback === "up" ? null : "up")
                }
              />
              <ToolbarButton
                label="Bad response"
                icon="thumbsDown"
                pressed={feedback === "down"}
                onClick={() =>
                  onFeedback(lastAssistant.aiMessageId, feedback === "down" ? null : "down")
                }
              />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}, turnRowEqual);

interface LiveDraftProps {
  draftStore: AiDraftStore;
  turn: AiTurn;
  detail: string | null;
  title: string;
  onStop?: () => void;
  onGrow?: () => void;
}

const LiveDraft = memo(function LiveDraft({
  draftStore,
  turn,
  detail,
  title,
  onStop,
  onGrow,
}: LiveDraftProps) {
  const draft = useAiDraft(draftStore);
  const own = draft && draft.aiTurnId === turn.aiTurnId ? draft : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const onGrowRef = useRef(onGrow);
  onGrowRef.current = onGrow;
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => onGrowRef.current?.());
    observer.observe(el);
    return () => observer.disconnect();
  }, [turn.status]);
  if (turn.status === "queued") {
    return (
      <div ref={rootRef} className="wpn-ai-transcript__item wpn-ai-transcript__live">
        <p className="wpn-ai-livestatus">Queued. It starts when the current turn finishes.</p>
      </div>
    );
  }
  return (
    <div ref={rootRef} className="wpn-ai-transcript__item wpn-ai-transcript__live">
      {own?.reasoning ? (
        <details className="wpn-ai-reasoning">
          <summary>Reasoning</summary>
          <p>{own.reasoning}</p>
        </details>
      ) : null}
      {own?.text ? (
        <div className="wpn-ai-msg wpn-ai-msg--assistant wpn-ai-msg--streaming" aria-busy="true">
          <AiMarkdown text={own.text} streaming />
        </div>
      ) : null}
      <AiTurnWorking
        title={title}
        detail={own?.status || detail}
        silent
        startedAt={Date.parse(turn.startedAt ?? turn.createdAt) || null}
        onStop={onStop}
      />
    </div>
  );
});

function useStableCardActions(): CardActions {
  const actions = useAiCardActions();
  const ref = useRef(actions);
  ref.current = actions;
  return useMemo<CardActions>(
    () => ({
      openMention: (mention) => ref.current.openMention(mention),
      previewBatch: (batch) => ref.current.previewBatch(batch),
      openBatch: (batch) => ref.current.openBatch(batch),
      rejectBatch: (batch) => ref.current.rejectBatch(batch),
      postDraft: (draft, message) => ref.current.postDraft(draft, message),
      discardDraft: (draft) => ref.current.discardDraft(draft),
      openAnnotation: (annotationId) => ref.current.openAnnotation(annotationId),
    }),
    [],
  );
}

export function AiTranscript({
  session,
  currentUserId,
  canApplyModelOps,
  compact = false,
  emptyHint,
  canSwitchProvider = false,
  onRetry,
  onRetryWithProvider,
  onEditLast,
  onOpenIntegrations,
  onFeedback,
  onAnswerQuestions,
  pendingUser = null,
  supersededUserMessageId = null,
}: AiTranscriptProps) {
  const { detail, messages, turns, loading, error, loadingOlder, loadOlder, interrupt } = session;
  const cardActions = useStableCardActions();
  const { openMention } = cardActions;
  const draftStore = useMemo(
    () => session.draftStore ?? staticDraftStore(session.draft),
    [session.draftStore, session.draft],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const restoreRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const firstIdRef = useRef<string | undefined>(undefined);
  const lastIdRef = useRef<string | undefined>(undefined);
  const [showJump, setShowJump] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, AiFeedback>>({});
  const [announcement, setAnnouncement] = useState("");
  const rowDataRef = useRef<Map<string, RowData>>(new Map());

  const showSkeleton = useSkeletonGate(loading && !detail);
  const { rows, lastTurnRowIndex, lastUserIndex } = useMemo(
    () => buildTranscriptRows(messages.order, messages.byId),
    [messages],
  );
  const rowData = useMemo(() => {
    const next = collectRowData(
      rows,
      detail?.opBatches ?? [],
      detail?.commentDrafts ?? [],
      rowDataRef.current,
    );
    rowDataRef.current = next;
    return next;
  }, [rows, detail?.opBatches, detail?.commentDrafts]);
  const activeTurn = detail?.session.activeTurn ?? null;
  const live = activeTurn && isActiveTurn(activeTurn) ? activeTurn : null;
  const liveWork = useMemo(() => {
    const names: string[] = [];
    let detail: string | null = null;
    if (live) {
      for (const id of messages.order) {
        const message = messages.byId[id];
        if (message?.aiTurnId !== live.aiTurnId || message.content.type !== "tool") continue;
        names.push(message.content.name);
        if (message.content.status === "running") {
          detail = message.content.summary || message.content.name;
        }
      }
    }
    return { title: workTitle(names), detail };
  }, [live, messages]);
  const firstId = messages.order[0];
  const lastId = messages.order[messages.order.length - 1];
  const lastMessage = lastId ? messages.byId[lastId] : undefined;

  const handleFeedback = useCallback(
    (aiMessageId: string, value: AiFeedback | null) => {
      setFeedback((current) => {
        const next = { ...current };
        if (value) next[aiMessageId] = value;
        else delete next[aiMessageId];
        return next;
      });
      onFeedback?.(aiMessageId, value);
    },
    [onFeedback],
  );

  const contentKey = `${pendingUser ? 1 : 0}:${messages.order.length}:${lastId ?? ""}:${lastMessage?.updatedAt ?? ""}:${
    live?.aiTurnId ?? ""
  }:${live?.status ?? ""}`;

  const liveId = live?.aiTurnId ?? null;
  const prevLiveRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = prevLiveRef.current;
    prevLiveRef.current = liveId;
    if (liveId) {
      setAnnouncement("");
      return;
    }
    if (!previous) return;
    const finished = turns[previous];
    setAnnouncement((finished && turnFailureText(finished)) || "Response ready");
  }, [liveId, turns]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const prepended = firstId !== firstIdRef.current && lastId === lastIdRef.current;
    const appendedOwn =
      lastId !== lastIdRef.current &&
      lastMessage?.role === "user" &&
      Boolean(currentUserId) &&
      lastMessage.authorId === currentUserId;
    firstIdRef.current = firstId;
    lastIdRef.current = lastId;
    const restore = restoreRef.current;
    if (restore && prepended) {
      restoreRef.current = null;
      el.scrollTop = restoredScrollTop(restore, el.scrollHeight);
      return;
    }
    if (shouldAutoScroll(nearBottomRef.current, appendedOwn)) {
      el.scrollTop = el.scrollHeight;
      nearBottomRef.current = true;
      setShowJump(false);
    } else {
      setShowJump(true);
    }
  }, [contentKey, currentUserId, firstId, lastId, lastMessage]);

  const growFrameRef = useRef<number | null>(null);
  const stickToBottom = useCallback(() => {
    if (growFrameRef.current !== null) return;
    const run = () => {
      growFrameRef.current = null;
      const el = scrollRef.current;
      if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    growFrameRef.current =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame(run)
        : (setTimeout(run, 16) as unknown as number);
  }, []);
  useEffect(
    () => () => {
      if (growFrameRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(growFrameRef.current);
      }
    },
    [],
  );

  const stop = useCallback(() => interrupt(), [interrupt]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = isNearBottom(el);
    nearBottomRef.current = near;
    if (near) setShowJump(false);
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function")
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
    nearBottomRef.current = true;
    setShowJump(false);
  };

  const loadEarlier = () => {
    const el = scrollRef.current;
    if (el) restoreRef.current = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
    void loadOlder().catch(() => {
      restoreRef.current = null;
    });
  };

  if (!detail) {
    return (
      <div
        className={[
          "wpn-ai-transcript",
          "wpn-ai-transcript--empty",
          compact ? "wpn-ai-transcript--compact" : "",
        ].join(" ")}
      >
        {showSkeleton ? (
          <div role="status" aria-label="Loading conversation" className="wpn-skeleton-slot">
            <TranscriptSkeleton />
          </div>
        ) : loading ? null : error ? (
          <div className="wpn-ai-failure">
            <p className="wpn-ai-notice wpn-ai-notice--error" role="alert">
              <Icon name="alert" /> {error}
            </p>
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={session.reload}>
              <Icon name="refresh" className="wpn-btn__icon" />
              Try again
            </button>
          </div>
        ) : (
          emptyHint
        )}
      </div>
    );
  }

  const presence =
    live && live.userId !== currentUserId ? `${live.userName ?? "A teammate"} is asking AI…` : null;
  const statusText = announcement || (live ? "AI is responding" : "");
  const idle = !live;

  return (
    <div className="wpn-ai-transcript-wrap">
      <div
        ref={scrollRef}
        className={["wpn-ai-transcript", compact ? "wpn-ai-transcript--compact" : ""].join(" ")}
        onScroll={onScroll}
        role="region"
        aria-label="AI conversation"
        aria-busy={Boolean(live)}
        tabIndex={0}
        data-testid="ai-transcript"
      >
        {detail.hasMoreMessages ? (
          <button
            type="button"
            className="wpn-ai-link wpn-ai-transcript__older"
            disabled={loadingOlder}
            onClick={loadEarlier}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        ) : null}
        {rows.length === 0 && !live && !pendingUser ? emptyHint : null}
        {rows.map((row, index) => {
          if (row.kind === "user") {
            return (
              <UserRow
                key={row.key}
                message={row.message}
                canEdit={idle && index === lastUserIndex && row.message.authorId === currentUserId}
                onEdit={onEditLast}
                onOpenMention={openMention}
              />
            );
          }
          const turn = row.aiTurnId ? turns[row.aiTurnId] : undefined;
          const active = Boolean(live && row.aiTurnId === live.aiTurnId);
          const isLast = index === lastTurnRowIndex && idle;
          const lastAssistant = [...row.messages]
            .reverse()
            .find((message) => message.content.type === "text");
          const data = rowData.get(row.key) ?? NO_ROW_DATA;
          return (
            <TurnRow
              key={row.key}
              messages={row.messages}
              turn={turn}
              active={active}
              isLast={isLast}
              opBatches={data.batches}
              commentDrafts={data.drafts}
              canApplyModelOps={canApplyModelOps}
              canSwitchProvider={canSwitchProvider}
              feedback={lastAssistant ? feedback[lastAssistant.aiMessageId] : undefined}
              onFeedback={onFeedback ? handleFeedback : undefined}
              actions={cardActions}
              superseded={
                supersededUserMessageId !== null && row.precedingUserId === supersededUserMessageId
              }
              onRetry={isLast ? onRetry : undefined}
              onRetryWithProvider={isLast ? onRetryWithProvider : undefined}
              onOpenIntegrations={isLast ? onOpenIntegrations : undefined}
              onAnswerQuestions={isLast ? onAnswerQuestions : undefined}
            />
          );
        })}
        {pendingUser ? (
          <>
            <UserRow
              key="pending-user"
              message={{
                aiMessageId: "pending-user",
                aiSessionId: "",
                aiTurnId: null,
                authorId: currentUserId,
                authorName: null,
                role: "user",
                content: { type: "text", text: pendingUser.text, mentions: pendingUser.mentions },
                createdAt: new Date(pendingUser.at).toISOString(),
                updatedAt: new Date(pendingUser.at).toISOString(),
              }}
              canEdit={false}
              onEdit={onEditLast}
              onOpenMention={openMention}
            />
            {live ? null : (
              <div className="wpn-ai-transcript__item wpn-ai-transcript__live">
                <AiTurnWorking
                  title="AI is working on your request"
                  detail="Sending your message…"
                  startedAt={pendingUser.at}
                  silent
                />
              </div>
            )}
          </>
        ) : null}
        {live ? (
          <LiveDraft
            draftStore={draftStore}
            turn={live}
            detail={liveWork.detail}
            title={liveWork.title}
            onStop={stop}
            onGrow={stickToBottom}
          />
        ) : null}
        {presence ? <p className="wpn-ai-presence">{presence}</p> : null}
      </div>
      {showJump ? (
        <button
          type="button"
          className="wpn-ai-jump"
          aria-label="Jump to latest message"
          onClick={jumpToLatest}
        >
          <Icon name="arrowDown" />
          Jump to latest
        </button>
      ) : null}
      <p className="wpn-sr-only" role="status" aria-live="polite">
        {statusText}
      </p>
    </div>
  );
}
