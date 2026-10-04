import { computeBackoffDelay, withJitter } from "../../utils/backoff";

export type PatchSendResult = "ok" | "conflict" | "retry" | "drop";

export interface PatchQueueState {
  pending: number;
  retrying: boolean;
}

export interface PatchQueueOptions<J> {
  send: (id: string, job: J) => Promise<PatchSendResult>;
  onSettled?: (id: string, result: "ok" | "conflict" | "drop") => void;
  onChange?: (state: PatchQueueState) => void;
  schedule?: (run: () => void, delayMs: number) => () => void;
  maxAttempts?: number;
  baseMs?: number;
  maxMs?: number;
  random?: () => number;
}

interface Entry<J> {
  job: J;
  attempts: number;
}

const defaultSchedule = (run: () => void, delayMs: number): (() => void) => {
  const timer = setTimeout(run, delayMs);
  return () => clearTimeout(timer);
};

export function nextBackoffMs(attempts: number, baseMs: number, maxMs: number): number {
  return computeBackoffDelay(Math.max(0, attempts - 1), { baseMs, maxMs });
}

export class PatchQueue<J> {
  private readonly entries = new Map<string, Entry<J>>();
  private cancelTimer: (() => void) | null = null;
  private running = false;
  private rerun = false;
  private disposed = false;
  private readonly options: PatchQueueOptions<J>;

  constructor(options: PatchQueueOptions<J>) {
    this.options = options;
  }

  get pending(): number {
    return this.entries.size;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  enqueue(id: string, job: J): void {
    this.entries.set(id, { job, attempts: 0 });
    this.emit();
    void this.flush();
  }

  defer(id: string, job: J): void {
    this.entries.set(id, { job, attempts: 1 });
    this.emit();
    if (!this.running && this.cancelTimer === null) this.armTimer();
  }

  async sendNow(id: string, job: J): Promise<PatchSendResult> {
    let result: PatchSendResult;
    try {
      result = await this.options.send(id, job);
    } catch {
      result = "retry";
    }
    if (result === "retry") this.defer(id, job);
    else this.cancel(id);
    return result;
  }

  cancel(id: string): void {
    if (this.entries.delete(id)) this.emit();
  }

  resume(): void {
    this.disposed = false;
    if (this.entries.size > 0 && this.cancelTimer === null && !this.running) this.armTimer();
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  async flush(): Promise<void> {
    if (this.disposed) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.running = true;
    try {
      do {
        this.rerun = false;
        await this.pass();
      } while (this.rerun && !this.disposed);
    } finally {
      this.running = false;
    }
    this.armTimer();
    this.emit();
  }

  private async pass(): Promise<void> {
    for (const [id, entry] of [...this.entries]) {
      if (this.disposed) return;
      let result: PatchSendResult;
      try {
        result = await this.options.send(id, entry.job);
      } catch {
        result = "retry";
      }
      const live = this.entries.get(id);
      if (result === "retry") {
        if (live === entry) {
          entry.attempts += 1;
          if (entry.attempts > (this.options.maxAttempts ?? 12)) {
            this.entries.delete(id);
            this.options.onSettled?.(id, "drop");
          }
          this.emit();
        }
        continue;
      }
      if (live === entry) this.entries.delete(id);
      this.options.onSettled?.(id, result);
      this.emit();
    }
  }

  private armTimer(): void {
    if (this.disposed || this.entries.size === 0) return;
    let attempts = 1;
    for (const entry of this.entries.values()) attempts = Math.max(attempts, entry.attempts);
    const delay = withJitter(
      nextBackoffMs(attempts, this.options.baseMs ?? 1000, this.options.maxMs ?? 30000),
      this.options.random,
    );
    const schedule = this.options.schedule ?? defaultSchedule;
    this.cancelTimer = schedule(() => {
      this.cancelTimer = null;
      void this.flush();
    }, delay);
  }

  private emit(): void {
    let retrying = false;
    for (const entry of this.entries.values()) if (entry.attempts > 0) retrying = true;
    this.options.onChange?.({ pending: this.entries.size, retrying });
  }
}
