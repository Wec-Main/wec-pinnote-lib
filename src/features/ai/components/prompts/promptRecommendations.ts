import type { AiEffort } from "../../modelValidation";
import type { ModelTier } from "./modelCatalog";

export type PromptEffort = AiEffort;

export interface PromptRecommendation {
  tier: ModelTier;
  effort: PromptEffort;
  reason: string;
}

const RECOMMENDATIONS: Record<string, PromptRecommendation> = {
  chat: {
    tier: "balanced",
    effort: "medium",
    reason: "Answers open questions and uses project tools, so it needs solid reasoning.",
  },
  "erd.generate": {
    tier: "strong",
    effort: "medium",
    reason: "Designs a whole schema where mistakes are costly, so use the most capable model.",
  },
  "erd.edit": {
    tier: "balanced",
    effort: "medium",
    reason: "Precise changes to an existing model. Balanced quality is usually right.",
  },
  "erd.review": {
    tier: "strong",
    effort: "high",
    reason: "Looks for subtle design problems, which rewards deeper reasoning.",
  },
  "erd.explain": {
    tier: "fast",
    effort: "low",
    reason: "Describes what is already there in plain language. A small model is enough.",
  },
  "flow.generate": {
    tier: "strong",
    effort: "medium",
    reason: "Builds a whole flow with branches, so use the most capable model.",
  },
  "flow.edit": {
    tier: "balanced",
    effort: "medium",
    reason: "Precise changes to an existing flow. Balanced quality is usually right.",
  },
  "flow.explain": {
    tier: "fast",
    effort: "low",
    reason: "Walks through what is already there. A small model is enough.",
  },
};

const FALLBACK: PromptRecommendation = {
  tier: "balanced",
  effort: "medium",
  reason: "A balanced model suits most prompts.",
};

export function recommendationFor(actionKey: string): PromptRecommendation {
  return RECOMMENDATIONS[actionKey] ?? FALLBACK;
}

export const EFFORT_DETAILS: Record<PromptEffort, { label: string; hint: string }> = {
  default: { label: "Default", hint: "Use the provider default." },
  none: { label: "None", hint: "No extra reasoning." },
  minimal: { label: "Minimal", hint: "Barely any reasoning. Fastest." },
  low: { label: "Low", hint: "Fastest. For short, simple tasks." },
  medium: { label: "Medium", hint: "Balanced speed and care." },
  high: { label: "High", hint: "Slow and thorough." },
  xhigh: { label: "Extra high", hint: "Deeper reasoning for hard tasks." },
  max: { label: "Max", hint: "Slowest and most thorough." },
};
