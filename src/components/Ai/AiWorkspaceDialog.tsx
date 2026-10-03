import { AiQuestionsCard } from "./AiQuestionsCard";
import { withAnswers } from "./aiQuestions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isWorkspaceOp, type WorkspaceApplyItem } from "../../ai/ops/workspaceOps";
import { useOptionalAiRuntime } from "../../context/AiRuntimeContext";
import { useAnnotationUi } from "../../context/AnnotationContext";
import { useAiActionChats } from "../../hooks/useAiActionChats";
import type { AiActionRunRequest, AiActionRunState, AiMention } from "../../types/ai.types";
import { Icon, ModalShell } from "../primitives";
import { AiActivity } from "./AiActivity";
import { AiComposer, type AiComposerSeed } from "./AiComposer";
import { AiModelSwitcher } from "./AiModelSwitcher";
import { resultNote, resultOpBatch } from "./aiDockLogic";
import { aiReady, connectAgentHint, resolveRoute } from "./aiHelpers";
import { CHANGE_MARKS, describeWorkspaceOps } from "./aiOpChanges";
import { useAiUi, type AiWorkspaceRequest } from "./AiUiContext";
import { WorkspaceProposal, type Phase } from "./AiWorkspaceProposal";
import { IDLE_AI_ACTION, useAiAction, useWarmAi } from "./useAiAction";
import { useAiDefaults } from "./useAiPreferences";
import { useAiMentionCandidates } from "./useAiMentionCandidates";
import {
  isWorkspaceBatch,
  summarizeWorkspaceResult,
  useAiWorkspaceApplier,
  type AiWorkspaceBatch,
} from "./useAiWorkspaceApplier";

interface Entry {
  id: number;
  prompt: string;
  state: AiActionRunState | null;
  phase: Phase;
  items: WorkspaceApplyItem[];
  summary: string;
  error: string | null;
  mentions?: AiMention[];
}

interface Starter {
  label: string;
  text: string;
}

const EPIC_STARTERS: Starter[] = [
  {
    label: "Add user stories",
    text: "Break the tagged epic into 4 to 6 user stories with acceptance criteria.",
  },
  {
    label: "Improve notes",
    text: "Rewrite the notes of the tagged epic with a clear goal, scope, acceptance criteria and open questions.",
  },
  {
    label: "Create a flow",
    text: "Create a flow that shows how the tagged epic works end to end.",
  },
  { label: "Create a data model", text: "Design a data model for the tagged epic." },
];

const STORY_STARTERS: Starter[] = [
  {
    label: "Improve notes",
    text: "Rewrite the tagged user story with a clear As a / I want / so that and testable acceptance criteria.",
  },
  { label: "Split the story", text: "Split the tagged user story into smaller user stories." },
  { label: "Create a flow", text: "Create a flow for the tagged user story." },
];

const GENERAL_STARTERS: Starter[] = [
  {
    label: "Epic with stories",
    text: "Create an epic with detailed notes and 4 to 6 user stories for: ",
  },
  { label: "Flow from an epic", text: "Create a flow for the tagged epic and its user stories." },
  { label: "Data model from an epic", text: "Design a data model for the tagged epic." },
  {
    label: "Stories from a flow",
    text: "Turn the tagged flow into an epic with user stories.",
  },
];

function startersFor(mentions: readonly AiMention[]): Starter[] {
  if (mentions.some((mention) => mention.kind === "epic")) return EPIC_STARTERS;
  if (mentions.some((mention) => mention.kind === "user_story")) return STORY_STARTERS;
  return GENERAL_STARTERS;
}

const messageOf = (err: unknown) =>
  err instanceof Error && err.message ? err.message : "Something went wrong";

function plannedLines(state: AiActionRunState) {
  return describeWorkspaceOps(state.partialOps.filter(isWorkspaceOp));
}

export interface AiWorkspaceDialogProps {
  request: AiWorkspaceRequest;
  onClose: () => void;
}

