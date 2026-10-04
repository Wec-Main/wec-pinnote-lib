import { AiQuestionsCard } from "./AiQuestionsCard";
import { withAnswers } from "./aiQuestions";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  loadAiDockLayout,
  saveAiDockLayout,
  useAiDockControl,
  type AiDockBadge,
  type AiDockControl,
  type AiDockLayout,
  type AiDockMode,
} from "../aiDockState";
import { useAiPreview } from "../aiPreviewStore";
import type { AiBatchPreviewOutcome, AiOpBatchApplier } from "../useAiOpBatchApplier";
import { useOptionalAiMe, useOptionalAiRuntimeActions } from "../AiRuntimeContext";
import { updateAiOpBatch } from "../../../services/aiService";
import type {
  AiMention,
  AiActionKey,
  AiActionRunRequest,
  AiActionRunState,
  AiOpBatch,
  AiEditorTargetKind,
} from "../../../types/ai.types";
import type { ErdDocumentJSON } from "../../../types/dataModel.types";
import type { FlowJSON } from "../../../types/flowchart.types";
import { useEscapeKey } from "../../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../../hooks/useOutsidePointerDown";
import { Icon, type IconName } from "../../../components/primitives/Icon";
import { MenuPanel, type MenuItemDefinition } from "../../../components/primitives/Menu";
import { AiMentionChip, ComposerStatus } from "./AiComposer";
import { AiChangeList } from "./AiChangeList";
import {
  useMentionPicker,
  type AiMentionCandidate,
  type AiMentionTrigger,
} from "./useMentionPicker";
import { AiDockStatus, currentPhase } from "./AiDockStatus";
import { AiActivity } from "./AiActivity";
import {
  ACTION_LABELS,
  chooseDockAction,
  describeLiveOp,
  dockChips,
  loadPromptHistory,
  pushPromptHistory,
  resultFindings,
  resultNote,
  resultOpBatch,
  useCanvasInteraction,
  type DockChip,
  type DockChipId,
} from "./aiDockLogic";
import { aiEditorRequests } from "./aiEditorRequests";
import { aiReady, connectAgentHint, resolveRoute, runStatusText } from "./aiHelpers";
import { useAiActionChats } from "../../../hooks/useAiActionChats";
import { useAiActionHistory } from "../../../hooks/useAiActionHistory";
import { useAiWorkSlot } from "./AiWorkSlot";
import { AiWorkStatus } from "./AiWorkStatus";
import { AiActionHistory } from "./AiActionHistory";
import { AiModelSwitcher } from "./AiModelSwitcher";
import { countChanges, describeOpBatch, type AiChangeLine } from "./aiOpChanges";
import { useAiUi } from "./AiUiContext";
import { useAiAvailable } from "./IntegrationsButton";
import { IDLE_AI_ACTION, useAiAction, useWarmAi, type AiLiveTextStore } from "./useAiAction";
import { useAiDefaults } from "./useAiPreferences";

export interface AiMentionSource {
  candidates: AiMentionCandidate[];
  request: (trigger: AiMentionTrigger) => void;
}

export interface AiEditorDockProps {
  kind: AiEditorTargetKind;
  targetId: string;
  applier: AiOpBatchApplier;
  getSelectedIds: () => string[];
  selectedCount: number;
  itemNoun: readonly [string, string];
  wholeLabel: string;
  isEmpty: boolean;
  getDocument: () => ErdDocumentJSON | FlowJSON | null;
  subscribeChanges?: (listener: () => void) => () => void;
  editable?: boolean;
  control?: AiDockControl;
  onSnapshot?: () => Promise<void>;
  mentionSource?: AiMentionSource;
}

type Disposition = "proposed" | "previewing" | "applied" | "discarded" | "undone";

interface DockRun {
  id: number;
  actionKey: AiActionKey;
  prompt: string;
  body: AiActionRunRequest;
  state: AiActionRunState | null;
  changes: AiChangeLine[] | null;
}

interface PendingReplace {
  batch: AiOpBatch;
  then: "preview" | "apply";
}

export const UNDO_TOAST_MS = 10_000;

const undoHint = (() => {
  try {
    return /Mac|iPhone|iPad/.test(navigator.platform) ? "or press ⌘Z" : "or press Ctrl+Z";
  } catch {
    return "or press Ctrl+Z";
  }
})();
const THREAD_LIMIT = 6;
const DRAFT_THROTTLE_MS = 200;
const WORK_DONE_MS = 9000;
const MAX_TEXTAREA_PX = 160;
const MIN_DOCK_HEIGHT = 200;
const DOCK_GUTTER = 32;
const HEIGHT_STEP = 24;
const FALLBACK_MAX_HEIGHT = 2000;
const NO_CANDIDATES: AiMentionCandidate[] = [];

const scheduleTimeout = (callback: () => void, delayMs: number): (() => void) => {
  const id = setTimeout(callback, delayMs);
  return () => clearTimeout(id);
};

const SIZE_MODES: { mode: AiDockMode; label: string; icon: IconName }[] = [
  { mode: "compact", label: "Compact", icon: "panelCompact" },
  { mode: "expanded", label: "Expanded", icon: "panelExpanded" },
  { mode: "maximized", label: "Maximized", icon: "panelMax" },
];

function dockHeightStyle(layout: AiDockLayout): CSSProperties {
  if (layout.mode === "expanded") return { height: "50%" };
  if (layout.mode === "maximized") return { height: `calc(100% - ${DOCK_GUTTER}px)` };
  if (layout.mode === "custom" && layout.height !== null) return { height: layout.height };
  return {};
}

const WARM_ACTION_KEYS: Record<AiEditorTargetKind, AiActionKey[]> = {
  data_model: ["erd.generate", "erd.edit", "erd.ask"],
  flow: ["flow.generate", "flow.edit", "flow.ask"],
};

const OP_ACTIONS: ReadonlySet<AiActionKey> = new Set<AiActionKey>([
  "erd.generate",
  "erd.edit",
  "erd.review",
  "flow.generate",
  "flow.edit",
]);

function resultBatch(state: AiActionRunState | null): AiOpBatch | null {
  return resultOpBatch(state?.result);
}

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function AiEditorDock(props: AiEditorDockProps) {
  const runtime = useOptionalAiRuntimeActions();
  const available = useAiAvailable();
  if (!runtime || !available) return null;
  return <AiEditorDockInner {...props} />;
}

