import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalAiRuntimeActions } from "./AiRuntimeContext";
import type { RevisionedDocumentState } from "../../hooks/useRevisionedDocument";
import { useTokenGetter } from "../../hooks/useTokenGetter";
import { fetchAiOpBatch, updateAiOpBatch } from "../../services/aiService";
import type { AiOpBatch, UpdateAiOpBatchRequest } from "../../types/ai.types";
import type { ErdDocumentJSON } from "../../types/dataModel.types";
import type { FlowJSON } from "../../types/flowchart.types";
import type { ErdEngine } from "../../utils/erd/erdEngine";
import type { FlowEngine } from "../../utils/flowchart/flowEngine";
import { aiPreviewStore, type AiPreviewStore } from "./aiPreviewStore";
import { AsyncMutex } from "./asyncMutex";
import {
  CoalescingRunner,
  NO_APPLIED_BATCHES,
  advanceDraftSession,
  applyBatchToDocument,
  applyPartialOps,
  buildPreviewOverlay,
  filterBatchOps,
  mergeDocDiffs,
  planDraftStep,
  promoteDraftSession,
  rebuildDraftSession,
  startDraftSession,
  supportsDraftSession,
  withAccepted,
  withPreview,
  withRejected,
  type AppliedBatches,
  type BatchApplication,
  type DraftIds,
  type DraftSession,
} from "./opBatchApplier";
import { getOpKind } from "./ops/registry";
import type { DocDiff } from "./ops/types";
import { getEntityRect, getNoteRect } from "../../utils/erd/erdGeometry";
import { isOpBatchStatusConflict, reconcileStatusConflict } from "./opBatchConflict";
import { PatchQueue, type PatchQueueState, type PatchSendResult } from "./patchQueue";

interface ApplierBase {
  targetId: string | null;
  apiBaseUrl?: string;
  getAuthToken?: () => string | Promise<string>;
  onUnsavedAiChangesChange?: (hasUnsavedAiChanges: boolean) => void;
  onModelDescription?: (description: string) => void;
  onModelName?: (name: string) => void;
  previewStore?: AiPreviewStore;
  onBatchSynced?: (batch: AiOpBatch) => void;
}

export type UseAiOpBatchApplierOptions = ApplierBase &
  (
    | {
        kind: "data_model";
        engine: ErdEngine | null;
        documentState: RevisionedDocumentState<ErdDocumentJSON>;
        getDocument?: () => ErdDocumentJSON | null;
      }
    | {
        kind: "flow";
        engine: FlowEngine | null;
        documentState: RevisionedDocumentState<FlowJSON>;
        getDocument?: () => FlowJSON | null;
      }
  );

export type AiBatchPreviewOutcome =
  | { ok: true; diff: DocDiff; warnings: string[]; skipped: string[]; syncWarning?: string }
  | { ok: false; status: "conflict" | "invalid"; detail: string };

export interface AiPreviewOptions {
  exclude?: ReadonlySet<number>;
}

export interface AiOpBatchApplier {
  previewingBatchId: string | null;
  appliedBatchIds: readonly string[];
  savedBatchIds: readonly string[];
  discardedBatchIds: readonly string[];
  hasUnsavedAiChanges: boolean;
  error: string | null;
  syncPending: boolean;
  syncError: string | null;
  preview: (batch: AiOpBatch, options?: AiPreviewOptions) => Promise<AiBatchPreviewOutcome>;
  repreview: (batch: AiOpBatch, options?: AiPreviewOptions) => Promise<AiBatchPreviewOutcome>;
  replacePreview: (
    batch: AiOpBatch,
    options?: AiPreviewOptions,
  ) => Promise<{ previous: string | null; outcome: AiBatchPreviewOutcome }>;
  draft: (ops: readonly unknown[]) => Promise<boolean>;
  endDraft: () => void;
  promoteDraft: (batch: AiOpBatch, options?: AiPreviewOptions) => Promise<AiBatchPreviewOutcome>;
  followDraft: () => void;
  draftBase: () => ErdDocumentJSON | FlowJSON | null;
  locked: boolean;
  setLocked: (locked: boolean) => void;
  fit: () => void;
  clearForFresh: () => boolean;
  restoreFresh: () => void;
  trackSnapshot: (work: Promise<void>) => Promise<void>;
  accept: () => void;
  reject: () => Promise<void>;
  undoAccepted: (aiOpBatchId: string) => Promise<boolean>;
  markSaved: (revision: number) => Promise<void>;
  discard: () => Promise<void>;
}