export function AiWorkspaceDialog({ request, onClose }: AiWorkspaceDialogProps) {
  const runtime = useOptionalAiRuntime();
  const ui = useAiUi();
  const annotationUi = useAnnotationUi();
  const me = runtime?.me ?? null;
  const projectId = runtime?.projectId ?? "";
  const [defaults, setDefaults] = useAiDefaults();
  const route = resolveRoute(me, defaults);
  const ready = aiReady(me);
  const canPropose = Boolean(me?.canApplyModelOps);
  const { state, run, stop } = useAiAction();
  const warm = useWarmAi();
  const applier = useAiWorkspaceApplier();
  const mentionSource = useAiMentionCandidates();
  const [entries, setEntries] = useState<Entry[]>([]);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const seq = useRef(0);
  const [chatId, setChatId] = useState<string | "new">("new");
  const chatsApi = useAiActionChats("workspace", projectId, true);
  const awaitingChats = useRef<readonly unknown[] | null>(null);
  const [seed, setSeed] = useState<AiComposerSeed | null>(
    request.prompt
      ? { text: request.prompt, mentions: request.mentions, nonce: request.nonce }
      : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const running = state.status === "running";
  const applying = entries.some((entry) => entry.phase === "applying");
  const warmProvider = route?.provider ?? null;
  const warmModel = route?.model ?? null;

  useEffect(() => {
    if (warmProvider) warm(projectId, { provider: warmProvider, model: warmModel ?? undefined });
  }, [projectId, warm, warmModel, warmProvider]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const chatsRef = useRef(chatsApi);
  chatsRef.current = chatsApi;
  const runStatus = state.status;
  useEffect(() => {
    if (runStatus === "idle" || runStatus === "running") return;
    const finished = stateRef.current;
    setEntries((current) => {
      const last = current[current.length - 1];
      if (!last || last.state) return current;
      return [...current.slice(0, -1), { ...last, state: finished }];
    });
    awaitingChats.current = chatsRef.current.chats;
    chatsRef.current.reload();
  }, [runStatus]);

  useEffect(() => {
    const waiting = awaitingChats.current;
    if (waiting === null || chatsApi.chats === waiting) return;
    awaitingChats.current = null;
    const latest = chatsApi.chats[0];
    if (latest && chatId === "new") setChatId(latest.aiSessionId);
  }, [chatsApi.chats, chatId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, state.partialOps.length, state.status]);

  const starters = useMemo(() => startersFor(request.mentions ?? []), [request.mentions]);

  const update = useCallback((id: number, patch: Partial<Entry>) => {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }, []);

  const send = useCallback(
    async ({ text, mentions }: { text: string; mentions: AiMention[] }) => {
      if (running || !route || !text.trim()) return;
      const id = ++seq.current;
      setNotice(null);
      setEntries((current) =>
        [
          ...current,
          {
            id,
            prompt: text,
            state: null,
            phase: "idle" as Phase,
            items: [],
            summary: "",
            error: null,
            mentions,
          },
        ].slice(-8),
      );
      const selection = request.selection ?? [];
      const body: AiActionRunRequest = {
        ...(chatId === "new" ? { newChat: true } : { sessionId: chatId }),
        targetId: projectId,
        prompt: text,
        ...(selection.length > 0 ? { selection } : {}),
        ...(mentions.length > 0 ? { mentions } : {}),
        provider: route.provider,
        model: route.model,
        effort: route.effort,
      };
      void run("workspace.assist", body);
    },
    [chatId, projectId, request.selection, route, run, running],
  );

  const approve = useCallback(
    async (entry: Entry, batch: AiWorkspaceBatch) => {
      update(entry.id, { phase: "applying", items: [], error: null, summary: "" });
      try {
        const result = await applier.apply(batch, (items) =>
          update(entry.id, { items: items.slice() }),
        );
        update(entry.id, {
          items: result.items,
          phase: result.done === 0 ? "failed" : result.failed > 0 ? "partial" : "applied",
          summary: summarizeWorkspaceResult(result),
          error:
            result.done === 0
              ? (result.items[0]?.error ?? "Nothing could be created")
              : result.failed > 0
                ? `${result.failed} ${result.failed === 1 ? "change was" : "changes were"} skipped.`
                : null,
        });
        chatsApi.reload();
      } catch (err) {
        update(entry.id, { phase: "failed", error: messageOf(err) });
      }
    },
    [applier, chatsApi, update],
  );

  const discard = useCallback(
    async (entry: Entry, batch: AiWorkspaceBatch) => {
      update(entry.id, { phase: "discarded" });
      try {
        await applier.discard(batch);
      } catch {
        update(entry.id, { phase: "idle" });
        setNotice("Couldn't discard this proposal. Try again.");
      }
    },
    [applier, update],
  );

  const openItem = useCallback(
    (item: WorkspaceApplyItem) => {
      if (!item.id) return;
      onClose();
      const kind =
        item.kind === "flow" ? "flow" : item.kind === "data_model" ? "dataModel" : "epic";
      annotationUi.openReference({ kind, id: item.id });
    },
    [annotationUi, onClose],
  );

  const close = useCallback(() => {
    if (applying) return;
    if (running) stop();
    onClose();
  }, [applying, onClose, running, stop]);

  const disabledReason = !ready
    ? connectAgentHint(me)
    : !canPropose
      ? "Your role can't apply AI changes."
      : null;

  const showStarters = entries.length === 0 && !running;
  const lastIndex = entries.length - 1;

  return (
    <ModalShell
      title="Ask AI"
      subtitle="Create or update epics, user stories, flows and data models. Nothing changes until you approve."
      leading={<Icon name="sparkles" />}
      onClose={close}
      className="wpn-ai-modal wpn-ai-ws"
      footer={
        <div className="wpn-ai-ws__footer">
          {notice ? (
            <p className="wpn-ai-card__warn" role="alert">
              {notice}
            </p>
          ) : null}
          <AiComposer
            candidates={mentionSource.candidates}
            onMentionTrigger={mentionSource.request}
            onSend={send}
            disabled={Boolean(disabledReason) || applying}
            disabledReason={disabledReason}
            active={running}
            onStop={stop}
            autoFocus
            compact
            draftKey={`workspace:${projectId}`}
            initialMentions={request.mentions}
            seed={seed}
            placeholder="Describe what to create or change… (# to tag an epic, story, flow, data model or comment)"
            toolbar={
              ready ? (
                <AiModelSwitcher
                  compact
                  placement="top"
                  value={route}
                  persist={false}
                  disabled={running}
                  onChange={(next) =>
                    setDefaults({
                      provider: next.provider,
                      model: next.model,
                      effort: next.effort,
                    })
                  }
                />
              ) : (
                <button
                  type="button"
                  className="wpn-btn wpn-btn--ghost"
                  onClick={() => ui?.openIntegrations("connectors")}
                >
                  <Icon name="plug" className="wpn-btn__icon" />
                  Connect
                </button>
              )
            }
          />
        </div>
      }
    >
      <div className="wpn-ai-ws__scroll" ref={scrollRef}>
        {showStarters ? (
          <div className="wpn-ai-ws__starters">
            <p className="wpn-ai-muted">
              Try one of these, or describe what you need. Tag existing work with #.
            </p>
            <div className="wpn-ai-ws__chips">
              {starters.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  className="wpn-ai-ws__chip"
                  onClick={() =>
                    setSeed({
                      text: starter.text,
                      mentions: request.mentions,
                      nonce: Date.now(),
                    })
                  }
                >
                  {starter.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <ol className="wpn-ai-ws__thread">
          {entries.map((entry, index) => {
            const shown: AiActionRunState =
              index === lastIndex && (running || !entry.state)
                ? state
                : (entry.state ?? IDLE_AI_ACTION);
            const batch = resultOpBatch(shown.result);
            const workspaceBatch = batch && isWorkspaceBatch(batch) ? batch : null;
            const note = resultNote(shown.result);
            const live = shown.status === "running";
            return (
              <li key={entry.id} className="wpn-ai-ws__entry">
                <p className="wpn-ai-ws__prompt">{entry.prompt}</p>
                {live || shown.status === "error" || shown.status === "cancelled" ? (
                  <AiActivity state={shown} compact hideText />
                ) : null}
                {live && shown.partialOps.length > 0 ? (
                  <ul className="wpn-ai-ws__planned" aria-label="Planned changes">
                    {plannedLines(shown).map((line, i) => (
                      <li key={`${line.subject}-${i}`}>
                        <span className="wpn-ai-batch__mark wpn-ai-batch__mark--add">
                          {CHANGE_MARKS[line.kind]}
                        </span>{" "}
                        {line.subject}
                        {line.detail ? (
                          <span className="wpn-ai-muted"> · {line.detail}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {workspaceBatch ? (
                  <WorkspaceProposal
                    batch={workspaceBatch}
                    entry={entry}
                    canApply={canPropose}
                    onApprove={() => void approve(entry, workspaceBatch)}
                    onDiscard={() => void discard(entry, workspaceBatch)}
                    onOpen={openItem}
                  />
                ) : null}
                {!live && !workspaceBatch && shown.status === "done" ? (
                  <div className="wpn-ai-ws__note">
                    {note?.title ? <strong>{note.title}</strong> : null}
                    {note?.rationale ? <p>{note.rationale}</p> : null}
                    {note && note.questions.length > 0 ? (
                      <AiQuestionsCard
                        questions={note.questions}
                        disabled={running}
                        onSubmit={
                          index === lastIndex && !running
                            ? (answers) =>
                                void send({
                                  text: withAnswers(entry.prompt, answers),
                                  mentions: entry.mentions ?? [],
                                })
                            : undefined
                        }
                      />
                    ) : null}
                    {!note ? (
                      <p className="wpn-ai-muted">
                        The AI had nothing to change. Try describing what to create.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </ModalShell>
  );
}
