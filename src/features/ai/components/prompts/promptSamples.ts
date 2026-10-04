import type { AiActionTemplate } from "../../../../types/ai.types";

const SAMPLES: Record<string, string[]> = {
  chat: [
    "What does this project contain?",
    "Summarise the open comments on this project.",
    "Which data models have no relationships?",
  ],
  "erd.generate": [
    "An online shop with customers, orders, order items and products.",
    "A school system with students, teachers, classes and grades.",
  ],
  "erd.edit": [
    "Add created_at and updated_at timestamps to every entity.",
    "Rename the user entity to account and add an email field.",
  ],
  "erd.review": ["Review this model for missing keys and relationships."],
  "erd.explain": ["Explain this model in plain language."],
  "flow.generate": [
    "A sign-up flow with email verification and a welcome email.",
    "An order approval flow with manager review and rejection handling.",
  ],
  "flow.edit": [
    "Add an error path after the payment step.",
    "Rename the start node to Customer places order.",
  ],
  "flow.explain": ["Walk me through this flow step by step."],
};

export function samplesFor(template: AiActionTemplate): string[] {
  return SAMPLES[template.actionKey] ?? [];
}

export function humanize(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
