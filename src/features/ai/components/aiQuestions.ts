import type { AiQuestion, AiQuestionOption } from "../../../types/ai.types";

export interface AiQuestionAnswer {
  selected: string[];
  custom: string;
  skipped?: boolean;
}

export const EMPTY_ANSWER: AiQuestionAnswer = { selected: [], custom: "" };
export const SKIPPED_TEXT = "No preference, use your best judgement";

function toOption(value: unknown): AiQuestionOption | null {
  if (typeof value === "string") {
    const label = value.trim();
    return label ? { label } : null;
  }
  if (typeof value !== "object" || value === null) return null;
  const item = value as { label?: unknown; description?: unknown };
  const label = typeof item.label === "string" ? item.label.trim() : "";
  if (!label) return null;
  const description = typeof item.description === "string" ? item.description.trim() : "";
  return description ? { label, description } : { label };
}

export function toQuestion(value: unknown): AiQuestion | null {
  if (typeof value === "string") {
    const question = value.trim();
    return question ? { question, options: [] } : null;
  }
  if (typeof value !== "object" || value === null) return null;
  const item = value as {
    question?: unknown;
    header?: unknown;
    options?: unknown;
    multiSelect?: unknown;
  };
  const question = typeof item.question === "string" ? item.question.trim() : "";
  if (!question) return null;
  const rawOptions = Array.isArray(item.options)
    ? item.options.map(toOption).filter((option): option is AiQuestionOption => option !== null)
    : [];
  // A single option isn't a real choice — fall back to free-text-only instead of a one-button
  // "multiple choice" (mirrors the backend's own normalizeQuestion floor).
  const options = rawOptions.length >= 2 ? rawOptions.slice(0, 4) : [];
  const result: AiQuestion = { question, options };
  if (typeof item.header === "string" && item.header.trim()) result.header = item.header.trim();
  if (item.multiSelect === true && options.length > 1) result.multiSelect = true;
  return result;
}

export function toQuestions(value: unknown): AiQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.map(toQuestion).filter((question): question is AiQuestion => question !== null);
}

export function isAnswered(answer: AiQuestionAnswer | undefined): boolean {
  return Boolean(answer && (answer.skipped || answer.selected.length > 0 || answer.custom.trim()));
}

export function answerText(answer: AiQuestionAnswer): string {
  if (answer.skipped && answer.selected.length === 0 && !answer.custom.trim()) return SKIPPED_TEXT;
  const parts = [...answer.selected];
  const custom = answer.custom.trim();
  if (custom) parts.push(custom);
  return parts.join(", ");
}

export function formatAnswers(
  questions: readonly AiQuestion[],
  answers: readonly AiQuestionAnswer[],
): string {
  const lines = questions.map(
    (question, index) =>
      `${index + 1}. ${question.question} → ${answerText(answers[index] ?? { selected: [], custom: "", skipped: true })}`,
  );
  return `Here are my answers:\n${lines.join("\n")}`;
}

export function withAnswers(prompt: string, answers: string): string {
  return prompt.trim() ? `${prompt.trim()}\n\n${answers}` : answers;
}
