import { AiQuestionsCard } from "./AiQuestionsCard";
import { withAnswers } from "./aiQuestions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isWorkspaceOp, type WorkspaceApplyItem } from "../ops/workspaceOps";
import { useOptionalAiRuntime } from "../AiRuntimeContext";
import { useAnnotationUi } from "../../../context/AnnotationContext";
import { useAiActionChats } from "../../../hooks/useAiActionChats";
import type {
  AiActionKey,
  AiActionRunRequest,
  AiActionRunState,
  AiMention,
} from "../../../types/ai.types";
import { Icon, type IconName } from "../../../components/primitives/Icon";
import { MenuPanel, type MenuItemDefinition } from "../../../components/primitives/Menu";
import { ModalShell } from "../../../components/primitives/ModalShell";
import { useEscapeKey } from "../../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../../hooks/useOutsidePointerDown";
import { AiActivity } from "./AiActivity";
import { AiMarkdown } from "./AiMarkdown";
import { AiComposer, type AiComposerSeed } from "./AiComposer";
import { AiModelSwitcher } from "./AiModelSwitcher";
import { resultNote, resultOpBatch } from "./aiDockLogic";
import { aiReady, connectAgentHint, resolveRoute, runStatusText } from "./aiHelpers";
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

export type WorkspaceMode = "ask" | "create" | "explain" | "improve";

const MODE_ACTIONS: Record<WorkspaceMode, AiActionKey> = {
  ask: "workspace.ask",
  create: "workspace.assist",
  explain: "workspace.explain",
  improve: "workspace.assist",
};

const WORKSPACE_WARM_KEYS: AiActionKey[] = ["workspace.assist", "workspace.ask"];

const MODES: { id: WorkspaceMode; label: string; icon: IconName }[] = [
  { id: "ask", label: "Ask", icon: "sparkles" },
  { id: "create", label: "Create", icon: "plus" },
  { id: "explain", label: "Explain", icon: "info" },
  { id: "improve", label: "Improve", icon: "edit" },
];

const MODE_PLACEHOLDERS: Record<WorkspaceMode, string> = {
  ask: "Ask a question… (# to tag an epic, story, flow, data model or comment)",
  create: "Describe what to create… (# to tag an epic, story, flow, data model or comment)",
  explain: "Ask what to explain… (# to tag an epic, story, flow, data model or comment)",
  improve: "Describe what to improve… (# to tag an epic, story, flow, data model or comment)",
};

function isTextMode(mode: WorkspaceMode): boolean {
  return mode === "ask" || mode === "explain";
}

interface Entry {
  id: number;
  prompt: string;
  mode: WorkspaceMode;
  state: AiActionRunState | null;
  phase: Phase;
  items: WorkspaceApplyItem[];
  summary: string;
  error: string | null;
  mentions?: AiMention[];
}

interface Starter {
  label: string;
  hint: string;
  mode: WorkspaceMode;
  text: string;
}

const EPIC_STARTERS: Starter[] = [
  {
    label: "Ask about an epic",
    hint: "Status, scope and what's missing",
    mode: "ask",
    text: "What is the scope of the tagged epic, and what is still missing or unclear?",
  },
  {
    label: "Epic with stories",
    hint: "Detailed notes plus 4 to 6 stories",
    mode: "create",
    text: "Create an epic with detailed notes and 4 to 6 user stories for: ",
  },
];

const STORY_STARTERS: Starter[] = [
  {
    label: "Explain a story",
    hint: "Who it's for, what it delivers, how to test",
    mode: "explain",
    text: "Explain the tagged user story: who it is for, what it delivers and how to test it.",
  },
  {
    label: "Improve a story",
    hint: "As a / I want / so that, testable criteria",
    mode: "improve",
    text: "Rewrite the tagged user story with a clear As a / I want / so that and testable acceptance criteria.",
  },
];

