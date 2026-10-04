export const AI_EFFORTS = [
  "default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type AiEffort = (typeof AI_EFFORTS)[number];

export const MODEL_ID_MAX_LENGTH = 100;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._:/@][A-Za-z0-9._:/@[\]-]*$/;

export function isValidModelId(value: string): boolean {
  return value.length <= MODEL_ID_MAX_LENGTH && MODEL_ID_PATTERN.test(value);
}

export function isAiEffort(value: unknown): value is AiEffort {
  return typeof value === "string" && (AI_EFFORTS as readonly string[]).includes(value);
}