function AiEditorDockInner({
  kind,
  targetId,
  applier,
  getSelectedIds,
  selectedCount,
  itemNoun,
  wholeLabel,
  isEmpty,
  getDocument,
  subscribeChanges,
  editable = true,
  control: externalControl,
  onSnapshot,
  mentionSource,
}: AiEditorDockProps) {
  const ownControl = useAiDockControl();
  const control = externalControl ?? ownControl;
  const { open, focusSignal, setBadge, setWork, show, hide } = control;
  const runtime = useOptionalAiRuntimeActions();
  const ui = useAiUi();
  const me = useOptionalAiMe();
  const [defaults, setDefaults] = useAiDefaults();
  const route = resolveRoute(me, defaults);
  const warmProvider = route?.provider ?? null;
  const warmModel = route?.model ?? null;
  const warmEffort = route?.effort ?? null;
  const ready = aiReady(me);
  const canPropose = Boolean(me?.canApplyModelOps);
  const canApply = canPropose && editable;
  const { state, live, run, stop } = useAiAction({ liveText: true });
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const warm = useWarmAi();
  const overlay = useAiPreview(kind, targetId);

  const [prompt, setPrompt] = useState("");
  const [chip, setChip] = useState<DockChipId | null>("ask");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionMenuRef = useRef<HTMLSpanElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const [runs, setRuns] = useState<DockRun[]>([]);
  const workSlot = useAiWorkSlot();
  const [chatId, setChatId] = useState<string | "new" | null>(null);
  const historyKey = 0;
  const chatsApi = useAiActionChats(kind, targetId, open);
  const activeChatId = chatId === "new" ? null : (chatId ?? chatsApi.chats[0]?.aiSessionId ?? null);
  const activeChatRef = useRef({ chatId, activeChatId });
  activeChatRef.current = { chatId, activeChatId };
  const touchChat = chatsApi.touch;
  const actionHistory = useAiActionHistory(kind, targetId, {
    enabled: open && chatId !== "new",
    aiSessionId: activeChatId,
    refreshKey: historyKey,
  });
  const [expanded, setExpanded] = useState(false);
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [conflicts, setConflicts] = useState<Record<string, string>>({});
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);
  const [toast, setToast] = useState<{ batchId: string; key: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [skippedOps, setSkippedOps] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<Record<string, readonly number[]>>({});
  const excludedRef = useRef(excluded);
  excludedRef.current = excluded;
  const [layout, setLayout] = useState<AiDockLayout>(() => loadAiDockLayout(kind));
  const [measured, setMeasured] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [unseenProposal, setUnseenProposal] = useState(false);
  const [everOpened, setEverOpened] = useState(open);
  const [attached, setAttached] = useState<AiMention[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const freshRunRef = useRef(false);
  const draftTimerRef = useRef<(() => void) | null>(null);
  const draftOpsRef = useRef<readonly unknown[]>([]);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const picker = useMentionPicker({
    candidates: mentionSource?.candidates ?? NO_CANDIDATES,
    mentions: attached,
    setMentions: setAttached,
    text: prompt,
    setText: setPrompt,
    fieldRef: inputRef,
    onMentionTrigger: mentionSource?.request,
  });
  const runSeq = useRef(0);
  const activeRunRef = useRef<number | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const applierRef = useRef(applier);
  applierRef.current = applier;
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;
  const isInteracting = useCanvasInteraction(rootRef);
  const isInteractingRef = useRef(isInteracting);
  isInteractingRef.current = isInteracting;
  const lastDraftRef = useRef(0);
  const draftBusyRef = useRef(false);
  const workTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const showRef = useRef(show);
  showRef.current = show;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const dragRef = useRef<{ y: number; height: number } | null>(null);
  const threadRef = useRef<HTMLOListElement | null>(null);
  const stickToBottom = useRef(true);

  const running = state.status === "running";
  const previewingId = applier.previewingBatchId;

  useEffect(() => {
    history.current = loadPromptHistory(kind, targetId);
    historyIndex.current = -1;
  }, [kind, targetId]);

  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useEffect(() => {
    setLayout(loadAiDockLayout(kind));
  }, [kind]);

  const projectId = runtime?.projectId;
  const warmNow = useCallback(() => {
    warm(projectId, {
      ...(warmProvider ? { provider: warmProvider } : {}),
      ...(warmProvider && warmModel ? { model: warmModel } : {}),
      ...(warmProvider && warmEffort ? { effort: warmEffort } : {}),
      actionKeys: WARM_ACTION_KEYS[kind],
    });
  }, [kind, projectId, warm, warmEffort, warmModel, warmProvider]);

  useEffect(() => {
    if (everOpened) warmNow();
  }, [everOpened, warmNow]);

  useEffect(() => {
    if (open && focusSignal > 0) inputRef.current?.focus();
  }, [focusSignal, open]);

  useEffect(() => {
    if (!open) return;
    setUnseenProposal(false);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const root = rootRef.current;
    if (root?.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  }, [open]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_PX);
    if (next > 0) el.style.height = `${next}px`;
  }, [prompt]);

  const disposition = useCallback(
    (batchId: string): Disposition => {
      if (previewingId === batchId) return "previewing";
      if (applier.appliedBatchIds.includes(batchId)) return "applied";
      if (dispositions[batchId]) return dispositions[batchId];
      if (applier.savedBatchIds.includes(batchId)) return "applied";
      if (applier.discardedBatchIds.includes(batchId)) return "discarded";
      return "proposed";
    },
    [
      applier.appliedBatchIds,
      applier.savedBatchIds,
      applier.discardedBatchIds,
      dispositions,
      previewingId,
    ],
  );

  const mark = useCallback((batchId: string, value: Disposition) => {
    setDispositions((current) => ({ ...current, [batchId]: value }));
  }, []);

  const excludeFor = useCallback(
    (batchId: string): ReadonlySet<number> => new Set(excludedRef.current[batchId] ?? []),
    [],
  );

  const handleOutcome = useCallback((batch: AiOpBatch, outcome: AiBatchPreviewOutcome): boolean => {
    if (!outcome.ok) {
      setConflicts((current) => ({ ...current, [batch.aiOpBatchId]: outcome.detail }));
      return false;
    }
    setConflicts((current) => {
      if (!(batch.aiOpBatchId in current)) return current;
      const next = { ...current };
      delete next[batch.aiOpBatchId];
      return next;
    });
    setSkippedOps(outcome.skipped);
    const skippedCount = outcome.skipped.length;
    setNotice(
      [
        skippedCount > 0
          ? `${skippedCount} ${skippedCount === 1 ? "change" : "changes"} from the AI couldn't be applied and ${
              skippedCount === 1 ? "was" : "were"
            } skipped.`
          : null,
        outcome.syncWarning ?? null,
      ]
        .filter(Boolean)
        .join(" ") || null,
    );
    return true;
  }, []);

  const showPreview = useCallback(
    async (batch: AiOpBatch, promote = false): Promise<boolean> => {
      setNotice(null);
      setSkippedOps([]);
      const options = { exclude: excludeFor(batch.aiOpBatchId) };
      const outcome = promote
        ? await applierRef.current.promoteDraft(batch, options)
        : await applierRef.current.preview(batch, options);
      return handleOutcome(batch, outcome);
    },
    [excludeFor, handleOutcome],
  );

  const toggleChange = useCallback(
    (batch: AiOpBatch, opIndex: number) => {
      const id = batch.aiOpBatchId;
      const current = new Set(excludedRef.current[id] ?? []);
      if (current.has(opIndex)) current.delete(opIndex);
      else current.add(opIndex);
      const next = { ...excludedRef.current, [id]: [...current] };
      excludedRef.current = next;
      setExcluded(next);
      if (applierRef.current.previewingBatchId === id) {
        setNotice(null);
        setSkippedOps([]);
        void applierRef.current
          .repreview(batch, { exclude: current })
          .then((outcome) => handleOutcome(batch, outcome));
      }
    },
    [handleOutcome],
  );

  const acceptCurrent = useCallback(() => {
    const id = applierRef.current.previewingBatchId;
    if (!id) return;
    applierRef.current.accept();
    mark(id, "applied");
    setToast((current) => ({ batchId: id, key: (current?.key ?? 0) + 1 }));
  }, [mark]);

  const requestPreview = useCallback(
    async (batch: AiOpBatch, then: "preview" | "apply" = "preview") => {
      const current = applierRef.current.previewingBatchId;
      if (current === batch.aiOpBatchId) {
        if (then === "apply") acceptCurrent();
        return;
      }
      if (current) {
        setPendingReplace({ batch, then });
        setExpanded(true);
        return;
      }
      const ok = await showPreview(batch);
      if (ok && then === "apply") acceptCurrent();
    },
    [acceptCurrent, showPreview],
  );

  const confirmReplace = useCallback(async () => {
    const pending = pendingReplace;
    if (!pending) return;
    setPendingReplace(null);
    setNotice(null);
    setSkippedOps([]);
    const { previous, outcome } = await applierRef.current.replacePreview(pending.batch, {
      exclude: excludeFor(pending.batch.aiOpBatchId),
    });
    if (previous) mark(previous, "discarded");
    const ok = handleOutcome(pending.batch, outcome);
    if (ok && pending.then === "apply") acceptCurrent();
  }, [acceptCurrent, excludeFor, handleOutcome, mark, pendingReplace]);

  const discard = useCallback(
    async (batch: AiOpBatch) => {
      setPendingReplace((current) =>
        current?.batch.aiOpBatchId === batch.aiOpBatchId ? null : current,
      );
      if (applierRef.current.previewingBatchId === batch.aiOpBatchId) {
        await applierRef.current.reject();
        mark(batch.aiOpBatchId, "discarded");
        return;
      }
      mark(batch.aiOpBatchId, "discarded");
      applierRef.current.restoreFresh();
      if (!runtime) return;
      try {
        const token = await runtime.getToken();
        await updateAiOpBatch(runtime.apiBaseUrl, token, batch.aiOpBatchId, {
          status: "rejected",
        });
      } catch {
        mark(batch.aiOpBatchId, "proposed");
        setNotice("Couldn't discard this proposal. Try again.");
      }
    },
    [mark, runtime],
  );

  const rejectCurrent = useCallback(() => {
    const id = applierRef.current.previewingBatchId;
    if (!id) return;
    void applierRef.current.reject().then(() => mark(id, "discarded"));
  }, [mark]);

  const undo = useCallback(
    async (batchId: string) => {
      setToast(null);
      const done = await applierRef.current.undoAccepted(batchId);
      if (done) mark(batchId, "undone");
      else setNotice("Couldn't undo: the document changed after the AI change was applied.");
    },
    [mark],
  );

  useEffect(() => {
    if (!toast) return undefined;
    if (!subscribeChanges) {
      const timer = setTimeout(() => setToast(null), UNDO_TOAST_MS);
      return () => clearTimeout(timer);
    }
    return subscribeChanges(() => setToast(null));
  }, [subscribeChanges, toast]);

  const stopDrafting = useCallback(() => {
    draftTimerRef.current?.();
    draftTimerRef.current = null;
    draftOpsRef.current = [];
    setDrafting(false);
  }, []);

  const scheduleDraftRef = useRef<() => void>(() => undefined);
  const scheduleDraft = useCallback(() => {
    if (draftTimerRef.current !== null || draftBusyRef.current) return;
    const delay = Math.max(0, DRAFT_THROTTLE_MS - (Date.now() - lastDraftRef.current));
    draftTimerRef.current = scheduleTimeout(() => {
      draftTimerRef.current = null;
      if (activeRunRef.current === null) return;
      const ops = draftOpsRef.current;
      draftBusyRef.current = true;
      void applierRef.current
        .draft(ops)
        .catch(() => false)
        .then((drawn) => {
          draftBusyRef.current = false;
          lastDraftRef.current = Date.now();
          if (activeRunRef.current === null) return;
          if (drawn) {
            setDrafting(true);
            if (!isInteractingRef.current()) applierRef.current.followDraft();
          }
          if (draftOpsRef.current !== ops && draftOpsRef.current.length > 0) {
            scheduleDraftRef.current();
          }
        });
    }, delay);
  }, []);
  scheduleDraftRef.current = scheduleDraft;

  useEffect(() => {
    if (!running || !canApply || !state.actionKey || !OP_ACTIONS.has(state.actionKey)) return;
    if (state.partialOps.length === 0) return;
    draftOpsRef.current = state.partialOps;
    scheduleDraft();
  }, [canApply, running, scheduleDraft, state.actionKey, state.partialOps]);

  useEffect(
    () => () => {
      draftTimerRef.current?.();
    },
    [],
  );

  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host || !drafting) return undefined;
    host.classList.add("wpn-ai-drafting");
    return () => host.classList.remove("wpn-ai-drafting");
  }, [drafting]);

  const buildingOps = running && Boolean(state.actionKey && OP_ACTIONS.has(state.actionKey));
  const noun = kind === "data_model" ? "data model" : "flow";
  useEffect(
    () => () => {
      if (workTimerRef.current) clearTimeout(workTimerRef.current);
      setWork(null);
    },
    [setWork],
  );
  const workLabel = drafting
    ? `${describeLiveOp(state.partialOps[state.partialOps.length - 1]) ?? "Drawing on the canvas"}…`
    : currentPhase(state);
  useEffect(() => {
    if (!buildingOps) return;
    if (workTimerRef.current) {
      clearTimeout(workTimerRef.current);
      workTimerRef.current = null;
    }
    setWork({
      phase: "running",
      noun,
      label: workLabel,
      changes: state.progress,
      provider: state.provider,
      onStop: () => stopRef.current(),
      onOpenChat: () => showRef.current(),
    });
  }, [buildingOps, noun, setWork, state.progress, state.provider, workLabel]);

  const lockCanvas = buildingOps || previewingId !== null;
  useEffect(() => {
    applierRef.current.setLocked(lockCanvas);
    return () => applierRef.current.setLocked(false);
  }, [lockCanvas]);

  useEffect(() => {
    if (!buildingOps) return undefined;
    const target = applierRef.current;
    return () => target.fit();
  }, [buildingOps]);
  const waitingOnEmpty = buildingOps && isEmpty && !drafting;
  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host || !buildingOps) return undefined;
    host.classList.add("wpn-ai-working");
    return () => host.classList.remove("wpn-ai-working");
  }, [buildingOps]);

  useEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host || !waitingOnEmpty) return undefined;
    host.classList.add("wpn-ai-waiting");
    host.setAttribute(
      "data-ai-waiting",
      kind === "data_model" ? "Designing your data model…" : "Designing your flow…",
    );
    return () => {
      host.classList.remove("wpn-ai-waiting");
      host.removeAttribute("data-ai-waiting");
    };
  }, [kind, waitingOnEmpty]);

  useEffect(() => {
    const id = activeRunRef.current;
    if (id === null || state.status === "running" || state.status === "idle") return;
    activeRunRef.current = null;
    if (activeChatRef.current.chatId === "new" && state.aiSessionId) setChatId(state.aiSessionId);
    const chatTouched = state.aiSessionId ?? activeChatRef.current.activeChatId;
    if (chatTouched) touchChat(chatTouched);
    const drafted = drafting;
    stopDrafting();
    const batch = state.status === "done" ? resultBatch(state) : null;
    const changes = batch
      ? describeOpBatch(batch, applierRef.current.draftBase() ?? getDocumentRef.current())
      : null;
    setRuns((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, state, changes } : entry)),
    );
    const fresh = freshRunRef.current;
    freshRunRef.current = false;
    let autoOpened = false;
    if (state.actionKey && OP_ACTIONS.has(state.actionKey)) {
      const built = batch ? batch.ops.length : 0;
      setWork({
        phase:
          state.status === "done" ? "done" : state.status === "cancelled" ? "stopped" : "failed",
        noun,
        label:
          state.status === "done"
            ? built > 0
              ? "Review it, then Apply to start editing"
              : "No changes were needed"
            : state.status === "cancelled"
              ? "The canvas was restored"
              : (state.error?.message ?? "The AI could not finish"),
        changes: built,
        provider: state.provider,
        onOpenChat: () => showRef.current(),
      });
      if (workTimerRef.current) clearTimeout(workTimerRef.current);
      workTimerRef.current = setTimeout(() => setWork(null), WORK_DONE_MS);
      if (
        state.status === "done" &&
        batch &&
        canApply &&
        changes?.length !== 0 &&
        !openRef.current
      ) {
        autoOpened = true;
        showRef.current();
      }
    }
    if (batch && changes?.length !== 0 && !openRef.current && !autoOpened) setUnseenProposal(true);
    const skipPreview =
      !batch ||
      !canApply ||
      changes?.length === 0 ||
      (!fresh && !openRef.current && !autoOpened) ||
      (applierRef.current.previewingBatchId !== null &&
        applierRef.current.previewingBatchId !== batch.aiOpBatchId) ||
      (!drafted && !fresh && isInteracting());
    if (!batch || skipPreview) {
      applierRef.current.endDraft();
      if (!batch || !canApply || changes?.length === 0) applierRef.current.restoreFresh();
      return;
    }
    void showPreview(batch, drafted).then((ok) => {
      if (!ok) applierRef.current.restoreFresh();
    });
  }, [
    canApply,
    drafting,
    isInteracting,
    noun,
    setWork,
    showPreview,
    state,
    stopDrafting,
    touchChat,
  ]);

  const freshOpenDoneRef = useRef(false);
  useEffect(() => {
    if (!open || freshOpenDoneRef.current) return;
    freshOpenDoneRef.current = true;
    if (running || applierRef.current.previewingBatchId) return;
    setChatId("new");
    setRuns([]);
    setNotice(null);
  }, [open, running]);

  useEffect(() => {
    if (!canApply) return undefined;
    const check = () => {
      const batch = aiEditorRequests.take(kind, targetId);
      if (batch) void requestPreview(batch);
    };
    check();
    return aiEditorRequests.subscribe(check);
  }, [canApply, kind, requestPreview, targetId]);

  useEffect(() => {
    const scope = rootRef.current?.closest(".wpn-flow-stage") ?? null;
    const handler = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "i") return;
      const target = event.target as Node | null;
      const inScope =
        !scope || (target instanceof Node && scope.contains(target)) || target === document.body;
      if (!inScope) return;
      if (isEditableTarget(event.target) && event.target !== inputRef.current) return;
      event.preventDefault();
      showRef.current();
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  const startRun = useCallback(
    (actionKey: AiActionKey, text: string, body: AiActionRunRequest) => {
      const id = ++runSeq.current;
      activeRunRef.current = id;
      setRuns((current) =>
        [...current, { id, actionKey, prompt: text, body, state: null, changes: null }].slice(
          -THREAD_LIMIT,
        ),
      );
      setExpanded(true);
      setNotice(null);
      void run(actionKey, body);
    },
    [run],
  );

  const conflictFor = useCallback((id: string) => conflicts[id] ?? null, [conflicts]);
  const excludedFor = useCallback((id: string) => new Set(excluded[id] ?? []), [excluded]);
  const onPreviewBatch = useCallback(
    (batch: AiOpBatch) => void requestPreview(batch),
    [requestPreview],
  );
  const onApplyBatch = useCallback(
    (batch: AiOpBatch) => void requestPreview(batch, "apply"),
    [requestPreview],
  );
  const onDiscardBatch = useCallback((batch: AiOpBatch) => void discard(batch), [discard]);

  const chips = dockChips(kind).map((item) =>
    item.id === "edit" && isEmpty ? { ...item, label: "Generate" } : item,
  );
  const chipFor = (id: DockChipId | null) => chips.find((item) => item.id === id) ?? null;

  const send = (chipId: DockChipId | null = chip) => {
    if (running || !route) return;
    const text = prompt.trim();
    const pinned = chipFor(chipId);
    if (!text && (!pinned || pinned.needsPrompt)) {
      if (pinned) setChip(pinned.id);
      inputRef.current?.focus();
      return;
    }
    const choice = chooseDockAction(
      kind,
      { empty: isEmpty, selectionCount: selectedCount },
      chipId,
    );
    if (OP_ACTIONS.has(choice.actionKey) && !canApply) {
      return;
    }
    const itemIds = choice.useSelection ? getSelectedIds() : [];
    const body: AiActionRunRequest = {
      ...(chatId === "new" ? { newChat: true } : activeChatId ? { sessionId: activeChatId } : {}),
      targetId,
      ...(text ? { prompt: text } : {}),
      ...(itemIds.length > 0 ? { selection: itemIds } : {}),
      ...(attached.length > 0 ? { mentions: attached } : {}),
      provider: route.provider,
      model: route.model,
      effort: route.effort,
    };
    if (text) history.current = pushPromptHistory(kind, targetId, text);
    historyIndex.current = -1;
    setPrompt("");
    setAttached([]);
    picker.close();
    setChip("ask");
    if (OP_ACTIONS.has(choice.actionKey) && applierRef.current.previewingBatchId) {
      applierRef.current.accept();
    }
    if (onSnapshot && !isEmpty && choice.actionKey.endsWith(".generate")) {
      setSnapshotting(true);
      void applierRef.current
        .trackSnapshot(onSnapshot())
        .catch(() => setNotice("Couldn't publish the previous version. Undo still brings it back."))
        .finally(() => setSnapshotting(false));
      if (applierRef.current.clearForFresh()) {
        body.fresh = true;
        freshRunRef.current = true;
      }
    }
    startRun(choice.actionKey, text, body);
  };

  const onChip = (item: DockChip) => {
    setChip(item.id);
    inputRef.current?.focus();
  };

  const closeActionMenu = useCallback(() => setActionMenuOpen(false), []);
  useOutsidePointerDown(actionMenuRef, closeActionMenu, actionMenuOpen);
  useEscapeKey(() => {
    setActionMenuOpen(false);
    actionTriggerRef.current?.focus();
  }, actionMenuOpen);

  const chipBlocked = (item: DockChip) =>
    !ready ||
    running ||
    (item.needsSelection && selectedCount === 0) ||
    ((item.id === "generate" || item.id === "edit") && !canApply);

  const actionMenuItems: MenuItemDefinition[] = [
    ...chips.map((item): MenuItemDefinition => ({
      type: "radio",
      id: item.id,
      label: item.label,
      checked: chip === item.id,
      disabled: chipBlocked(item),
      onSelect: () => {
        setActionMenuOpen(false);
        onChip(item);
      },
    })),
  ];

  const retry = (entry: DockRun) => {
    if (running) return;
    if (OP_ACTIONS.has(entry.actionKey) && applierRef.current.previewingBatchId) {
      applierRef.current.accept();
    }
    startRun(entry.actionKey, entry.prompt, {
      ...entry.body,
      ...(route ? { provider: route.provider, model: route.model, effort: route.effort } : {}),
    });
  };

  const answer = (entry: DockRun, answers: string) => {
    if (running) return;
    startRun(entry.actionKey, withAnswers(entry.prompt, answers), {
      ...entry.body,
      ...(route ? { provider: route.provider, model: route.model, effort: route.effort } : {}),
    });
  };

  const openInChat = (entry: DockRun) => {
    ui?.openPanel({
      newSession: true,
      prompt: entry.prompt,
      scopeKind: kind,
      scopeId: targetId,
    });
  };

  const runHandlersRef = useRef({ retry, answer, openInChat });
  runHandlersRef.current = { retry, answer, openInChat };
  const onRetryRun = useCallback((entry: DockRun) => runHandlersRef.current.retry(entry), []);
  const onAnswerRun = useCallback(
    (entry: DockRun, answers: string) => runHandlersRef.current.answer(entry, answers),
    [],
  );
  const onOpenRunInChat = useCallback(
    (entry: DockRun) => runHandlersRef.current.openInChat(entry),
    [],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;
    if (picker.handleKey(event)) return;
    const el = event.currentTarget;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (previewingId && (event.metaKey || event.ctrlKey || !prompt.trim())) {
        acceptCurrent();
        return;
      }
      send();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (pendingReplace) setPendingReplace(null);
      else if (previewingId) rejectCurrent();
      else if (chip && chip !== "ask") setChip("ask");
      else if (prompt || attached.length > 0) {
        setPrompt("");
        setAttached([]);
      } else hide();
      return;
    }
    if (event.key === "ArrowUp" && el.selectionStart === 0 && history.current.length > 0) {
      event.preventDefault();
      const next = Math.min(historyIndex.current + 1, history.current.length - 1);
      historyIndex.current = next;
      setPrompt(history.current[next] ?? "");
      return;
    }
    if (
      event.key === "ArrowDown" &&
      historyIndex.current >= 0 &&
      el.selectionEnd === el.value.length
    ) {
      event.preventDefault();
      const next = historyIndex.current - 1;
      historyIndex.current = next;
      setPrompt(next >= 0 ? (history.current[next] ?? "") : "");
    }
  };

  const updateLayout = useCallback(
    (next: AiDockLayout) => {
      setLayout(next);
      saveAiDockLayout(kind, next);
    },
    [kind],
  );

  const maxDockHeight = () => {
    const parentHeight = rootRef.current?.parentElement?.clientHeight ?? 0;
    return parentHeight > 0
      ? Math.max(MIN_DOCK_HEIGHT, parentHeight - DOCK_GUTTER)
      : FALLBACK_MAX_HEIGHT;
  };

  const clampHeight = (value: number) =>
    Math.round(Math.min(maxDockHeight(), Math.max(MIN_DOCK_HEIGHT, value)));

  const currentHeight = () => rootRef.current?.offsetHeight || layoutRef.current.height || 0;

  const onResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = currentHeight();
    let next: number | null = null;
    if (event.key === "ArrowUp") next = base + HEIGHT_STEP;
    else if (event.key === "ArrowDown") next = base - HEIGHT_STEP;
    else if (event.key === "Home") next = MIN_DOCK_HEIGHT;
    else if (event.key === "End") next = maxDockHeight();
    if (next === null) return;
    event.preventDefault();
    event.stopPropagation();
    updateLayout({ mode: "custom", height: clampHeight(next) });
  };

  const onResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { y: event.clientY, height: currentHeight() };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onResizePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setLayout({ mode: "custom", height: clampHeight(drag.height + drag.y - event.clientY) });
  };

  const onResizePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    saveAiDockLayout(kind, layoutRef.current);
  };

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (previewingId) return;
    const target = event.target as HTMLElement;
    if (target.closest?.('[aria-expanded="true"]')) return;
    event.preventDefault();
    if (pendingReplace) setPendingReplace(null);
    else hide();
  };

  const badge: AiDockBadge = open
    ? null
    : running
      ? "running"
      : unseenProposal || previewingId
        ? "proposal"
        : null;

  useEffect(() => {
    setBadge(badge);
  }, [badge, setBadge]);

  useEffect(() => () => setBadge(null), [setBadge]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return undefined;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setMeasured(root.offsetHeight);
      });
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    const parent = rootRef.current?.parentElement;
    if (!parent) return undefined;
    const clear = () => {
      parent.removeAttribute("data-ai-dock");
      parent.style.removeProperty("--wpn-ai-dock-offset");
    };
    if (!open) {
      clear();
      return undefined;
    }
    parent.setAttribute("data-ai-dock", "open");
    parent.style.setProperty("--wpn-ai-dock-offset", `${measured}px`);
    return clear;
  }, [measured, open]);

  const scrollFrameRef = useRef(0);
  const scheduleScroll = useCallback(() => {
    if (scrollFrameRef.current) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = 0;
      const thread = threadRef.current;
      if (thread && stickToBottom.current) thread.scrollTop = thread.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scheduleScroll();
  }, [
    scheduleScroll,
    runs.length,
    state.steps.length,
    state.progress,
    state.text.length,
    state.status,
  ]);

  useEffect(() => live.subscribe(scheduleScroll), [live, scheduleScroll]);

  useEffect(() => () => cancelAnimationFrame(scrollFrameRef.current), []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [prompt]);

  const fullMode = layout.mode !== "compact";
  const hasThread = runs.length > 0 || actionHistory.messages.length > 0;
  const showPanel = fullMode || (expanded && (hasThread || actionHistory.loading));

  const dockMax = maxDockHeight();
  const valueNow = Math.round(measured || layout.height || 0);

  const disabledReason = !ready ? connectAgentHint(me) : null;
  const suggestions =
    kind === "data_model"
      ? [
          "Add an orders table linked to customers",
          "Review this model for missing keys and indexes",
          "Explain how these tables relate",
        ]
      : [
          "Add an approval step after payment",
          "Review this flow for gaps and dead ends",
          "Explain this flow step by step",
        ];
  const scopeText =
    selectedCount > 0
      ? `${selectedCount} ${selectedCount === 1 ? itemNoun[0] : itemNoun[1]}`
      : wholeLabel;
  const pinned = chipFor(chip);
  const placeholder = disabledReason
    ? disabledReason
    : running
      ? "Working on it… you can type your next message"
      : pinned?.id === "generate"
        ? `Describe the ${kind === "data_model" ? "model" : "flow"} to generate…`
        : pinned?.id === "edit"
          ? isEmpty
            ? `Describe the ${kind === "data_model" ? "data model" : "flow"} to generate…`
            : selectedCount > 0
              ? `Describe the change to the selected ${selectedCount === 1 ? itemNoun[0] : itemNoun[1]}…`
              : `Describe the change to the whole ${kind === "data_model" ? "data model" : "flow"}…`
          : isEmpty
            ? `Describe a ${kind === "data_model" ? "data model" : "flow"} to generate… (# to reference)`
            : "Ask AI to change or explain this… (# to reference, ⌘I)";

  const liveStatus = useMemo(() => {
    if (running) return runStatusText(state);
    if (state.status === "error") return state.error?.message ?? "The AI run failed.";
    if (state.status === "cancelled") return "AI run stopped.";
    if (state.status === "done") {
      const batch = resultBatch(state);
      return batch ? "AI proposed changes." : "AI replied.";
    }
    return "";
  }, [running, state]);

  const removed = overlay?.removed.size ?? 0;

  return (
    <>
      <div
        ref={rootRef}
        className={[
          "wpn-ai-dock",
          open ? "wpn-ai-dock--open" : "wpn-ai-dock--hidden",
          `wpn-ai-dock--${layout.mode}`,
          dragging ? "wpn-ai-dock--dragging" : "",
          showPanel ? "wpn-ai-dock--thread" : "",
          running ? "wpn-ai-dock--running" : "",
          previewingId ? "wpn-ai-dock--previewing" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="region"
        aria-label="AI assistant"
        data-open={open ? "true" : "false"}
        data-mode={layout.mode}
        aria-hidden={open ? undefined : true}
        {...(open ? {} : { inert: "" })}
        style={dockHeightStyle(layout)}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={onRootKeyDown}
      >
        <div
          className="wpn-ai-dock__resize"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize AI panel"
          aria-valuemin={MIN_DOCK_HEIGHT}
          aria-valuemax={dockMax}
          aria-valuenow={valueNow}
          tabIndex={open ? 0 : -1}
          onKeyDown={onResizeKeyDown}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerEnd}
          onPointerCancel={onResizePointerEnd}
        />
        <div className="wpn-ai-dock__header">
          <Icon name="sparkles" className="wpn-ai-dock__spark" />
          <span className="wpn-ai-dock__panel-title">WeCollab</span>
          {!fullMode && expanded && hasThread ? (
            <button
              type="button"
              className="wpn-ai-dock__icon-btn"
              aria-label="Collapse"
              title="Collapse"
              onClick={() => setExpanded(false)}
            >
              <Icon name="chevronDown" />
            </button>
          ) : null}
          {workSlot ? (
            <span className="wpn-ai-dock__work" />
          ) : (
            <div className="wpn-ai-dock__work">
              <AiWorkStatus control={control} compact />
            </div>
          )}
          {!fullMode && !expanded && hasThread ? (
            <button
              type="button"
              className="wpn-ai-dock__result-toggle"
              onClick={() => setExpanded(true)}
            >
              <Icon name="chevronUp" />
              {runs.length === 0
                ? "Show chat"
                : runs.length === 1
                  ? "Show result"
                  : `Show ${runs.length} results`}
            </button>
          ) : null}
          {ui ? (
            <button
              type="button"
              className="wpn-ai-dock__icon-btn"
              aria-label="Create epics, user stories, flows or data models"
              title="Create epics, user stories, flows or data models from this"
              disabled={running}
              onClick={() => {
                const name = String(getDocument()?.meta?.name ?? "").trim();
                ui.openWorkspace({
                  mentions: [
                    {
                      kind,
                      id: targetId,
                      label: name || (kind === "data_model" ? "This data model" : "This flow"),
                    },
                  ],
                });
              }}
            >
              <Icon name="plus" />
            </button>
          ) : null}
          <div className="wpn-ai-dock__sizes" role="group" aria-label="Panel size">
            {SIZE_MODES.map((item) => (
              <button
                key={item.mode}
                type="button"
                className="wpn-ai-dock__size"
                aria-pressed={layout.mode === item.mode}
                aria-label={item.label}
                title={item.label}
                onClick={() => updateLayout({ mode: item.mode, height: layout.height })}
              >
                <Icon name={item.icon} />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="wpn-ai-dock__icon-btn"
            aria-label={running ? "Minimize AI chat" : "Close AI"}
            title={running ? "Minimize chat. AI keeps working on the canvas (Esc)" : "Close (Esc)"}
            onClick={hide}
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="wpn-sr-only" role="status" aria-live="polite">
          {liveStatus}
        </div>

        {showPanel ? (
          <div className="wpn-ai-dock__panel">
            <ol
              ref={threadRef}
              className="wpn-ai-dock__thread"
              onScroll={(event) => {
                const el = event.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              }}
            >
              {actionHistory.loading && actionHistory.messages.length === 0 ? (
                <li className="wpn-ai-dock__empty" role="status">
                  <span className="wpn-ai-muted">Loading chat…</span>
                </li>
              ) : null}
              {actionHistory.error ? (
                <li className="wpn-ai-dock__empty" role="alert">
                  <span className="wpn-ai-muted">Couldn't load this chat.</span>
                  <button type="button" className="wpn-ai-link" onClick={actionHistory.retry}>
                    Retry
                  </button>
                </li>
              ) : null}
              {actionHistory.messages.length > 0 ? (
                <li className="wpn-ai-dock__history">
                  <p className="wpn-ai-history__label">Earlier</p>
                  <AiActionHistory messages={actionHistory.messages} />
                </li>
              ) : null}
              {runs.map((entry, index) => (
                <DockRunItem
                  key={entry.id}
                  entry={entry}
                  live={entry.state === null ? state : null}
                  liveText={entry.state === null ? live : null}
                  canApply={canApply}
                  disposition={disposition}
                  conflict={conflictFor}
                  running={running}
                  canChat={Boolean(ui)}
                  excludedFor={excludedFor}
                  onToggleChange={toggleChange}
                  onPreview={onPreviewBatch}
                  onApply={onApplyBatch}
                  onDiscard={onDiscardBatch}
                  onRetry={onRetryRun}
                  onOpenInChat={onOpenRunInChat}
                  canAnswer={index === runs.length - 1 && !running}
                  onAnswer={onAnswerRun}
                />
              ))}
              {runs.length === 0 &&
              actionHistory.messages.length === 0 &&
              !actionHistory.loading &&
              !actionHistory.error ? (
                <li className="wpn-ai-dock__empty">
                  <Icon name="sparkles" className="wpn-ai-dock__empty-icon" />
                  <strong>
                    Ask AI to generate or change this {kind === "data_model" ? "model" : "flow"}
                  </strong>
                  <span className="wpn-ai-muted">Try one of these, or type your own request.</span>
                  <span className="wpn-ai-dock__suggestions">
                    {suggestions.map((text) => (
                      <button
                        key={text}
                        type="button"
                        className="wpn-ai-dock__suggestion"
                        disabled={Boolean(disabledReason)}
                        onClick={() => {
                          setPrompt(text);
                          inputRef.current?.focus();
                        }}
                      >
                        {text}
                      </button>
                    ))}
                  </span>
                </li>
              ) : null}
            </ol>
          </div>
        ) : null}

        {snapshotting ? (
          <div className="wpn-ai-dock__versioning" role="status">
            <Icon name="save" />
            Publishing the previous version while AI builds a new one…
          </div>
        ) : null}
        {running ? (
          <AiDockStatus
            state={state}
            onStop={stop}
            drawing={drafting}
            latest={drafting ? describeLiveOp(state.partialOps[state.partialOps.length - 1]) : null}
          />
        ) : null}

        {pendingReplace ? (
          <div className="wpn-ai-dock__confirm" role="alertdialog" aria-label="Replace preview">
            <span>A preview is already on the canvas. Replace it with this proposal?</span>
            <button
              type="button"
              className="wpn-btn wpn-btn--primary"
              onClick={() => void confirmReplace()}
            >
              <Icon name="refresh" className="wpn-btn__icon" />
              Replace preview
            </button>
            <button
              type="button"
              className="wpn-btn wpn-btn--ghost"
              onClick={() => setPendingReplace(null)}
            >
              <Icon name="x" className="wpn-btn__icon" />
              Keep current
            </button>
          </div>
        ) : null}

        {previewingId && overlay && !showPanel ? (
          <div className="wpn-ai-dock__preview">
            <span className="wpn-ai-dock__counts">
              <span className="wpn-ai-batch__added">+{overlay.added.size}</span>{" "}
              <span className="wpn-ai-batch__changed">~{overlay.changed.size}</span>{" "}
              <span className="wpn-ai-batch__removed">−{removed}</span>
            </span>
            <span className="wpn-ai-muted">Previewing · Enter to apply · Esc to discard</span>
            <span className="wpn-ai-dock__spacer" />
            <button type="button" className="wpn-btn wpn-btn--primary" onClick={acceptCurrent}>
              <Icon name="check" className="wpn-btn__icon" />
              Apply
            </button>
            <button type="button" className="wpn-btn wpn-btn--ghost" onClick={rejectCurrent}>
              <Icon name="x" className="wpn-btn__icon" />
              Discard
            </button>
          </div>
        ) : null}

        {toast ? (
          <div key={toast.key} className="wpn-ai-dock__toast" role="status">
            <Icon name="check" className="wpn-ai-dock__toast-icon" />
            <span>AI change applied. Save to keep it.</span>
            <span className="wpn-ai-dock__toast-hint">{undoHint}</span>
            <button
              type="button"
              className="wpn-ai-dock__toast-btn"
              onClick={() => void undo(toast.batchId)}
            >
              <Icon name="undo" className="wpn-btn__icon" />
              Undo AI change
            </button>
            {subscribeChanges ? null : (
              <span className="wpn-ai-dock__toast-timer" aria-hidden="true" />
            )}
          </div>
        ) : null}

        {applier.syncPending ? (
          <div className="wpn-ai-dock__sync" role="status">
            {applier.syncError ?? "Not synced — retrying"}
          </div>
        ) : null}

        {notice || applier.error || skippedOps.length > 0 ? (
          <div className="wpn-ai-dock__notice" role="alert">
            {notice ?? applier.error}
            {skippedOps.length > 0 ? (
              <details className="wpn-ai-dock__skipped">
                <summary>Show skipped changes</summary>
                <ul>
                  {skippedOps.map((entry, index) => (
                    <li key={index}>{entry}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}

        <div className="wpn-ai-dock__composer">
          {running ? (
            <ComposerStatus since={state.startedAt} label={runStatusText(state)} hint={null} />
          ) : null}
          {attached.length > 0 ? (
            <ul className="wpn-ai-chips wpn-ai-dock__chips-row" aria-label="Referenced">
              {attached.map((mention) => (
                <li key={`${mention.kind}:${mention.id}`}>
                  <AiMentionChip
                    mention={mention}
                    onRemove={() =>
                      setAttached((current) =>
                        current.filter(
                          (item) => !(item.kind === mention.kind && item.id === mention.id),
                        ),
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            ref={inputRef}
            rows={1}
            className="wpn-ai-dock__input"
            aria-label="Ask AI about this document"
            placeholder={placeholder}
            value={prompt}
            disabled={Boolean(disabledReason)}
            role="combobox"
            aria-expanded={picker.open && picker.hasResults}
            aria-controls={picker.open ? picker.listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={picker.activeOptionId}
            onFocus={warmNow}
            onChange={(event) => {
              if (!prompt && event.target.value) warmNow();
              setPrompt(event.target.value);
              historyIndex.current = -1;
              picker.update(
                event.target.value,
                event.target.selectionStart ?? event.target.value.length,
              );
            }}
            onClick={(event) =>
              picker.update(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
            }
            onBlur={picker.onFieldBlur}
            onKeyDown={onKeyDown}
          />
          {picker.menu}
        </div>

        <div className="wpn-ai-dock__footer">
          <span
            className={[
              "wpn-ai-dock__scope",
              selectedCount > 0 ? "wpn-ai-dock__scope--selection" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={
              selectedCount > 0
                ? "AI will focus on the selection"
                : "AI will use the whole document"
            }
          >
            <Icon name={kind === "data_model" ? "dataModel" : "flow"} />
            {scopeText}
          </span>
          <span ref={actionMenuRef} className="wpn-ai-dock__action-menu">
            <button
              ref={actionTriggerRef}
              type="button"
              className={[
                "wpn-ai-dock__action-trigger",
                pinned ? "wpn-ai-dock__action-trigger--set" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-haspopup="menu"
              aria-expanded={actionMenuOpen}
              aria-label={`AI action: ${pinned?.label ?? "Ask"}`}
              disabled={!ready || running}
              onClick={() => setActionMenuOpen((current) => !current)}
            >
              {pinned?.label ?? "Ask"}
              <Icon name="chevronDown" className="wpn-ai-dock__action-caret" />
            </button>
            {actionMenuOpen ? (
              <MenuPanel
                items={actionMenuItems}
                placement="top-start"
                anchorRef={actionTriggerRef}
                onRequestClose={closeActionMenu}
                className="wpn-ai-dock__action-panel"
              />
            ) : null}
          </span>
          <span className="wpn-ai-dock__spacer" />
          {disabledReason ? (
            <button
              type="button"
              className="wpn-btn wpn-btn--ghost"
              onClick={() => ui?.openIntegrations("connectors")}
            >
              <Icon name="plug" className="wpn-btn__icon" />
              Connect
            </button>
          ) : (
            <AiModelSwitcher
              compact
              placement="top"
              value={route}
              persist={false}
              disabled={running}
              onChange={(next) =>
                setDefaults({ provider: next.provider, model: next.model, effort: next.effort })
              }
            />
          )}
          {running ? (
            <button
              type="button"
              className="wpn-ai-dock__send wpn-ai-dock__send--stop"
              aria-label="Stop"
              onClick={stop}
            >
              <Icon name="stop" />
            </button>
          ) : (
            <button
              type="button"
              className="wpn-ai-dock__send"
              aria-label="Send"
              disabled={Boolean(disabledReason) || (!prompt.trim() && !pinned)}
              onClick={() => send()}
            >
              <Icon name="send" />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

interface DockRunItemProps {
  entry: DockRun;
  live: AiActionRunState | null;
  liveText: AiLiveTextStore | null;
  canApply: boolean;
  disposition: (batchId: string) => Disposition;
  conflict: (batchId: string) => string | null;
  running: boolean;
  canChat: boolean;
  excludedFor: (batchId: string) => ReadonlySet<number>;
  onToggleChange: (batch: AiOpBatch, opIndex: number) => void;
  onPreview: (batch: AiOpBatch) => void;
  onApply: (batch: AiOpBatch) => void;
  onDiscard: (batch: AiOpBatch) => void;
  onRetry: (entry: DockRun) => void;
  onOpenInChat: (entry: DockRun) => void;
  canAnswer: boolean;
  onAnswer: (entry: DockRun, answers: string) => void;
}

const CONNECTING_STATE: AiActionRunState = {
  ...IDLE_AI_ACTION,
  status: "running",
  steps: [{ id: "connect", label: "Connecting to AI…", status: "running" }],
};

const DISPOSITION_LABELS: Record<Disposition, string> = {
  proposed: "Proposed",
  previewing: "Previewing",
  applied: "Applied",
  discarded: "Discarded",
  undone: "Undone",
};

const DockRunItem = memo(function DockRunItem({
  entry,
  live,
  liveText,
  canApply,
  disposition,
  conflict,
  running,
  canChat,
  excludedFor,
  onToggleChange,
  onPreview,
  onApply,
  onDiscard,
  onRetry,
  onOpenInChat,
  canAnswer,
  onAnswer,
}: DockRunItemProps) {
  const state = entry.state ?? live;
  const opAction = OP_ACTIONS.has(entry.actionKey);
  const shown = state && opAction ? { ...state, text: "" } : state;
  const batch = resultBatch(entry.state);
  const findings = resultFindings(entry.state?.result);
  const note = findings.length === 0 && !batch ? resultNote(entry.state?.result) : null;
  const finished = entry.state !== null;
  const failed = entry.state?.status === "error" || entry.state?.status === "cancelled";
  const textResult = finished && !batch && !failed;
  const jsonOnly =
    entry.state?.result?.kind === "json" && !batch && findings.length === 0 && !note
      ? entry.state.result.value
      : undefined;

  return (
    <li className="wpn-ai-dock__run wpn-ai-fade-up">
      <div className="wpn-ai-dock__prompt">
        <span className="wpn-ai-dock__action">
          {ACTION_LABELS[entry.actionKey] ?? entry.actionKey}
        </span>
        <span className="wpn-ai-dock__prompt-text">{entry.prompt || "Whole document"}</span>
        {entry.body.mentions?.length ? (
          <span className="wpn-ai-chips wpn-ai-dock__prompt-chips">
            {entry.body.mentions.map((mention) => (
              <AiMentionChip key={`${mention.kind}:${mention.id}`} mention={mention} />
            ))}
          </span>
        ) : null}
      </div>
      {batch ? (
        <BatchResult
          batch={batch}
          changes={entry.changes ?? []}
          canApply={canApply}
          disposition={disposition(batch.aiOpBatchId)}
          conflict={conflict(batch.aiOpBatchId)}
          excluded={excludedFor(batch.aiOpBatchId)}
          onToggle={(opIndex) => onToggleChange(batch, opIndex)}
          onPreview={onPreview}
          onApply={onApply}
          onDiscard={onDiscard}
        />
      ) : null}
      <AiActivity state={shown ?? CONNECTING_STATE} compact hideText live={liveText ?? undefined} />
      {findings.length > 0 ? (
        <ul className="wpn-ai-dock__findings">
          {findings.map((finding, index) => (
            <li
              key={index}
              className={`wpn-ai-dock__finding wpn-ai-dock__finding--${finding.severity ?? "info"}`}
            >
              {finding.title ? <strong>{finding.title}</strong> : null}
              {finding.target ? (
                <span className="wpn-ai-dock__finding-target">{finding.target}</span>
              ) : null}
              {finding.message ? <span>{finding.message}</span> : null}
              {finding.fix ? (
                <span className="wpn-ai-dock__finding-fix">Fix: {finding.fix}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <div className="wpn-ai-dock__note">
          {note.title ? <strong>{note.title}</strong> : null}
          {note.rationale ? <span>{note.rationale}</span> : null}
        </div>
      ) : null}
      {note && note.questions.length > 0 ? (
        <AiQuestionsCard
          questions={note.questions}
          disabled={running}
          onSubmit={canAnswer ? (answers) => onAnswer(entry, answers) : undefined}
        />
      ) : null}
      {jsonOnly !== undefined ? (
        <pre className="wpn-ai-dock__json">{JSON.stringify(jsonOnly, null, 2)}</pre>
      ) : null}
      {textResult || failed ? (
        <div className="wpn-ai-dock__run-actions">
          <button
            type="button"
            className="wpn-ai-link"
            disabled={running}
            onClick={() => onRetry(entry)}
          >
            <Icon name="refresh" /> Retry
          </button>
          {canChat ? (
            <button type="button" className="wpn-ai-link" onClick={() => onOpenInChat(entry)}>
              <Icon name="open" /> Open in chat
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
});

function BatchResult({
  batch,
  changes,
  canApply,
  disposition,
  conflict,
  excluded,
  onToggle,
  onPreview,
  onApply,
  onDiscard,
}: {
  batch: AiOpBatch;
  changes: AiChangeLine[];
  canApply: boolean;
  disposition: Disposition;
  conflict: string | null;
  excluded: ReadonlySet<number>;
  onToggle: (opIndex: number) => void;
  onPreview: (batch: AiOpBatch) => void;
  onApply: (batch: AiOpBatch) => void;
  onDiscard: (batch: AiOpBatch) => void;
}) {
  const counts = countChanges(changes);
  const open = disposition === "proposed" || disposition === "previewing";
  const empty = changes.length === 0;
  const problems = conflict ? conflict.split("\n").filter(Boolean) : [];
  return (
    <section className={`wpn-ai-dock__result wpn-ai-dock__result--${disposition}`}>
      <div className="wpn-ai-dock__result-head">
        <span className="wpn-ai-dock__result-icon" aria-hidden="true">
          <Icon name={disposition === "applied" ? "check" : "sparkles"} />
        </span>
        <span className="wpn-ai-dock__result-title" title={batch.rationale || undefined}>
          {empty ? "No changes needed" : batch.title || "Changes ready"}
        </span>
        {empty ? null : (
          <span className="wpn-ai-dock__counts">
            <span className="wpn-ai-batch__added">+{counts.add}</span>{" "}
            <span className="wpn-ai-batch__changed">~{counts.change}</span>{" "}
            <span className="wpn-ai-batch__removed">−{counts.remove}</span>
          </span>
        )}
        {open && !empty ? (
          <span className="wpn-ai-dock__result-actions">
            <button
              type="button"
              className="wpn-btn wpn-btn--ghost"
              onClick={() => onDiscard(batch)}
            >
              <Icon name="x" className="wpn-btn__icon" />
              Discard
            </button>
            {disposition === "proposed" ? (
              <button
                type="button"
                className="wpn-btn wpn-btn--ghost"
                disabled={!canApply}
                onClick={() => onPreview(batch)}
              >
                <Icon name="eye" className="wpn-btn__icon" />
                Preview proposal
              </button>
            ) : null}
            <button
              type="button"
              className="wpn-btn wpn-btn--primary"
              disabled={!canApply}
              onClick={() => onApply(batch)}
            >
              <Icon name="check" className="wpn-btn__icon" />
              Apply
            </button>
          </span>
        ) : (
          <span className={`wpn-ai-chip wpn-ai-chip--${disposition}`}>
            {DISPOSITION_LABELS[disposition]}
          </span>
        )}
      </div>
      {!empty ? (
        <AiChangeList
          lines={changes}
          excluded={excluded}
          onToggle={open ? onToggle : undefined}
          disabled={!canApply}
        />
      ) : null}
      {problems.length > 0 ? (
        <details className="wpn-ai-dock__problems">
          <summary role="alert">
            Couldn't apply: {problems.length} {problems.length === 1 ? "problem" : "problems"}
          </summary>
          <ul>
            {problems.map((problem, index) => (
              <li key={index}>{problem}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