function startersFor(mentions: readonly AiMention[]): Starter[] {
  const storyFirst =
    mentions.some((mention) => mention.kind === "user_story") &&
    !mentions.some((mention) => mention.kind === "epic");
  return storyFirst ? [...STORY_STARTERS, ...EPIC_STARTERS] : [...EPIC_STARTERS, ...STORY_STARTERS];
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
  const [mode, setMode] = useState<WorkspaceMode>("ask");
  const seq = useRef(0);
  const [chatId, setChatId] = useState<string | "new">("new");
  const chatsApi = useAiActionChats("workspace", projectId, true);
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

  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  const closeModeMenu = useCallback(() => {
    setModeMenuOpen(false);
    modeTriggerRef.current?.focus();
  }, []);
  useOutsidePointerDown(modeMenuRef, () => setModeMenuOpen(false), modeMenuOpen);
  useEscapeKey(closeModeMenu, modeMenuOpen);
  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0]!;
  const modeMenuItems: MenuItemDefinition[] = MODES.map((item) => ({
    type: "radio",
    id: item.id,
    label: item.label,
    checked: mode === item.id,
    disabled: running,
    onSelect: () => {
      setMode(item.id);
      closeModeMenu();
    },
  }));

  const warmEffort = route?.effort ?? null;
  const warmNow = useCallback(() => {
    if (!warmProvider) return;
    warm(projectId, {
      provider: warmProvider,
      model: warmModel ?? undefined,
      ...(warmEffort ? { effort: warmEffort } : {}),
      actionKeys: WORKSPACE_WARM_KEYS,
    });
  }, [projectId, warm, warmEffort, warmModel, warmProvider]);

  useEffect(() => {
    warmNow();
  }, [warmNow]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const chatsRef = useRef(chatsApi);
  chatsRef.current = chatsApi;
  const runStatus = state.status;
  useEffect(() => {
    if (runStatus === "idle" || runStatus === "running") return;
    const finished = stateRef.current;
    if (finished.aiSessionId) {
      const sessionId = finished.aiSessionId;
      setChatId((current) => (current === "new" ? sessionId : current));
    }
    setEntries((current) => {
      const last = current[current.length - 1];
      if (!last || last.state) return current;
      return [...current.slice(0, -1), { ...last, state: finished }];
    });
    chatsRef.current.reload();
  }, [runStatus]);

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
    async (
      { text, mentions }: { text: string; mentions: AiMention[] },
      sendMode: WorkspaceMode = mode,
    ) => {
      if (running || !route || !text.trim()) return;
      const carried =
        mentions.length > 0
          ? mentions
          : ([...entriesRef.current].reverse().find((entry) => (entry.mentions ?? []).length > 0)
              ?.mentions ?? []);
      const id = ++seq.current;
      setNotice(null);
      setEntries((current) =>
        [
          ...current,
          {
            id,
            prompt: text,
            mode: sendMode,
            state: null,
            phase: "idle" as Phase,
            items: [],
            summary: "",
            error: null,
            mentions: carried,
          },
        ].slice(-8),
      );
      const selection =
        mentions.length === 0 && carried.length > 0 ? [] : (request.selection ?? []);
      const body: AiActionRunRequest = {
        ...(chatId === "new" ? { newChat: true } : { sessionId: chatId }),
        targetId: projectId,
        prompt: text,
        ...(selection.length > 0 ? { selection } : {}),
        ...(carried.length > 0 ? { mentions: carried } : {}),
        provider: route.provider,
        model: route.model,
        effort: route.effort,
      };
      void run(MODE_ACTIONS[sendMode], body);
    },
    [chatId, mode, projectId, request.selection, route, run, running],
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
            [
              result.done === 0
                ? (result.items[0]?.error ?? "Nothing could be created")
                : result.failed > 0
                  ? `${result.failed} ${result.failed === 1 ? "change was" : "changes were"} skipped.`
                  : null,
              result.syncWarning ?? null,
            ]
              .filter(Boolean)
              .join(" ") || null,
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
      title="WeCollab"
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
            onWarm={warmNow}
            disabled={Boolean(disabledReason) || applying}
            disabledReason={disabledReason}
            active={running}
            activeSince={state.startedAt}
            activeLabel={running ? runStatusText(state) : null}
            onStop={stop}
            autoFocus
            compact
            draftKey={`workspace:${projectId}`}
            initialMentions={request.mentions}
            seed={seed}
            placeholder={MODE_PLACEHOLDERS[mode]}
            toolbar={
              <>
                <div
                  ref={modeMenuRef}
                  className={[
                    "wpn-ai-switcher",
                    "wpn-ai-switcher--compact",
                    modeMenuOpen ? "wpn-ai-switcher--open" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    ref={modeTriggerRef}
                    type="button"
                    className="wpn-ai-switcher__trigger"
                    aria-haspopup="menu"
                    aria-expanded={modeMenuOpen}
                    aria-label={`AI mode: ${activeMode.label}`}
                    disabled={running}
                    onClick={() => setModeMenuOpen((current) => !current)}
                  >
                    <Icon name={activeMode.icon} />
                    <span className="wpn-ai-switcher__label">{activeMode.label}</span>
                    <Icon name="chevronDown" className="wpn-ai-switcher__chevron" />
                  </button>
                  {modeMenuOpen ? (
                    <MenuPanel
                      items={modeMenuItems}
                      placement="top-start"
                      anchorRef={modeTriggerRef}
                      onRequestClose={closeModeMenu}
                    />
                  ) : null}
                </div>
                {ready ? (
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
                )}
              </>
            }
          />
        </div>
      }
    >
      <div className="wpn-ai-ws__scroll" ref={scrollRef}>
        {showStarters ? (
          <div className="wpn-ai-ws__starters">
            <span className="wpn-ai-ws__hero-icon" aria-hidden="true">
              <Icon name="sparkles" />
            </span>
            <h3 className="wpn-ai-ws__hero-title">What would you like to work on?</h3>
            <p className="wpn-ai-ws__hero-text">
              Ask, create, explain or improve epics and user stories. Type{" "}
              <kbd className="wpn-ai-ws__kbd">#</kbd> to tag existing work.
            </p>
            <div className="wpn-ai-ws__cards">
              {starters.map((starter) => {
                const starterMode = MODES.find((item) => item.id === starter.mode) ?? MODES[0]!;
                return (
                  <button
                    key={starter.label}
                    type="button"
                    className="wpn-ai-ws__card"
                    aria-label={starter.label}
                    disabled={running}
                    onClick={() => {
                      setMode(starter.mode);
                      setSeed({
                        text: starter.text,
                        mentions: request.mentions,
                        nonce: Date.now(),
                      });
                    }}
                  >
                    <span
                      className={`wpn-ai-ws__card-icon wpn-ai-ws__card-icon--${starter.mode}`}
                      aria-hidden="true"
                    >
                      <Icon name={starterMode.icon} />
                    </span>
                    <span className="wpn-ai-ws__card-text">
                      <span className="wpn-ai-ws__card-label">{starter.label}</span>
                      <span className="wpn-ai-ws__card-hint">{starter.hint}</span>
                    </span>
                    <span
                      className={`wpn-ai-ws__card-mode wpn-ai-ws__card-mode--${starter.mode}`}
                      aria-hidden="true"
                    >
                      {starterMode.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="wpn-ai-ws__hero-note">
              <Icon name="check" /> Nothing changes until you approve it.
            </p>
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
            const textMode = isTextMode(entry.mode);
            const textAnswer =
              shown.result && (shown.result.kind === "markdown" || shown.result.kind === "text")
                ? shown.result.text
                : null;
            return (
              <li key={entry.id} className="wpn-ai-ws__entry">
                <p className="wpn-ai-ws__prompt">{entry.prompt}</p>
                {live || shown.status === "error" || shown.status === "cancelled" ? (
                  <AiActivity state={shown} compact hideText={!textMode} />
                ) : null}
                {!live && textMode && shown.status === "done" && textAnswer ? (
                  <div className="wpn-ai-ws__answer">
                    <AiMarkdown text={textAnswer} />
                  </div>
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
                {!live && !workspaceBatch && !textMode && shown.status === "done" ? (
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
                                void send(
                                  {
                                    text: withAnswers(entry.prompt, answers),
                                    mentions: entry.mentions ?? [],
                                  },
                                  entry.mode,
                                )
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
                {!live && textMode && shown.status === "done" && !textAnswer ? (
                  <p className="wpn-ai-muted">The AI didn't return an answer. Try again.</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </ModalShell>
  );
}
