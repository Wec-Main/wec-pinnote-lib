import { describe, expect, it } from "vitest";
import { resultFindings, resultNote, resultOpBatch } from "../src/components/Ai/aiDockLogic";
import {
  DRAFT_REQUIRED_MESSAGE,
  NO_CONTEXT_MESSAGE,
  friendlyCommentAiError,
  resultText,
} from "../src/components/Ai/AnnotationAiActions";
import { IDLE_AI_ACTION } from "../src/components/Ai/useAiAction";
import type { AiActionResult, AiOpBatch } from "../src/types/ai.types";

const batch = { aiOpBatchId: "ob1", ops: [] } as unknown as AiOpBatch;
const state = (result: AiActionResult) => ({ ...IDLE_AI_ACTION, status: "done" as const, result });

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
      questions: ["Which DB?"],
    });
    expect(resultFindings({ kind: "markdown", text: "x" })).toEqual([]);
  });

  it("extracts comment action text from markdown and json envelopes", () => {
    expect(resultText(state({ kind: "markdown", text: "**Asked:** x" }), "summary")).toBe(
      "**Asked:** x",
    );
    expect(resultText(state({ kind: "json", value: { reply: "Thanks!" } }), "reply")).toBe(
      "Thanks!",
    );
    expect(resultText(state({ kind: "json", value: { text: "Better" } }), "text")).toBe("Better");
    expect(resultText(state({ kind: "json", value: { text: " " } }), "text")).toBeNull();
  });

  it("maps pre-stream API codes to comment messages", () => {
    const err = (code: string, message = "server says") => ({ code, message, retryable: false });
    expect(friendlyCommentAiError(err("no_context"))).toBe(NO_CONTEXT_MESSAGE);
    expect(friendlyCommentAiError(err("draft_required"))).toBe(DRAFT_REQUIRED_MESSAGE);
    expect(
      friendlyCommentAiError(err("rate_limited", "You already have several AI actions running")),
    ).toBe("You already have several AI actions running");
    expect(friendlyCommentAiError(err("runtime_busy"))).toBe(
      "The AI is busy right now. Try again in a moment.",
    );
    expect(friendlyCommentAiError(err("unknown_action", "Unknown AI action x"))).toBe(
      "Unknown AI action x",
    );
    expect(friendlyCommentAiError(null)).toBeNull();
  });
});