function describe(err: unknown): string {
  return err instanceof Error && err.message ? err.message : "Could not update the AI batch";
}

function httpStatus(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : null;
}

const FRESH_KEY = "\u0000fresh";
const FOLLOW_FIT_MS = 1500;
const NOT_SYNCED = "Not synced — retrying";

interface DraftState {
  abandoned: boolean;
  applied: readonly unknown[];
  steps: number;
  pushes: number;
  ids: DraftIds;
  before: ErdDocumentJSON | FlowJSON | null;
  diff: DocDiff | null;
  session: DraftSession | null;
}

type ChangeSource = { on: (event: "change", handler: () => void) => () => void };

export function useAiOpBatchApplier(options: UseAiOpBatchApplierOptions): AiOpBatchApplier {
  const runtime = useOptionalAiRuntimeActions();
  const fallbackToken = useTokenGetter(options.getAuthToken);
  const apiBaseUrl = options.apiBaseUrl ?? runtime?.apiBaseUrl ?? "";
  const getToken = options.getAuthToken || !runtime ? fallbackToken : runtime.getToken;
  const store = options.previewStore ?? aiPreviewStore;
  const [batches, setBatches] = useState<AppliedBatches>(NO_APPLIED_BATCHES);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<PatchQueueState>({ pending: 0, retrying: false });
  const [syncError, setSyncError] = useState<string | null>(null);
  const batchesRef = useRef(batches);
  batchesRef.current = batches;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const transportRef = useRef({ apiBaseUrl, getToken });
  transportRef.current = { apiBaseUrl, getToken };
  const statusRef = useRef(new Map<string, string>());
  const stopWatchRef = useRef<(() => void) | null>(null);
  const draftRef = useRef<DraftState | null>(null);
  const draftEpochRef = useRef(0);
  const mutexRef = useRef(new AsyncMutex());
  const revRef = useRef(0);
  const knownRevRef = useRef(0);
  const markersRef = useRef(new Map<string, number>());
  const snapshotsRef = useRef(0);
  const [savedIds, setSavedIds] = useState<readonly string[]>([]);
  const [discardedIds, setDiscardedIds] = useState<readonly string[]>([]);
  const { kind, targetId, engine } = options;

  const setBatchState = useCallback((next: AppliedBatches) => {
    batchesRef.current = next;
    setBatches(next);
  }, []);

  useEffect(() => {
    if (!engine) return undefined;
    return (engine as unknown as ChangeSource).on("change", () => {
      revRef.current += 1;
    });
  }, [engine]);

  const mutate = useCallback((run: () => void) => {
    const previous = knownRevRef.current;
    const clean = revRef.current === previous;
    run();
    const now = revRef.current;
    knownRevRef.current = now;
    if (clean) {
      for (const [id, marker] of markersRef.current) {
        if (marker === previous) markersRef.current.set(id, now);
      }
    }
  }, []);

  const userEdited = useCallback(() => revRef.current !== knownRevRef.current, []);

  const queueRef = useRef<PatchQueue<UpdateAiOpBatchRequest> | null>(null);
  if (queueRef.current === null) {
    queueRef.current = new PatchQueue<UpdateAiOpBatchRequest>({
      send: async (aiOpBatchId, input): Promise<PatchSendResult> => {
        try {
          const transport = transportRef.current;
          const authToken = await transport.getToken();
          const updated = await updateAiOpBatch(
            transport.apiBaseUrl,
            authToken,
            aiOpBatchId,
            input,
          );
          statusRef.current.set(aiOpBatchId, updated.status);
          setError(null);
          return "ok";
        } catch (err) {
          const status = httpStatus(err);
          if (status === 409) {
            statusRef.current.delete(aiOpBatchId);
            if (isOpBatchStatusConflict(err)) {
              const transport = transportRef.current;
              const outcome = await reconcileStatusConflict(input, async () =>
                fetchAiOpBatch(transport.apiBaseUrl, await transport.getToken(), aiOpBatchId),
              );
              if (outcome.kind !== "unknown") {
                statusRef.current.set(aiOpBatchId, outcome.batch.status);
                optionsRef.current.onBatchSynced?.(outcome.batch);
              }
              if (outcome.kind === "settled") {
                setError(null);
                return "ok";
              }
            }
            setError("This AI change was already updated elsewhere.");
            return "conflict";
          }
          if (
            status !== null &&
            status >= 400 &&
            status < 500 &&
            status !== 408 &&
            status !== 429
          ) {
            setError(describe(err));
            return "drop";
          }
          setSyncError(describe(err));
          return "retry";
        }
      },
      onSettled: (_id, result) => {
        if (result === "drop") {
          setError((current) => current ?? "Could not sync this AI change. Check your connection.");
        }
      },
      onChange: (state) => {
        setSync(state);
        if (state.pending === 0) setSyncError(null);
      },
    });
  }
  const queue = queueRef.current;

  useEffect(() => {
    queue.resume();
    const flush = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void queue.flush();
    };
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.removeEventListener("online", flush);
      document.removeEventListener("visibilitychange", flush);
      queue.dispose();
    };
  }, [queue]);

  const patch = useCallback(
    async (aiOpBatchId: string, input: UpdateAiOpBatchRequest): Promise<PatchSendResult> => {
      return queue.sendNow(aiOpBatchId, input);
    },
    [queue],
  );

  const stopWatching = useCallback(() => {
    stopWatchRef.current?.();
    stopWatchRef.current = null;
  }, []);

  const clearOverlay = useCallback(() => {
    stopWatching();
    if (targetId) store.clear(kind, targetId);
  }, [kind, store, stopWatching, targetId]);

  const descriptionRef = useRef<string | null>(null);
  const nameBaselineRef = useRef<string | null>(null);

  const accept = useCallback(() => {
    markersRef.current.delete(FRESH_KEY);
    clearOverlay();
    setBatchState(withAccepted(batchesRef.current));
    const description = descriptionRef.current;
    descriptionRef.current = null;
    if (description) optionsRef.current.onModelDescription?.(description);
    const baseline = nameBaselineRef.current;
    nameBaselineRef.current = null;
    const current = optionsRef.current;
    if (baseline !== null && current.kind === "data_model") {
      const name = current.engine?.getState().name.trim();
      if (name && name !== baseline) current.onModelName?.(name);
    }
  }, [clearOverlay, setBatchState]);

  const currentDocument = useCallback((): ErdDocumentJSON | FlowJSON | null => {
    const current = optionsRef.current;
    if (current.getDocument) return current.getDocument();
    return current.engine ? current.engine.toJSON() : null;
  }, []);

  const lockRef = useRef<{ locked: boolean; prior: boolean }>({ locked: false, prior: false });
  const [locked, setLockedState] = useState(false);

  const setLocked = useCallback((locked: boolean) => {
    const engine = optionsRef.current.engine;
    const lock = lockRef.current;
    if (!engine || lock.locked === locked) return;
    if (locked) {
      lock.prior = engine.getState().readOnly;
      lock.locked = true;
      engine.setReadOnly(true);
    } else {
      lock.locked = false;
      engine.setReadOnly(lock.prior);
    }
    setLockedState(locked);
  }, []);

  const fit = useCallback(() => {
    optionsRef.current.engine?.fitView({ maxZoom: 1 });
  }, []);

  const lastFollowRef = useRef(0);

  const draftBase = useCallback((): ErdDocumentJSON | FlowJSON | null => {
    const draft = draftRef.current;
    return draft && !draft.abandoned && draft.pushes > 0 ? draft.before : null;
  }, []);

  const followDraft = useCallback(() => {
    const now = Date.now();
    if (now - lastFollowRef.current < FOLLOW_FIT_MS) return;
    const current = optionsRef.current;
    if (current.kind === "data_model" && current.engine) {
      const { viewport, canvasSize, entityLookup, noteLookup } = current.engine.getState();
      if (canvasSize.width > 0 && canvasSize.height > 0 && viewport.zoom > 0) {
        const left = -viewport.x / viewport.zoom;
        const top = -viewport.y / viewport.zoom;
        const right = left + canvasSize.width / viewport.zoom;
        const bottom = top + canvasSize.height / viewport.zoom;
        const outside = (draftRef.current?.diff?.added ?? []).some((id) => {
          const entity = entityLookup.get(id);
          const note = entity ? undefined : noteLookup.get(id);
          const rect = entity ? getEntityRect(entity) : note ? getNoteRect(note) : null;
          return (
            rect !== null &&
            (rect.x < left ||
              rect.y < top ||
              rect.x + rect.width > right ||
              rect.y + rect.height > bottom)
          );
        });
        if (!outside) return;
      }
    }
    lastFollowRef.current = now;
    fit();
  }, [fit]);

  useEffect(() => () => setLocked(false), [setLocked]);

  const prepareDocument = useCallback(
    (incoming: ErdDocumentJSON | FlowJSON): ErdDocumentJSON | FlowJSON => {
      const current = optionsRef.current;
      if (current.kind !== "data_model") return incoming;
      if (nameBaselineRef.current === null) {
        nameBaselineRef.current = current.engine?.getState().name.trim() ?? "";
      }
      const { description, ...meta } = (incoming as ErdDocumentJSON).meta ?? {};
      descriptionRef.current =
        typeof description === "string" && description.trim() ? description.trim() : null;
      return { ...(incoming as ErdDocumentJSON), meta };
    },
    [],
  );

  const loadDocument = useCallback(
    (incoming: ErdDocumentJSON | FlowJSON): boolean => {
      const current = optionsRef.current;
      const engine = current.engine;
      const document = prepareDocument(incoming);
      const relock = lockRef.current.locked;
      const startRev = revRef.current;
      mutate(() => {
        if (current.kind === "data_model") {
          if (relock) {
            current.engine?.applyDraftDocument(document as ErdDocumentJSON, { push: true });
          } else {
            current.engine?.applyDocument(document as ErdDocumentJSON, { recordHistory: true });
          }
          return;
        }
        if (relock) engine?.setReadOnly(false);
        try {
          current.engine?.loadFlow(document as FlowJSON, { recordHistory: true });
        } finally {
          if (relock) engine?.setReadOnly(true);
        }
      });
      return revRef.current !== startRev;
    },
    [mutate, prepareDocument],
  );

  const replaceDraftDocument = useCallback(
    (incoming: ErdDocumentJSON | FlowJSON, push: boolean): boolean => {
      const current = optionsRef.current;
      if (current.kind !== "data_model" || !current.engine) return false;
      const engine = current.engine;
      if (!lockRef.current.locked && engine.getState().readOnly) return false;
      const document = prepareDocument(incoming) as ErdDocumentJSON;
      const startRev = revRef.current;
      mutate(() => engine.applyDraftDocument(document, { push }));
      return revRef.current !== startRev;
    },
    [mutate, prepareDocument],
  );

  const undoEngine = useCallback(
    (times: number) => {
      mutate(() => {
        for (let index = 0; index < times; index++) optionsRef.current.engine?.undo();
      });
    },
    [mutate],
  );

  const restoreDraft = useCallback((): boolean => {
    const draft = draftRef.current;
    if (!draft || draft.pushes === 0) return true;
    if (userEdited()) {
      draft.pushes = 0;
      draft.abandoned = true;
      return false;
    }
    undoEngine(draft.pushes);
    draft.pushes = 0;
    return true;
  }, [undoEngine, userEdited]);

  const draftRunnerRef = useRef<CoalescingRunner<{
    ops: readonly unknown[];
    epoch: number;
  }> | null>(null);

  const endDraft = useCallback(() => {
    draftEpochRef.current += 1;
    draftRunnerRef.current?.clear();
    const draft = draftRef.current;
    if (!draft) return;
    restoreDraft();
    draftRef.current = null;
    if (batchesRef.current.previewing === null && targetId) store.clear(kind, targetId);
    if (batchesRef.current.applied.length === 0) {
      optionsRef.current.onUnsavedAiChangesChange?.(false);
    }
  }, [kind, restoreDraft, store, targetId]);

  const draftSessionStep = useCallback(
    async (draft: DraftState, ops: readonly unknown[], epoch: number): Promise<boolean> => {
      const current = optionsRef.current;
      if (!current.targetId) return false;
      const rev = revRef.current;
      let session = draft.session;
      if (!session) {
        const before = currentDocument();
        if (!before) return false;
        session = await startDraftSession(current.kind, before).catch(() => null);
        if (!session) return false;
      }
      let next = await advanceDraftSession(session, ops).catch(() => null);
      if (next === "rebuild") next = await rebuildDraftSession(session, ops).catch(() => null);
      if (epoch !== draftEpochRef.current || revRef.current !== rev) return false;
      if (!next) return false;
      const previous = draft.session?.document ?? next.before;
      draft.session = next;
      draft.applied = next.applied;
      draft.before = next.before;
      if (next.document === previous) return false;
      if (replaceDraftDocument(next.document, draft.pushes === 0) && draft.pushes === 0) {
        draft.pushes = 1;
      }
      draft.diff = next.diff;
      store.set(
        buildPreviewOverlay(
          { aiOpBatchId: "draft", targetKind: current.kind, targetId: current.targetId },
          next.before,
          next.diff,
        ),
      );
      return true;
    },
    [currentDocument, replaceDraftDocument, store],
  );

  const draftStep = useCallback(
    async (ops: readonly unknown[], epoch: number): Promise<boolean> => {
      const current = optionsRef.current;
      if (!current.engine || !current.targetId || batchesRef.current.previewing) return false;
      if (epoch !== draftEpochRef.current) return false;
      let draft = draftRef.current;
      if (draft?.abandoned) return false;
      if (!draft) {
        draft = {
          abandoned: false,
          applied: [],
          steps: 0,
          pushes: 0,
          ids: { next: 0 },
          before: null,
          diff: null,
          session: null,
        };
        draftRef.current = draft;
        lastFollowRef.current = 0;
        current.onUnsavedAiChangesChange?.(true);
      }
      if (draft.pushes > 0 && userEdited()) {
        draft.abandoned = true;
        draft.pushes = 0;
        return false;
      }
      if (supportsDraftSession(current.kind)) return draftSessionStep(draft, ops, epoch);
      const plan =
        draft.before && draft.diff && draft.pushes > 0
          ? planDraftStep(draft.applied, ops, draft.steps)
          : ({ mode: "full" } as const);
      const submitted = [...ops];
      if (plan.mode === "suffix") {
        const base = currentDocument();
        if (!base || !draft.diff || !draft.before) return false;
        const rev = revRef.current;
        const result = await applyPartialOps(
          current.kind,
          base,
          submitted.slice(plan.from),
          draft.ids,
        ).catch(() => null);
        if (epoch !== draftEpochRef.current || revRef.current !== rev) return false;
        if (!result) return false;
        draft.applied = submitted;
        const { added, changed, removed } = result.diff;
        if (added.length === 0 && changed.length === 0 && removed.length === 0) return false;
        if (loadDocument(result.document)) draft.pushes += 1;
        draft.steps += 1;
        draft.diff = mergeDocDiffs(draft.diff, result.diff);
        store.set(
          buildPreviewOverlay(
            { aiOpBatchId: "draft", targetKind: current.kind, targetId: current.targetId },
            draft.before,
            draft.diff,
          ),
        );
        return true;
      }
      if (!restoreDraft()) return false;
      const before = currentDocument();
      if (!before) return false;
      const rev = revRef.current;
      const ids: DraftIds = { next: 0 };
      const result = await applyPartialOps(current.kind, before, submitted, ids).catch(() => null);
      if (epoch !== draftEpochRef.current || revRef.current !== rev) return false;
      if (!result) return false;
      draft.applied = submitted;
      draft.ids = ids;
      draft.steps = 0;
      draft.before = before;
      const { added, changed, removed } = result.diff;
      if (added.length === 0 && changed.length === 0 && removed.length === 0) return false;
      if (loadDocument(result.document)) draft.pushes += 1;
      draft.diff = result.diff;
      store.set(
        buildPreviewOverlay(
          { aiOpBatchId: "draft", targetKind: current.kind, targetId: current.targetId },
          before,
          result.diff,
        ),
      );
      return true;
    },
    [currentDocument, draftSessionStep, loadDocument, restoreDraft, store, userEdited],
  );

  const draftStepRef = useRef(draftStep);
  draftStepRef.current = draftStep;
  if (draftRunnerRef.current === null) {
    draftRunnerRef.current = new CoalescingRunner(({ ops, epoch }) =>
      mutexRef.current.run(() => draftStepRef.current(ops, epoch)),
    );
  }
  const draftRunner = draftRunnerRef.current;

  const draft = useCallback(
    (ops: readonly unknown[]): Promise<boolean> =>
      draftRunner.submit({ ops, epoch: draftEpochRef.current }),
    [draftRunner],
  );

  const clearForFresh = useCallback((): boolean => {
    const current = optionsRef.current;
    const document = currentDocument();
    const plugin = getOpKind(current.kind);
    if (!current.engine || !document || !plugin || batchesRef.current.previewing) return false;
    const empty = plugin.clearContent(document) as ErdDocumentJSON | FlowJSON;
    current.onUnsavedAiChangesChange?.(true);
    loadDocument(empty);
    markersRef.current.set(FRESH_KEY, revRef.current);
    return true;
  }, [currentDocument, loadDocument]);

  const restoreFresh = useCallback(() => {
    const marker = markersRef.current.get(FRESH_KEY);
    if (marker === undefined) return;
    markersRef.current.delete(FRESH_KEY);
    if (marker === revRef.current) undoEngine(1);
    if (batchesRef.current.applied.length === 0) {
      optionsRef.current.onUnsavedAiChangesChange?.(false);
    }
  }, [undoEngine]);

  const commitPreview = useCallback(
    async (
      batch: AiOpBatch,
      before: ErdDocumentJSON | FlowJSON,
      result: Extract<BatchApplication<ErdDocumentJSON | FlowJSON>, { ok: true }>,
      load: () => void,
    ): Promise<AiBatchPreviewOutcome> => {
      const current = optionsRef.current;
      setBatchState(withPreview(batchesRef.current, batch.aiOpBatchId));
      current.onUnsavedAiChangesChange?.(true);
      load();
      markersRef.current.set(batch.aiOpBatchId, revRef.current);
      store.set(buildPreviewOverlay(batch, before, result.diff));
      stopWatching();
      if (current.engine) {
        stopWatchRef.current = (current.engine as unknown as ChangeSource).on("change", () => {
          if (revRef.current === knownRevRef.current) return;
          if (batchesRef.current.previewing === batch.aiOpBatchId) accept();
        });
      }
      const known = statusRef.current.get(batch.aiOpBatchId) ?? batch.status;
      let syncWarning: string | undefined;
      if (known !== "applied") {
        const sent = await patch(batch.aiOpBatchId, { status: "applied" });
        if (sent === "retry") syncWarning = NOT_SYNCED;
        else if (sent === "conflict") syncWarning = "This AI change was already updated elsewhere.";
      }
      return {
        ok: true,
        diff: result.diff,
        warnings: result.warnings,
        skipped: result.skipped,
        ...(syncWarning ? { syncWarning } : {}),
      };
    },
    [accept, patch, setBatchState, stopWatching, store],
  );

  const previewInner = useCallback(
    async (batch: AiOpBatch, exclude?: ReadonlySet<number>): Promise<AiBatchPreviewOutcome> => {
      endDraft();
      const current = optionsRef.current;
      if (batch.targetKind !== current.kind || batch.targetId !== current.targetId) {
        return { ok: false, status: "invalid", detail: "This batch is for a different document" };
      }
      if (!current.engine) {
        return { ok: false, status: "invalid", detail: "The editor is not ready" };
      }
      if (batchesRef.current.previewing) accept();
      const before = currentDocument();
      if (!before) return { ok: false, status: "invalid", detail: "The editor is not ready" };
      const rev = revRef.current;
      let result: Awaited<ReturnType<typeof applyBatchToDocument>>;
      try {
        result = await applyBatchToDocument(
          exclude ? filterBatchOps(batch, exclude) : batch,
          before,
        );
      } catch {
        return {
          ok: false,
          status: "invalid",
          detail: "Could not load the editing tools. Check your connection and try again.",
        };
      }
      if (revRef.current !== rev) {
        return {
          ok: false,
          status: "invalid",
          detail: "The document changed while preparing the preview. Try again.",
        };
      }
      if (!result.ok) {
        const known = statusRef.current.get(batch.aiOpBatchId) ?? batch.status;
        if (known !== "conflict") {
          await patch(batch.aiOpBatchId, { status: "conflict", statusDetail: result.detail });
        }
        return { ok: false, status: "conflict", detail: result.detail };
      }
      const { added, changed, removed } = result.diff;
      if (added.length === 0 && changed.length === 0 && removed.length === 0) {
        return { ok: false, status: "invalid", detail: "This proposal makes no changes" };
      }
      return commitPreview(batch, before, result, () => loadDocument(result.document));
    },
    [accept, commitPreview, currentDocument, endDraft, loadDocument, patch],
  );

  const promoteInner = useCallback(
    async (
      batch: AiOpBatch,
      exclude?: ReadonlySet<number>,
    ): Promise<AiBatchPreviewOutcome | null> => {
      const current = optionsRef.current;
      const draft = draftRef.current;
      const session = draft?.session;
      if (!draft || !session || draft.abandoned || draft.pushes === 0) return null;
      if (exclude && exclude.size > 0) return null;
      if (batch.targetKind !== current.kind || batch.targetId !== current.targetId) return null;
      if (!current.engine || batchesRef.current.previewing || userEdited()) return null;
      draftEpochRef.current += 1;
      draftRunnerRef.current?.clear();
      const rev = revRef.current;
      const result = await promoteDraftSession(session, batch.ops).catch(() => null);
      if (!result?.ok || revRef.current !== rev || draftRef.current !== draft) return null;
      const { added, changed, removed } = result.diff;
      if (added.length === 0 && changed.length === 0 && removed.length === 0) return null;
      draftRef.current = null;
      return commitPreview(batch, session.before, result, () =>
        replaceDraftDocument(result.document, false),
      );
    },
    [commitPreview, replaceDraftDocument, userEdited],
  );

  const revertInner = useCallback(
    (silent: boolean): string | null => {
      const { previewing } = batchesRef.current;
      if (!previewing) return null;
      descriptionRef.current = null;
      nameBaselineRef.current = null;
      stopWatching();
      undoEngine(1);
      clearOverlay();
      markersRef.current.delete(previewing);
      const next = withRejected(batchesRef.current, previewing);
      setBatchState(next);
      if (!silent) {
        restoreFresh();
        if (next.applied.length === 0) optionsRef.current.onUnsavedAiChangesChange?.(false);
      }
      return previewing;
    },
    [clearOverlay, restoreFresh, setBatchState, stopWatching, undoEngine],
  );

  const preview = useCallback(
    (batch: AiOpBatch, opts?: AiPreviewOptions) =>
      mutexRef.current.run(() => previewInner(batch, opts?.exclude)),
    [previewInner],
  );

  const promoteDraft = useCallback(
    (batch: AiOpBatch, opts?: AiPreviewOptions) =>
      mutexRef.current.run(
        async () =>
          (await promoteInner(batch, opts?.exclude)) ?? previewInner(batch, opts?.exclude),
      ),
    [previewInner, promoteInner],
  );

  const repreview = useCallback(
    (batch: AiOpBatch, opts?: AiPreviewOptions) =>
      mutexRef.current.run(async () => {
        if (batchesRef.current.previewing === batch.aiOpBatchId) revertInner(true);
        return previewInner(batch, opts?.exclude);
      }),
    [previewInner, revertInner],
  );

  const reject = useCallback(
    () =>
      mutexRef.current.run(async () => {
        const previewing = revertInner(false);
        if (previewing) await patch(previewing, { status: "rejected" });
      }),
    [patch, revertInner],
  );

  const replacePreview = useCallback(
    (batch: AiOpBatch, opts?: AiPreviewOptions) =>
      mutexRef.current.run(async () => {
        const previous = revertInner(false);
        if (previous) void patch(previous, { status: "rejected" });
        const outcome = await previewInner(batch, opts?.exclude);
        return { previous, outcome };
      }),
    [patch, previewInner, revertInner],
  );

  const undoAccepted = useCallback(
    (aiOpBatchId: string) =>
      mutexRef.current.run(async () => {
        const { previewing, applied } = batchesRef.current;
        if (previewing !== null || applied[applied.length - 1] !== aiOpBatchId) return false;
        if (markersRef.current.get(aiOpBatchId) !== revRef.current) return false;
        undoEngine(1);
        markersRef.current.delete(aiOpBatchId);
        const next = withRejected(batchesRef.current, aiOpBatchId);
        setBatchState(next);
        if (next.applied.length === 0) optionsRef.current.onUnsavedAiChangesChange?.(false);
        await patch(aiOpBatchId, { status: "rejected" });
        return true;
      }),
    [patch, setBatchState, undoEngine],
  );

  const trackSnapshot = useCallback(async (work: Promise<void>) => {
    snapshotsRef.current += 1;
    try {
      await work;
    } finally {
      snapshotsRef.current -= 1;
    }
  }, []);

  const finish = useCallback(
    async (input: UpdateAiOpBatchRequest) => {
      const { applied } = batchesRef.current;
      const ids = [...applied];
      if (batchesRef.current.previewing && !ids.includes(batchesRef.current.previewing)) {
        ids.push(batchesRef.current.previewing);
      }
      if (input.status === "saved") setSavedIds((current) => [...current, ...ids]);
      if (input.status === "discarded") setDiscardedIds((current) => [...current, ...ids]);
      clearOverlay();
      markersRef.current.clear();
      setBatchState(NO_APPLIED_BATCHES);
      optionsRef.current.onUnsavedAiChangesChange?.(false);
      await Promise.all(applied.map((id) => patch(id, input)));
    },
    [clearOverlay, patch, setBatchState],
  );

  const markSaved = useCallback(
    (revision: number) => finish({ status: "saved", savedRevision: revision }),
    [finish],
  );

  const discard = useCallback(async () => {
    nameBaselineRef.current = null;
    const pending = finish({ status: "discarded" });
    optionsRef.current.documentState.reload();
    await pending;
  }, [finish]);

  const { savedCount, revision } = options.documentState;
  const savedCountRef = useRef(savedCount);
  useEffect(() => {
    if (savedCount === savedCountRef.current) return;
    savedCountRef.current = savedCount;
    if (snapshotsRef.current > 0) return;
    if (batchesRef.current.applied.length > 0 && revision !== null) {
      void markSaved(revision);
    }
  }, [markSaved, revision, savedCount]);

  const { loadKey } = options.documentState;
  const loadKeyRef = useRef(loadKey);
  useEffect(() => {
    if (loadKey === loadKeyRef.current) return;
    loadKeyRef.current = loadKey;
    if (batchesRef.current.applied.length === 0) return;
    clearOverlay();
    markersRef.current.clear();
    setBatchState(NO_APPLIED_BATCHES);
    optionsRef.current.onUnsavedAiChangesChange?.(false);
  }, [clearOverlay, loadKey, setBatchState]);

  useEffect(
    () => () => {
      stopWatchRef.current?.();
      stopWatchRef.current = null;
      draftEpochRef.current += 1;
      draftRunnerRef.current?.clear();
      draftRef.current = null;
      markersRef.current.clear();
      if (targetId) store.clear(kind, targetId);
      if (batchesRef.current.applied.length > 0) {
        optionsRef.current.onUnsavedAiChangesChange?.(false);
      }
      batchesRef.current = NO_APPLIED_BATCHES;
      setBatches(NO_APPLIED_BATCHES);
    },
    [engine, kind, store, targetId],
  );

  return {
    previewingBatchId: batches.previewing,
    appliedBatchIds: batches.applied,
    savedBatchIds: savedIds,
    discardedBatchIds: discardedIds,
    hasUnsavedAiChanges: batches.applied.length > 0,
    error,
    syncPending: sync.retrying,
    syncError: sync.retrying ? (syncError ?? NOT_SYNCED) : null,
    preview,
    repreview,
    replacePreview,
    draft,
    endDraft,
    promoteDraft,
    followDraft,
    draftBase,
    locked,
    setLocked,
    fit,
    clearForFresh,
    restoreFresh,
    trackSnapshot,
    accept,
    reject,
    undoAccepted,
    markSaved,
    discard,
  };
}
