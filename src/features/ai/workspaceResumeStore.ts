import type { WorkspaceResumeEntry } from "./ops/workspaceOps";

const PREFIX = "wpn-ai-ws-apply:";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadWorkspaceResume(
  batchId: string,
  storage: StorageLike | null = defaultStorage(),
): Map<number, WorkspaceResumeEntry> {
  const map = new Map<number, WorkspaceResumeEntry>();
  try {
    const raw = storage?.getItem(PREFIX + batchId);
    if (!raw) return map;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return map;
    for (const [key, value] of Object.entries(parsed)) {
      const entry = value as Partial<WorkspaceResumeEntry> | null;
      const index = Number(key);
      if (Number.isInteger(index) && entry && typeof entry.id === "string") {
        map.set(index, { id: entry.id, complete: entry.complete === true });
      }
    }
  } catch {
    return map;
  }
  return map;
}

export function saveWorkspaceResume(
  batchId: string,
  entries: ReadonlyMap<number, WorkspaceResumeEntry>,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(PREFIX + batchId, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return;
  }
}

export function clearWorkspaceResume(
  batchId: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.removeItem(PREFIX + batchId);
  } catch {
    return;
  }
}
