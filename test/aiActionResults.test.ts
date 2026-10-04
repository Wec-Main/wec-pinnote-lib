import { describe, expect, it } from "vitest";
import {
  resultFindings,
  resultNote,
  resultOpBatch,
} from "../src/features/ai/components/aiDockLogic";
import type { AiActionResult, AiOpBatch } from "../src/types/ai.types";

const batch = { aiOpBatchId: "ob1", ops: [] } as unknown as AiOpBatch;

describe("action results", () => {
  it("reads review findings from value.findings on an op batch", () => {
    const result: AiActionResult = {
      kind: "op_batch",
      batch,
      value: {
        title: "Review fixes",
        rationale: "ok",
        findings: [
          { severity: "medium", where: "users.email", issue: "Not unique", fix: "Add unique" },
          "Loose note",
          42,
        ],
        ops: [{ op: "x" }],
      },
    };
    expect(resultOpBatch(result)).toBe(batch);
    expect(resultFindings(result)).toEqual([
      { severity: "medium", target: "users.email", message: "Not unique", fix: "Add unique" },
      { message: "Loose note" },
    ]);
    expect(resultNote(result)).toBeNull();
  });

  it("treats an empty-ops answer as json with findings or a note", () => {
    const review: AiActionResult = {
      kind: "json",
      value: {
        title: "t",
        rationale: "r",
        findings: [{ severity: "low", where: "a", issue: "b", fix: "c" }],
        ops: [],
      },
    };
    expect(resultOpBatch(review)).toBeNull();
    expect(resultFindings(review)).toHaveLength(1);
    const plain: AiActionResult = {
      kind: "json",
      value: { title: "No change", rationale: "Fine as is", ops: [], questions: ["Which DB?"] },
    };
    expect(resultNote(plain)).toEqual({
      title: "No change",
      rationale: "Fine as is",
      questions: [{ question: "Which DB?", options: [] }],
    });
    expect(resultFindings({ kind: "markdown", text: "x" })).toEqual([]);
  });
});
