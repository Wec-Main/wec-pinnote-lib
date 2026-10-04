import { AI_EFFORTS, isValidModelId } from "../modelValidation";
import type {
  AiActionOutputFormat,
  AiActionTarget,
  AiActionTemplate,
  AiActionTemplateFields,
} from "../../../types/ai.types";

export const TEMPLATE_PLACEHOLDERS = [
  "input",
  "prompt",
  "ops_grammar",
  "project_name",
  "user_name",
  "target_name",
] as const;

export const SYSTEM_PROMPT_LIMIT = 20_000;
export const MAX_TOKENS_MIN = 64;
export const MAX_TOKENS_MAX = 64_000;
export const TEMPLATE_EFFORTS = AI_EFFORTS;

export const OUTPUT_FORMATS: { id: AiActionOutputFormat; label: string }[] = [
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
  { id: "text", label: "Text" },
];

export interface TemplateDraft extends AiActionTemplateFields {
  schemaText: string;
}

export function schemaToText(schema: unknown): string {
  if (schema === null || schema === undefined) return "";
  if (typeof schema === "string") return schema;
  try {
    return JSON.stringify(schema, null, 2);
  } catch {
    return "";
  }
}

export function draftFromTemplate(template: AiActionTemplate): TemplateDraft {
  return {
    name: template.name,
    description: template.description,
    systemPrompt: template.systemPrompt ?? "",
    userTemplate: template.userTemplate ?? "",
    inputSpec: {
      ...template.inputSpec,
      include: [...(template.inputSpec?.include ?? [])],
      limits: { ...(template.inputSpec?.limits ?? {}) },
    },
    outputFormat: template.outputFormat,
    outputSchema: template.outputSchema ?? null,
    provider: template.provider ?? null,
    model: template.model ?? null,
    effort: template.effort ?? null,
    maxTokens: template.maxTokens ?? null,
    temperature: template.temperature ?? null,
    enabled: template.enabled,
    schemaText: schemaToText(template.outputSchema),
  };
}

export type SchemaCheck = { ok: true; value: unknown } | { ok: false; error: string };

export function parseSchema(text: string): SchemaCheck {
  if (!text.trim()) return { ok: false, error: "A JSON schema is required for JSON output." };
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { ok: false, error: "The schema must be a JSON object." };
    }
    return { ok: true, value };
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : "could not parse"}`,
    };
  }
}

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1] as string);
}

export function templatePlaceholders(template: AiActionTemplate | null | undefined): string[] {
  return template?.placeholders.length ? template.placeholders : [...TEMPLATE_PLACEHOLDERS];
}

export function outputFormatOptions(
  template: AiActionTemplate,
): { id: AiActionOutputFormat; label: string }[] {
  const allowed = template.allowedOutputFormats;
  return allowed.length > 0
    ? OUTPUT_FORMATS.filter((format) => allowed.includes(format.id))
    : OUTPUT_FORMATS;
}

export function validateDraft(draft: TemplateDraft, template?: AiActionTemplate): string[] {
  const errors: string[] = [];
  if (!draft.userTemplate.includes("{{input}}")) {
    errors.push("The user template must contain {{input}}.");
  }
  if (draft.systemPrompt.length > SYSTEM_PROMPT_LIMIT) {
    errors.push(`The system prompt is over ${SYSTEM_PROMPT_LIMIT.toLocaleString()} characters.`);
  }
  if (draft.userTemplate.length > SYSTEM_PROMPT_LIMIT) {
    errors.push(`The user template is over ${SYSTEM_PROMPT_LIMIT.toLocaleString()} characters.`);
  }
  if (template && template.actionKey !== "chat" && !draft.systemPrompt.trim()) {
    errors.push("The system prompt is required.");
  }
  if (template && template.allowedOutputFormats.length > 0) {
    if (!template.allowedOutputFormats.includes(draft.outputFormat)) {
      errors.push(`Output must be one of: ${template.allowedOutputFormats.join(", ")}.`);
    }
  }
  if (draft.outputFormat === "json") {
    const schema = parseSchema(draft.schemaText);
    if (!schema.ok) errors.push(schema.error);
  }
  if (
    draft.maxTokens !== null &&
    (!Number.isInteger(draft.maxTokens) ||
      draft.maxTokens < MAX_TOKENS_MIN ||
      draft.maxTokens > MAX_TOKENS_MAX)
  ) {
    errors.push(
      `Max tokens must be a whole number from ${MAX_TOKENS_MIN} to ${MAX_TOKENS_MAX.toLocaleString()}.`,
    );
  }
  if (draft.model !== null && draft.model !== "" && !isValidModelId(draft.model)) {
    errors.push("Model id contains characters the server does not accept.");
  }
  if (draft.effort !== null && !(TEMPLATE_EFFORTS as readonly string[]).includes(draft.effort)) {
    errors.push(`Effort must be one of: ${TEMPLATE_EFFORTS.join(", ")}.`);
  }
  for (const [key, value] of Object.entries(draft.inputSpec.limits ?? {})) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
      errors.push(`Limit "${key}" must be zero or more.`);
    }
  }
  if (template && template.allowedIncludes.length > 0) {
    const bad = draft.inputSpec.include.filter((item) => !template.allowedIncludes.includes(item));
    if (bad.length > 0) errors.push(`These input fields are not allowed: ${bad.join(", ")}.`);
  }
  if (template) {
    const known = new Set(templatePlaceholders(template));
    const unknown = [
      ...new Set([...placeholdersIn(draft.systemPrompt), ...placeholdersIn(draft.userTemplate)]),
    ].filter((name) => !known.has(name));
    if (unknown.length > 0) errors.push(`Unknown placeholders: ${unknown.join(", ")}.`);
  }
  return errors;
}

export function draftToRequest(draft: TemplateDraft): Partial<AiActionTemplateFields> {
  const { schemaText, ...fields } = draft;
  const schema = draft.outputFormat === "json" ? parseSchema(schemaText) : null;
  return {
    ...fields,
    outputSchema: schema && schema.ok ? schema.value : null,
  };
}

export function isDraftDirty(draft: TemplateDraft, template: AiActionTemplate): boolean {
  return JSON.stringify(draftFromTemplate(template)) !== JSON.stringify(draft);
}

export function insertAt(
  text: string,
  start: number,
  end: number,
  insert: string,
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return { text: text.slice(0, from) + insert + text.slice(to), caret: from + insert.length };
}

export type DiffLine = { kind: "same" | "add" | "remove"; text: string };

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      out.push({ kind: "remove", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < n) out.push({ kind: "remove", text: a[i++]! });
  while (j < m) out.push({ kind: "add", text: b[j++]! });
  return out;
}

export function targetKindFor(template: AiActionTemplate): AiActionTarget["kind"] | null {
  return template.target;
}

export function inputFieldOptions(template: AiActionTemplate): string[] {
  const pool = [...template.allowedIncludes, ...(template.inputSpec?.include ?? [])];
  return [...new Set(pool)];
}
