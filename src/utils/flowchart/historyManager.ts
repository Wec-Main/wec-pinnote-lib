/**
 * Snapshot based undo/redo stack. Snapshots are expected to be immutable, so
 * storing one is just storing references (cheap even for large flows).
 */
export class HistoryManager<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 100) {}

  /** Records the state *before* a change. Clears the redo stack. */
  push(snapshot: T): void {
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** Returns the state to restore, or undefined when there is nothing to undo. */
  undo(current: T): T | undefined {
    const prev = this.past.pop();
    if (prev === undefined) return undefined;
    this.future.push(current);
    return prev;
  }

  redo(current: T): T | undefined {
    const next = this.future.pop();
    if (next === undefined) return undefined;
    this.past.push(current);
    return next;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }
}
