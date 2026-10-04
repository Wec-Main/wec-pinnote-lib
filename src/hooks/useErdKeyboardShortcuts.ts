import { useCallback } from "react";
import type { XYPosition } from "../types/flowchart.types";
import { useErdEngine } from "../features/erd/ErdContext";

const ARROW_STEP = 1;
const ARROW_STEP_FAST = 10;

const ARROW_DIRECTIONS: Record<string, XYPosition> = {
  arrowup: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
};

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export interface ErdKeyboardShortcutOptions {
  onAskAi?: () => void;
}

export function useErdKeyboardShortcuts(options: ErdKeyboardShortcutOptions = {}) {
  const engine = useErdEngine();
  const { onAskAi } = options;

  return useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const state = engine.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "i" && onAskAi) {
        e.preventDefault();
        return onAskAi();
      }
      if (key === "escape") {
        if (state.connection) engine.cancelConnection();
        else engine.clearSelection();
        return;
      }
      if (key === "+" || key === "=") return engine.zoomIn();
      if (key === "-") return engine.zoomOut();
      if (!mod && key === "f") return engine.fitView();
      if (mod && key === "a") {
        e.preventDefault();
        return engine.selectAll();
      }
      if (state.readOnly) return;

      if (key === "delete" || key === "backspace") {
        e.preventDefault();
        return engine.deleteSelection();
      }
      if (mod && key === "z") {
        e.preventDefault();
        return e.shiftKey ? engine.redo() : engine.undo();
      }
      if (mod && key === "y") {
        e.preventDefault();
        return engine.redo();
      }
      if (mod && key === "d") {
        e.preventDefault();
        engine.duplicateEntities([...state.selection.entityIds]);
        return;
      }
      const direction = ARROW_DIRECTIONS[key];
      const { entityIds, noteIds } = state.selection;
      if (!direction || entityIds.size + noteIds.size === 0) return;
      e.preventDefault();
      const step = e.shiftKey ? ARROW_STEP_FAST : ARROW_STEP;
      const positions: Record<string, XYPosition> = {};
      const moveFrom = (id: string, position: XYPosition) => {
        positions[id] = { x: position.x + direction.x * step, y: position.y + direction.y * step };
      };
      for (const id of entityIds) {
        const entity = state.entityLookup.get(id);
        if (entity) moveFrom(id, entity.position);
      }
      for (const id of noteIds) {
        const note = state.noteLookup.get(id);
        if (note) moveFrom(id, note.position);
      }
      engine.setNodePositions(positions);
    },
    [engine, onAskAi],
  );
}
