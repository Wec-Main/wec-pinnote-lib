import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalAiRuntime } from "../context/AiRuntimeContext";
import type { RevisionedDocumentState } from "../hooks/useRevisionedDocument";
import { useTokenGetter } from "../hooks/useTokenGetter";
import { updateAiOpBatch } from "../services/aiApi";
import type { AiOpBatch, UpdateAiOpBatchRequest } from "../types/ai.types";
import type { ErdDocumentJSON } from "../types/dataModel.types";
import type { FlowJSON } from "../types/flowchart.types";
import type { ErdEngine } from "../utils/erd/erdEngine";
import type { FlowEngine } from "../utils/flowchart/flowEngine";
import { aiPreviewStore, type AiPreviewStore } from "./aiPreviewStore";
import {
  NO_APPLIED_BATCHES,
  applyBatchToDocument,
  applyPartialOps,
  buildPreviewOverlay,
  withAccepted,
  withPreview,
  withRejected,
  type AppliedBatches,
} from "./opBatchApplier";
import type { DocDiff } from "./ops/types";

interface ApplierBase {
  targetId: string | null;
  apiBaseUrl?: string;
  getAuthToken?: () => string | Promise<string>;
  onUnsavedAiChangesChange?: (hasUnsavedAiChanges: boolean) => void;
  onModelDescription?: (description: string) => void;
  onModelName?: (name: string) => void;
  previewStore?: AiPreviewStore;
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
  | { ok: true; diff: DocDiff; warnings: string[]; skipped: string[] }
  | { ok: false; status: "conflict" | "invalid"; detail: string };

export interface AiOpBatchApplier {
  previewingBatchId: string | null;
  appliedBatchIds: readonly string[];
  savedBatchIds: readonly string[];
  discardedBatchIds: readonly string[];
  hasUnsavedAiChanges: boolean;
  error: string | null;
  preview: (batch: AiOpBatch) => Promise<AiBatchPreviewOutcome>;
  draft: (ops: readonly unknown[]) => boolean;
  endDraft: () => void;
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

export function useAiOpBatchApplier(options: UseAiOpBatchApplierOptions): AiOpBatchApplier {
  const runtime = useOptionalAiRuntime();
  const fallbackToken = useTokenGetter(options.getAuthToken);
  const apiBaseUrl = options.apiBaseUrl ?? runtime?.apiBaseUrl ?? "";
  const getToken = options.getAuthToken || !runtime ? fallbackToken : runtime.getToken;
  const store = options.previewStore ?? aiPreviewStore;
  const [batches, setBatches] = useState<AppliedBatches>(NO_APPLIED_BATCHES);
  const [error, setError] = useState<string | null>(null);
  const batchesRef = useRef(batches);
  batchesRef.current = batches;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const statusRef = useRef(new Map<string, AiOpBatch["status"]>());
  const stopWatchRef = useRef<(() => void) | null>(null);
  const draftRef = useRef<{ drawn: string | null; abandoned: boolean } | null>(null);
  const freshRef = useRef<string | null>(null);
  const snapshotsRef = useRef(0);
  const [savedIds, setSavedIds] = useState<readonly string[]>([]);
  const [discardedIds, setDiscardedIds] = useState<readonly string[]>([]);
  const { kind, targetId, engine } = options;

  const setBatchState = useCallback((next: AppliedBatches) => {
    batchesRef.current = next;
    setBatches(next);
  }, []);

  const patch = useCallback(
    async (aiOpBatchId: string, input: UpdateAiOpBatchRequest) => {
      try {
        const authToken = await getToken();
        const updated = await updateAiOpBatch(apiBaseUrl, authToken, aiOpBatchId, input);
        statusRef.current.set(aiOpBatchId, updated.status);
        setError(null);
      } catch (err) {
        setError(describe(err));
      }
    },
    [apiBaseUrl, getToken],
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
    freshRef.current = null;
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

  useEffect(() => () => setLocked(false), [setLocked]);

  const loadDocument = useCallback((incoming: ErdDocumentJSON | FlowJSON) => {
    const current = optionsRef.current;
    const engine = current.engine;
    let document = incoming;
    if (current.kind === "data_model") {
      if (nameBaselineRef.current === null) {
        nameBaselineRef.current = current.engine?.getState().name.trim() ?? "";
      }
      const { description, ...meta } = (incoming as ErdDocumentJSON).meta ?? {};
      descriptionRef.current =
        typeof description === "string" && description.trim() ? description.trim() : null;
      document = { ...(incoming as ErdDocumentJSON), meta };
    }
    const relock = lockRef.current.locked;
    if (relock) engine?.setReadOnly(false);
    try {
      if (current.kind === "data_model") {
        current.engine?.applyDocument(document as ErdDocumentJSON, { recordHistory: true });
      } else {
        current.engine?.loadFlow(document as FlowJSON, { recordHistory: true });
      }
    } finally {
      if (relock) engine?.setReadOnly(true);
    }
  }, []);

  const serialize = useCallback(() => {
    const document = currentDocument();
    if (!document) return null;
    const { viewport: _viewport, ...content } = document;
    return JSON.stringify(content);
  }, [currentDocument]);

  const restoreDraft = useCallback((): boolean => {
    const draft = draftRef.current;
    if (!draft || draft.drawn === null) return true;
    if (serialize() !== draft.drawn) {
      draft.drawn = null;
      draft.abandoned = true;
      return false;
    }
    optionsRef.current.engine?.undo();
    draft.drawn = null;
    return true;
  }, [serialize]);

  const endDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return;
    restoreDraft();
    draftRef.current = null;
    if (batchesRef.current.previewing === null && targetId) store.clear(kind, targetId);
    if (batchesRef.current.applied.length === 0) {
      optionsRef.current.onUnsavedAiChangesChange?.(false);
    }
  }, [kind, restoreDraft, store, targetId]);

