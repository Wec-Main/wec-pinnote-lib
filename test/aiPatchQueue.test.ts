import { describe, expect, it, vi } from "vitest";
import { AsyncMutex } from "../src/ai/asyncMutex";
import { PatchQueue, nextBackoffMs, type PatchSendResult } from "../src/ai/patchQueue";

function harness(results: PatchSendResult[]) {
  const scheduled: { run: () => void; delay: number }[] = [];
  const sent: string[] = [];
  const settled: [string, string][] = [];
  const states: { pending: number; retrying: boolean }[] = [];
  const queue = new PatchQueue<string>({
    send: async (id, job) => {
      sent.push(`${id}:${job}`);
      return results.shift() ?? "ok";
    },
    onSettled: (id, result) => settled.push([id, result]),
    onChange: (state) => states.push(state),
    schedule: (run, delay) => {
      const entry = { run, delay };
      scheduled.push(entry);
      return () => {
        const index = scheduled.indexOf(entry);
        if (index >= 0) scheduled.splice(index, 1);
      };
    },
    baseMs: 1000,
    maxMs: 8000,
    random: () => 1,
  });
  return { queue, scheduled, sent, settled, states };
}

describe("nextBackoffMs", () => {
  it("doubles and caps", () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => nextBackoffMs(n, 1000, 8000))).toEqual([
      1000, 2000, 4000, 8000, 8000, 8000,
    ]);
  });
});

describe("PatchQueue", () => {
  it("gives up after the attempt cap and reports a drop", async () => {
    const results: PatchSendResult[] = Array.from({ length: 10 }, () => "retry");
    const settled: [string, string][] = [];
    const scheduled: (() => void)[] = [];
    const queue = new PatchQueue<string>({
      send: async () => results.shift() ?? "retry",
      onSettled: (id, result) => settled.push([id, result]),
      schedule: (run) => {
        scheduled.push(run);
        return () => undefined;
      },
      maxAttempts: 2,
      random: () => 1,
    });
    queue.enqueue("a", "applied");
    for (let round = 0; round < 4 && settled.length === 0; round++) {
      await vi.waitFor(() => expect(scheduled.length).toBeGreaterThan(round));
      scheduled[round]!();
      await Promise.resolve();
    }
    await vi.waitFor(() => expect(settled).toEqual([["a", "drop"]]));
    expect(queue.pending).toBe(0);
  });

  it("retries with growing backoff until the send succeeds", async () => {
    const h = harness(["retry", "retry", "ok"]);
    h.queue.enqueue("a", "applied");
    await vi.waitFor(() => expect(h.scheduled).toHaveLength(1));
    expect(h.scheduled[0]!.delay).toBe(1000);
    expect(h.states.at(-1)).toEqual({ pending: 1, retrying: true });
    h.scheduled.shift()!.run();
    await vi.waitFor(() => expect(h.scheduled).toHaveLength(1));
    expect(h.scheduled[0]!.delay).toBe(2000);
    h.scheduled.shift()!.run();
    await vi.waitFor(() => expect(h.settled).toEqual([["a", "ok"]]));
    expect(h.queue.pending).toBe(0);
    expect(h.states.at(-1)).toEqual({ pending: 0, retrying: false });
    expect(h.scheduled).toHaveLength(0);
  });

  it("stops retrying on a conflict and reports it", async () => {
    const h = harness(["conflict"]);
    h.queue.enqueue("a", "applied");
    await vi.waitFor(() => expect(h.settled).toEqual([["a", "conflict"]]));
    expect(h.queue.pending).toBe(0);
    expect(h.scheduled).toHaveLength(0);
  });

  it("keeps only the latest job per batch", async () => {
    const h = harness(["retry"]);
    h.queue.enqueue("a", "applied");
    await vi.waitFor(() => expect(h.scheduled).toHaveLength(1));
    h.queue.enqueue("a", "rejected");
    await vi.waitFor(() => expect(h.settled).toHaveLength(1));
    expect(h.sent).toEqual(["a:applied", "a:rejected"]);
  });

  it("flushes immediately when asked, cancelling the timer", async () => {
    const h = harness(["retry", "ok"]);
    h.queue.enqueue("a", "x");
    await vi.waitFor(() => expect(h.scheduled).toHaveLength(1));
    await h.queue.flush();
    expect(h.settled).toEqual([["a", "ok"]]);
    expect(h.scheduled).toHaveLength(0);
  });

  it("defers a failed direct send and cancels once a later one succeeds", async () => {
    const h = harness(["retry"]);
    expect(await h.queue.sendNow("a", "applied")).toBe("retry");
    expect(h.queue.has("a")).toBe(true);
    expect(h.scheduled).toHaveLength(1);
    expect(await h.queue.sendNow("a", "rejected")).toBe("ok");
    expect(h.queue.has("a")).toBe(false);
  });

  it("stops scheduling after dispose", async () => {
    const h = harness(["retry"]);
    h.queue.enqueue("a", "x");
    await vi.waitFor(() => expect(h.scheduled).toHaveLength(1));
    h.queue.dispose();
    expect(h.scheduled).toHaveLength(0);
    await h.queue.flush();
    expect(h.sent).toHaveLength(1);
  });
});

describe("AsyncMutex", () => {
  it("runs tasks strictly one after another", async () => {
    const mutex = new AsyncMutex();
    const log: string[] = [];
    const task = (name: string, ms: number) =>
      mutex.run(async () => {
        log.push(`start:${name}`);
        await new Promise((resolve) => setTimeout(resolve, ms));
        log.push(`end:${name}`);
        return name;
      });
    const results = await Promise.all([task("a", 20), task("b", 1), task("c", 5)]);
    expect(results).toEqual(["a", "b", "c"]);
    expect(log).toEqual(["start:a", "end:a", "start:b", "end:b", "start:c", "end:c"]);
  });

  it("keeps running after a task fails", async () => {
    const mutex = new AsyncMutex();
    const failed = mutex.run(async () => {
      throw new Error("boom");
    });
    const next = mutex.run(async () => "ok");
    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });
});
