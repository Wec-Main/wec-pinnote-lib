import { getOpKind } from "../ops/registry";
import type { AiQuestion } from "../../../types/ai.types";
import { toQuestions } from "./aiQuestions";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type {
  AiActionResult,
  AiActionKey,
  AiEditorTargetKind,
  AiOpBatch,
  AiOpBatchTargetKind,
  AiReviewFinding,
} from "../../../types/ai.types";

export type DockChipId = "ask" | "generate" | "edit" | "review" | "explain_doc" | "explain";

export interface DockChip {
  id: DockChipId;
  label: string;
  needsPrompt: boolean;
  needsSelection: boolean;
}

export function dockChips(kind: AiEditorTargetKind): readonly DockChip[] {
  return getOpKind(kind)?.dockChips ?? [];
}

export interface DockDocumentState {
  empty: boolean;
  selectionCount: number;
}

export interface DockActionChoice {
  actionKey: AiActionKey;
  useSelection: boolean;
}

export function chooseDockAction(
  kind: AiOpBatchTargetKind,
  doc: DockDocumentState,
  chip: DockChipId | null = null,
): DockActionChoice {
  const prefix = kind === "data_model" ? "erd" : "flow";
  const hasSelection = doc.selectionCount > 0;
  switch (chip) {
    case "ask":
      return { actionKey: `${prefix}.ask` as AiActionKey, useSelection: hasSelection };
    case "generate":
      return { actionKey: `${prefix}.generate` as AiActionKey, useSelection: false };
    case "edit":
      return doc.empty
        ? { actionKey: `${prefix}.generate` as AiActionKey, useSelection: false }
        : { actionKey: `${prefix}.edit` as AiActionKey, useSelection: hasSelection };
    case "review":
      return kind === "data_model"
        ? { actionKey: "erd.review", useSelection: hasSelection }
        : { actionKey: "flow.explain", useSelection: false };
    case "explain_doc":
      return { actionKey: `${prefix}.explain` as AiActionKey, useSelection: false };
    case "explain":
      return { actionKey: `${prefix}.explain` as AiActionKey, useSelection: hasSelection };
    default:
      break;
  }
  return { actionKey: `${prefix}.ask` as AiActionKey, useSelection: hasSelection };
}

export const ACTION_LABELS: Partial<Record<AiActionKey, string>> = {
  "erd.ask": "Ask",
  "erd.generate": "Create",
  "erd.edit": "Improve",
  "erd.review": "Review",
  "erd.explain": "Explain",
  "flow.ask": "Ask",
  "flow.generate": "Create",
  "flow.edit": "Improve",
  "flow.explain": "Explain",
  "workspace.ask": "Ask",
  "workspace.assist": "Create",
  "workspace.explain": "Explain",
};

export const HISTORY_LIMIT = 20;

export const historyKey = (kind: AiOpBatchTargetKind, targetId: string) =>
  `wpn-ai:dock-history:${kind}:${targetId}`;