  const draft = useCallback(
    (ops: readonly unknown[]): boolean => {
      const current = optionsRef.current;
      if (!current.engine || !current.targetId || batchesRef.current.previewing) return false;
      if (draftRef.current?.abandoned) return false;
      if (!draftRef.current) {
        draftRef.current = { drawn: null, abandoned: false };
        current.onUnsavedAiChangesChange?.(true);
      }
      if (!restoreDraft()) return false;
      const before = currentDocument();
      if (!before) return false;
      const result = applyPartialOps(current.kind, before, ops);
      if (!result) return false;
      const { added, changed, removed } = result.diff;
      if (added.length === 0 && changed.length === 0 && removed.length === 0) return false;
      loadDocument(result.document);
      (draftRef.current as { drawn: string | null }).drawn = serialize();
      store.set(
        buildPreviewOverlay(
          { aiOpBatchId: "draft", targetKind: current.kind, targetId: current.targetId },
          before,
          result.diff,
        ),
      );
      return true;
    },
    [currentDocument, loadDocument, restoreDraft, serialize, store],
  );

  const clearForFresh = useCallback((): boolean => {
    const current = optionsRef.current;
    const document = currentDocument();
    if (!current.engine || !document || batchesRef.current.previewing) return false;
    const empty =
      current.kind === "data_model"
        ? {
            ...(document as ErdDocumentJSON),
            entities: [],
            relationships: [],
            enums: [],
            notes: [],
          }
        : { ...(document as FlowJSON), nodes: [], edges: [] };
    current.onUnsavedAiChangesChange?.(true);
    loadDocument(empty);
    freshRef.current = serialize();
    return true;
  }, [currentDocument, loadDocument, serialize]);

  const restoreFresh = useCallback(() => {
    const cleared = freshRef.current;
    if (cleared === null) return;
    freshRef.current = null;
    if (serialize() === cleared) optionsRef.current.engine?.undo();
    if (batchesRef.current.applied.length === 0) {
      optionsRef.current.onUnsavedAiChangesChange?.(false);
    }
  }, [serialize]);

  const preview = useCallback(
    async (batch: AiOpBatch): Promise<AiBatchPreviewOutcome> => {
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
      const result = applyBatchToDocument(batch, before);
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
      setBatchState(withPreview(batchesRef.current, batch.aiOpBatchId));
      current.onUnsavedAiChangesChange?.(true);
      loadDocument(result.document);
      store.set(buildPreviewOverlay(batch, before, result.diff));
      stopWatching();
      const watched = current.engine as {
        on: (event: "change", handler: () => void) => () => void;
      };
      stopWatchRef.current = watched.on("change", () => {
        if (batchesRef.current.previewing === batch.aiOpBatchId) accept();
      });
      const known = statusRef.current.get(batch.aiOpBatchId) ?? batch.status;
      if (known !== "applied") await patch(batch.aiOpBatchId, { status: "applied" });
      return { ok: true, diff: result.diff, warnings: result.warnings, skipped: result.skipped };
    },
    [accept, currentDocument, endDraft, loadDocument, patch, setBatchState, stopWatching, store],
  );

  const reject = useCallback(async () => {
    const { previewing } = batchesRef.current;
    if (!previewing) return;
    descriptionRef.current = null;
    nameBaselineRef.current = null;
    stopWatching();
    optionsRef.current.engine?.undo();
    clearOverlay();
    const next = withRejected(batchesRef.current, previewing);
    setBatchState(next);
    restoreFresh();
    if (next.applied.length === 0) optionsRef.current.onUnsavedAiChangesChange?.(false);
    await patch(previewing, { status: "rejected" });
  }, [clearOverlay, patch, restoreFresh, setBatchState, stopWatching]);

  const undoAccepted = useCallback(
    async (aiOpBatchId: string) => {
      const { previewing, applied } = batchesRef.current;
      if (previewing !== null || applied[applied.length - 1] !== aiOpBatchId) return false;
      optionsRef.current.engine?.undo();
      const next = withRejected(batchesRef.current, aiOpBatchId);
      setBatchState(next);
      if (next.applied.length === 0) optionsRef.current.onUnsavedAiChangesChange?.(false);
      await patch(aiOpBatchId, { status: "rejected" });
      return true;
    },
    [patch, setBatchState],
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
    setBatchState(NO_APPLIED_BATCHES);
    optionsRef.current.onUnsavedAiChangesChange?.(false);
  }, [clearOverlay, loadKey, setBatchState]);

  useEffect(
    () => () => {
      stopWatchRef.current?.();
      stopWatchRef.current = null;
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
    preview,
    draft,
    endDraft,
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
