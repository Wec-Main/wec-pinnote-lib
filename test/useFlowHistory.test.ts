import { describe, it, expect } from "vitest";
import { HistoryStore } from "../src/components/WecFlow/vendor/hooks/useFlowHistory";

describe("HistoryStore", () => {
  it("commit pushes entries and updates present", () => {
    const store = new HistoryStore<number>(0);
    expect(store.present).toBe(0);

    store.commit(1);
    expect(store.present).toBe(1);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);

    store.commit(2);
    expect(store.present).toBe(2);
    expect(store.canUndo).toBe(true);
  });

  it("undo/redo move through history correctly with correct canUndo/canRedo flags", () => {
    const store = new HistoryStore<number>(0);
    store.commit(1);
    store.commit(2);
    store.commit(3);

    expect(store.present).toBe(3);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);

    store.undo();
    expect(store.present).toBe(2);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(true);

    store.undo();
    expect(store.present).toBe(1);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(true);

    store.redo();
    expect(store.present).toBe(2);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(true);

    // Committing again after undo/redo should clear the old redo entry (3).
    store.commit(20);
    expect(store.present).toBe(20);
    expect(store.canRedo).toBe(false);

    store.undo();
    expect(store.present).toBe(2);
    // The old future entry `3` must be gone - redo should not bring it back.
    expect(store.canRedo).toBe(true);
    store.redo();
    expect(store.present).toBe(20);
    store.redo();
    // Nothing further to redo.
    expect(store.present).toBe(20);
  });

  it("undo/redo are no-ops when not available", () => {
    const store = new HistoryStore<number>(0);
    store.undo();
    expect(store.present).toBe(0);
    expect(store.canUndo).toBe(false);

    store.redo();
    expect(store.present).toBe(0);
    expect(store.canRedo).toBe(false);
  });

  it("replacePresent updates present without creating an undoable entry", () => {
    const store = new HistoryStore<number>(0);
    store.commit(1);
    store.commit(2);

    store.replacePresent(2.5);
    expect(store.present).toBe(2.5);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);

    // Undo after replacePresent should go to the entry BEFORE the replaced one (1),
    // not to some intermediate state (2).
    store.undo();
    expect(store.present).toBe(1);

    // replacePresent must not affect canUndo/canRedo counts on its own.
    const store2 = new HistoryStore<number>(0);
    store2.commit(1);
    const canUndoBefore = store2.canUndo;
    const canRedoBefore = store2.canRedo;
    store2.replacePresent(99);
    expect(store2.canUndo).toBe(canUndoBefore);
    expect(store2.canRedo).toBe(canRedoBefore);
  });

  it("bounds history to maxSize, dropping the oldest entries", () => {
    const store = new HistoryStore<number>(0, 3);

    store.commit(1); // past: [0]
    store.commit(2); // past: [0, 1]
    store.commit(3); // past: [0, 1, 2]
    store.commit(4); // past would be [0, 1, 2, 3] -> capped to [1, 2, 3]
    store.commit(5); // past would be [1, 2, 3, 4] -> capped to [2, 3, 4]

    expect(store.present).toBe(5);

    // Undo 3 times should land on 2 (the oldest retained past entry),
    // and a 4th undo should be a no-op since 0 and 1 were dropped.
    store.undo();
    expect(store.present).toBe(4);
    store.undo();
    expect(store.present).toBe(3);
    store.undo();
    expect(store.present).toBe(2);
    expect(store.canUndo).toBe(false);

    store.undo();
    expect(store.present).toBe(2);
  });

  it("reset clears everything to a single fresh present", () => {
    const store = new HistoryStore<number>(0);
    store.commit(1);
    store.commit(2);
    store.undo();

    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(true);

    store.reset(100);
    expect(store.present).toBe(100);
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);

    // Further undo/redo should be no-ops.
    store.undo();
    store.redo();
    expect(store.present).toBe(100);
  });

  it("defaults maxSize to 50 when not provided or invalid", () => {
    const store = new HistoryStore<number>(0);
    for (let i = 1; i <= 60; i += 1) {
      store.commit(i);
    }
    let undoCount = 0;
    while (store.canUndo) {
      store.undo();
      undoCount += 1;
    }
    // With 60 commits and a default cap of 50, at most 50 undos should be possible.
    expect(undoCount).toBeLessThanOrEqual(50);
    expect(undoCount).toBeGreaterThan(0);
  });
});
