import { useCallback } from 'react';
import type { XYPosition } from '../models/FlowTypes';
import { useFlowEngine } from './FlowContext';

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

/**
 * Keyboard handler for an editor root element (attach to `onKeyDown`).
 * Ignores events coming from form fields.
 */
export function useKeyboardShortcuts() {
  const engine = useFlowEngine();

  return useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditable(e.target)) return;
      const s = engine.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (key === 'escape') {
        if (s.connection) engine.cancelConnection();
        else engine.clearSelection();
        return;
      }
      if (key === '+' || key === '=') return engine.zoomIn();
      if (key === '-') return engine.zoomOut();
      if (!mod && key === 'f') return engine.fitView();
      if (!mod && key === '1') return engine.zoomTo(1);
      if (mod && key === 'c') {
        if (engine.copySelection()) e.preventDefault();
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        return engine.selectAll();
      }
      if (s.readOnly) return;

      if (key === 'delete' || key === 'backspace') {
        e.preventDefault();
        return engine.deleteSelection();
      }
      if (mod && key === 'z') {
        e.preventDefault();
        return e.shiftKey ? engine.redo() : engine.undo();
      }
      if (mod && key === 'y') {
        e.preventDefault();
        return engine.redo();
      }
      if (mod && key === 'x') {
        if (engine.cutSelection()) e.preventDefault();
        return;
      }
      if (mod && key === 'v') {
        e.preventDefault();
        engine.paste();
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        return engine.duplicateNodes([...s.selectedNodeIds]);
      }
      const arrows: Record<string, XYPosition> = {
        arrowup: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
      };
      if (arrows[key] && s.selectedNodeIds.size) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const positions: Record<string, XYPosition> = {};
        for (const id of s.selectedNodeIds) {
          const n = s.nodeLookup.get(id);
          if (n) positions[id] = { x: n.position.x + arrows[key].x * step, y: n.position.y + arrows[key].y * step };
        }
        engine.setNodePositions(positions);
      }
    },
    [engine],
  );
}
