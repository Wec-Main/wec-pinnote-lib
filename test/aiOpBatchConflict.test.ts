import { describe, expect, it, vi } from "vitest";
import {
  isOpBatchStatusConflict,
  reconcileStatusConflict,
} from "../src/features/ai/opBatchConflict";
import {
  AI_ERROR_TEXT,
  aiErrorCode,
  describeAiError,
} from "../src/features/ai/components/aiHelpers";
import { AnnotationApiError } from "../src/types/annotation.types";
import type { AiOpBatch } from "../src/types/ai.types";

function conflict(code: string, status = 409) {
  return new AnnotationApiError(
    "boom",
    status,
    JSON.stringify({ error: "boom", details: { code, currentStatus: "applied" } }),
  );
}

const batchWith = (status: AiOpBatch["status"]) => ({ aiOpBatchId: "b", status }) as AiOpBatch;

describe("op batch status conflicts", () => {
  it("recognises the 409 code from the error body", () => {
    expect(isOpBatchStatusConflict(conflict("op_batch_status_conflict"))).toBe(true);
    expect(isOpBatchStatusConflict(conflict("stale_base_revision"))).toBe(false);
    expect(isOpBatchStatusConflict(new Error("x"))).toBe(false);
  });

  it("settles when the server already holds the requested status", async () => {
    const outcome = await reconcileStatusConflict({ status: "applied" }, async () =>
      batchWith("applied"),
    );
    expect(outcome.kind).toBe("settled");
  });

  it("reports the server status when it diverges", async () => {
    const outcome = await reconcileStatusConflict({ status: "applied" }, async () =>
      batchWith("applying"),
    );
    expect(outcome).toEqual({ kind: "diverged", batch: batchWith("applying") });
  });

  it("is unknown when the refetch fails", async () => {
    const fetchBatch = vi.fn().mockRejectedValue(new Error("offline"));
    const outcome = await reconcileStatusConflict({ status: "applied" }, fetchBatch);
    expect(outcome).toEqual({ kind: "unknown" });
  });
});

describe("server error code mapping", () => {
  it.each([
    "stale_base_revision",
    "persist_failed",
    "invalid_ops",
    "template_conflict",
    "op_batch_status_conflict",
  ])("maps %s to a readable message", (code) => {
    const err = conflict(code, 400);
    expect(aiErrorCode(err)).toBe(code);
    expect(describeAiError(err)).toBe(AI_ERROR_TEXT[code]);
  });

  it("tells the user to ask the AI again on a stale revision", () => {
    expect(describeAiError(conflict("stale_base_revision"))).toMatch(/ask the ai again/i);
  });

  it("reads a top-level code too", () => {
    const err = new AnnotationApiError("x", 500, JSON.stringify({ code: "persist_failed" }));
    expect(aiErrorCode(err)).toBe("persist_failed");
  });
});
