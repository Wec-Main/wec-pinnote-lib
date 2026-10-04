import { describe, expect, it } from "vitest";
import { parseAnswers } from "../src/features/ai/components/AiTranscript";
import {
  answerText,
  formatAnswers,
  isAnswered,
  toQuestions,
  withAnswers,
  SKIPPED_TEXT,
} from "../src/features/ai/components/aiQuestions";

describe("aiQuestions", () => {
  it("normalizes strings and structured questions", () => {
    expect(
      toQuestions([
        "Which DB?",
        {
          question: "Scope?",
          header: "Scope",
          options: ["MVP", { label: "Full", description: "d" }],
          multiSelect: true,
        },
        { question: "" },
        42,
      ]),
    ).toEqual([
      { question: "Which DB?", options: [] },
      {
        question: "Scope?",
        header: "Scope",
        options: [{ label: "MVP" }, { label: "Full", description: "d" }],
        multiSelect: true,
      },
    ]);
  });

  it("formats answers, custom text and skips", () => {
    const questions = toQuestions([{ question: "A?", options: ["x", "y"] }, "B?"]);
    const text = formatAnswers(questions, [
      { selected: ["x"], custom: "" },
      { selected: [], custom: "", skipped: true },
    ]);
    expect(text).toBe(`Here are my answers:\n1. A? → x\n2. B? → ${SKIPPED_TEXT}`);
    expect(answerText({ selected: ["x"], custom: "also z" })).toBe("x, also z");
    expect(isAnswered({ selected: [], custom: "  " })).toBe(false);
    expect(withAnswers("Create a flow", "answers")).toBe("Create a flow\n\nanswers");
  });

  it("parses the answers message back into question and answer rows", () => {
    const text = formatAnswers(toQuestions(["A?", "B?"]), [
      { selected: ["x"], custom: "plus y" },
      { selected: [], custom: "", skipped: true },
    ]);
    expect(parseAnswers(text)).toEqual([
      { question: "A?", answer: "x, plus y" },
      { question: "B?", answer: SKIPPED_TEXT },
    ]);
    expect(parseAnswers("Create a flow")).toBeNull();
  });
});