export function loadPromptHistory(kind: AiOpBatchTargetKind, targetId: string): string[] {
  try {
    const raw = window.localStorage.getItem(historyKey(kind, targetId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function pushPromptHistory(
  kind: AiOpBatchTargetKind,
  targetId: string,
  prompt: string,
): string[] {
  const trimmed = prompt.trim();
  const next = [trimmed, ...loadPromptHistory(kind, targetId).filter((item) => item !== trimmed)]
    .filter(Boolean)
    .slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(historyKey(kind, targetId), JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export const INTERACTION_GRACE_MS = 1500;

export function useCanvasInteraction(
  dockRef: RefObject<HTMLElement | null>,
  graceMs: number = INTERACTION_GRACE_MS,
): () => boolean {
  const pointerDown = useRef(false);
  const lastActivity = useRef(0);

  useEffect(() => {
    const dock = dockRef.current;
    const scope = dock?.closest(".wpn-flow-stage, .wpn-flowchart-editor") ?? dock?.parentElement;
    if (!scope) return undefined;
    const onCanvas = (target: EventTarget | null) =>
      target instanceof Node && scope.contains(target) && !(dock && dock.contains(target));
    const down = (event: Event) => {
      if (!onCanvas(event.target)) return;
      pointerDown.current = true;
      lastActivity.current = Date.now();
    };
    const up = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      lastActivity.current = Date.now();
    };
    const key = (event: Event) => {
      if (onCanvas(event.target)) lastActivity.current = Date.now();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("keydown", key, true);
    };
  }, [dockRef]);

  return useCallback(
    () => pointerDown.current || Date.now() - lastActivity.current < graceMs,
    [graceMs],
  );
}

export function resultOpBatch(result: AiActionResult | null | undefined): AiOpBatch | null {
  return result?.kind === "op_batch" ? result.batch : null;
}

function resultValue(result: AiActionResult | null | undefined): Record<string, unknown> | null {
  if (!result || (result.kind !== "op_batch" && result.kind !== "json")) return null;
  return result.value && typeof result.value === "object" ? result.value : null;
}

function findingText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function toReviewFinding(item: unknown): AiReviewFinding | null {
  if (typeof item === "string") return item.trim() ? { message: item } : null;
  if (!item || typeof item !== "object") return null;
  const raw = item as Record<string, unknown>;
  const finding: AiReviewFinding = {};
  const severity = findingText(raw.severity);
  const title = findingText(raw.title);
  const target = findingText(raw.where) ?? findingText(raw.target);
  const message = findingText(raw.issue) ?? findingText(raw.message);
  const fix = findingText(raw.fix);
  if (severity) finding.severity = severity;
  if (title) finding.title = title;
  if (target) finding.target = target;
  if (message) finding.message = message;
  if (fix) finding.fix = fix;
  return Object.keys(finding).length > 0 ? finding : null;
}

export function resultFindings(result: AiActionResult | null | undefined): AiReviewFinding[] {
  const raw = resultValue(result)?.findings;
  if (!Array.isArray(raw)) return [];
  return raw.map(toReviewFinding).filter((item): item is AiReviewFinding => item !== null);
}

export interface DockResultNote {
  title: string | null;
  rationale: string | null;
  questions: AiQuestion[];
}

export function resultNote(result: AiActionResult | null | undefined): DockResultNote | null {
  if (result?.kind !== "json") return null;
  const value = resultValue(result);
  if (!value) return null;
  const title = findingText(value.title) ?? null;
  const rationale = findingText(value.rationale) ?? null;
  const questions = toQuestions(value.questions);
  if (!title && !rationale && questions.length === 0) return null;
  return { title, rationale, questions };
}

const quoted = (value: unknown) =>
  typeof value === "string" && value.trim() ? `"${value.trim()}"` : "";

const refText = (value: unknown) => {
  if (typeof value !== "string") return "";
  const text = value.trim();
  return text.startsWith("$") ? text.slice(1).replace(/[_-]+/g, " ") : text;
};

export function describeLiveOp(op: unknown): string | null {
  if (typeof op !== "object" || op === null) return null;
  const record = op as Record<string, unknown>;
  const name = typeof record.op === "string" ? record.op : "";
  switch (name) {
    case "addNode":
      return `Adding step ${quoted(record.label)}`.trim();
    case "insertNodeOnEdge":
      return `Inserting step ${quoted(record.label)}`.trim();
    case "addEdge":
      return `Connecting ${refText(record.source)} → ${refText(record.target)}`;
    case "updateNode":
    case "updateEdge":
      return "Updating the flow";
    case "removeNode":
    case "removeEdge":
      return "Removing from the flow";
    case "addEntity":
      return `Adding table ${quoted(record.name)}`.trim();
    case "addField":
      return `Adding field ${quoted(record.name)}`.trim();
    case "addRelationship":
      return `Linking ${refText(record.source)} → ${refText(record.target)}`;
    case "addEnum":
      return `Adding enum ${quoted(record.name)}`.trim();
    case "addIndex":
      return "Adding an index";
    case "addNote":
      return "Adding a note";
    case "autoLayout":
      return "Arranging the layout";
    default:
      if (name.startsWith("update") || name.startsWith("rename")) return "Updating the model";
      if (name.startsWith("remove")) return "Removing from the model";
      return null;
  }
}
