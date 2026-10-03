import { describe, expect, it } from "vitest";
import {
  TEMPLATE_PLACEHOLDERS,
  draftFromTemplate,
  draftToRequest,
  inputFieldOptions,
  insertAt,
  isDraftDirty,
  lineDiff,
  outputFormatOptions,
  templatePlaceholders,
  validateDraft,
} from "../src/components/Ai/promptTemplateLogic";
import { normalizeAiActionTemplate } from "../src/services/aiApi";
import type { AiActionTemplate, AiActionTemplateDto } from "../src/types/ai.types";

const template: AiActionTemplate = {
  actionKey: "comment.draft_reply",
  name: "Draft reply",
  description: "",
  surface: "thread",
  systemPrompt: "<role>x</role>",
  userTemplate: "<pinnote_context>\n{{input}}\n</pinnote_context>",
  inputSpec: { include: ["comments"] },
  outputFormat: "json",
  outputSchema: { type: "object" },
  provider: null,
  model: null,
  effort: "low",
  maxTokens: null,
  temperature: null,
  enabled: true,
  version: 1,
  source: "global",
  updatedAt: null,
  isDefault: true,
  defaults: null,
  runnable: true,
  target: "annotation",
  allowedIncludes: ["title", "comments", "comments.user", "comments.content"],
  allowedOutputFormats: ["json"],
  placeholders: [...TEMPLATE_PLACEHOLDERS],
};

const base = {
  actionKey: "erd.edit" as const,
  name: "Edit data model",
  description: "Change the model",
  surface: "data_model",
  systemPrompt: "<role>edit</role>\n{{ops_grammar}}",
  userTemplate: "{{input}}\n{{prompt}}",
  inputSpec: {
    include: ["model", "selection"],
    limits: { maxEntities: 80, alwaysIncludeSelection: true },
  },
  outputFormat: "json" as const,
  outputSchema: { type: "object" },
  provider: null,
  model: null,
  effort: "low",
  maxTokens: 8000,
  temperature: null,
  enabled: true,
  version: 0,
  source: "fallback" as const,
  updatedAt: null,
};

const dto: AiActionTemplateDto = {
  ...base,
  systemPrompt: "<role>custom</role>",
  version: 3,
  source: "org",
  updatedAt: "2026-10-01T00:00:00.000Z",
  overridden: true,
  runnable: true,
  target: "data_model",
  allowedIncludes: ["model", "model.name", "selection"],
  allowedOutputFormats: ["json"],
  placeholders: ["input", "prompt", "ops_grammar", "project_name", "user_name", "target_name"],
  defaultTemplate: base,
};

describe("prompt template logic", () => {
  it("validates placeholders, schema and limits", () => {
    const draft = draftFromTemplate(template);
    expect(validateDraft(draft)).toEqual([]);
    expect(
      validateDraft({ ...draft, userTemplate: "no input", schemaText: "{bad", maxTokens: -1 }),
    ).toEqual([
      "The user template must contain {{input}}.",
      expect.stringContaining("Invalid JSON"),
      "Max tokens must be a whole number from 64 to 64,000.",
    ]);
    expect(validateDraft({ ...draft, schemaText: "" })).toEqual([
      "A JSON schema is required for JSON output.",
    ]);
    expect(validateDraft({ ...draft, outputFormat: "markdown", schemaText: "" })).toEqual([]);
  });

  it("tracks dirtiness and serialises the schema", () => {
    const draft = draftFromTemplate(template);
    expect(isDraftDirty(draft, template)).toBe(false);
    const edited = { ...draft, schemaText: '{"type":"object","required":["reply"]}' };
    expect(isDraftDirty(edited, template)).toBe(true);
    const request = draftToRequest(edited);
    expect(request.outputSchema).toEqual({ type: "object", required: ["reply"] });
    expect(request).not.toHaveProperty("schemaText");
  });

  it("maps the API template DTO onto the editor model", () => {
    const mapped = normalizeAiActionTemplate(dto);
    expect(mapped).toMatchObject({
      actionKey: "erd.edit",
      isDefault: false,
      source: "org",
      runnable: true,
      target: "data_model",
      allowedIncludes: ["model", "model.name", "selection"],
      allowedOutputFormats: ["json"],
      inputSpec: {
        include: ["model", "selection"],
        limits: { maxEntities: 80, alwaysIncludeSelection: true },
      },
    });
    expect(mapped.defaults?.systemPrompt).toBe("<role>edit</role>\n{{ops_grammar}}");
    expect(inputFieldOptions(mapped)).toEqual(["model", "model.name", "selection"]);
    expect(outputFormatOptions(mapped).map((format) => format.id)).toEqual(["json"]);
    expect(templatePlaceholders(mapped)).toContain("target_name");
    expect(validateDraft(draftFromTemplate(mapped), mapped)).toEqual([]);
    expect(normalizeAiActionTemplate({ ...dto, overridden: false }).isDefault).toBe(true);
  });

  it("maps the chat DTO as not runnable with an empty input spec", () => {
    const chat = normalizeAiActionTemplate({
      ...dto,
      actionKey: "chat",
      systemPrompt: "",
      inputSpec: {},
      outputFormat: "markdown",
      outputSchema: null,
      runnable: false,
      target: null,
      overridden: false,
      allowedOutputFormats: ["markdown"],
    });
    expect(chat).toMatchObject({ runnable: false, target: null, isDefault: true });
    expect(chat.inputSpec.include).toEqual([]);
    expect(validateDraft(draftFromTemplate(chat), chat)).toEqual([]);
  });

  it("accepts xhigh effort and rejects a model id the server would refuse", () => {
    const draft = draftFromTemplate(normalizeAiActionTemplate(dto));
    expect(validateDraft({ ...draft, effort: "xhigh" })).not.toContain(
      "Effort must be one of: default, none, minimal, low, medium, high, xhigh, max.",
    );
    expect(validateDraft({ ...draft, model: "-bad model" })).toContain(
      "Model id contains characters the server does not accept.",
    );
  });

  it("mirrors the server template checks", () => {
    const mapped = normalizeAiActionTemplate(dto);
    const draft = draftFromTemplate(mapped);
    expect(
      validateDraft(
        {
          ...draft,
          systemPrompt: " ",
          userTemplate: "{{input}} {{nope}}",
          outputFormat: "markdown",
          effort: "ultra",
          inputSpec: { ...draft.inputSpec, include: ["model", "comments"] },
        },
        mapped,
      ),
    ).toEqual([
      "The system prompt is required.",
      "Output must be one of: json.",
      "Effort must be one of: default, none, minimal, low, medium, high, xhigh, max.",
      "These input fields are not allowed: comments.",
      "Unknown placeholders: nope.",
    ]);
  });

  it("inserts placeholders at the caret", () => {
    expect(insertAt("ab", 1, 1, "{{prompt}}")).toEqual({ text: "a{{prompt}}b", caret: 11 });
  });

  it("diffs lines", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc")).toEqual([
      { kind: "same", text: "a" },
      { kind: "remove", text: "b" },
      { kind: "add", text: "x" },
      { kind: "same", text: "c" },
    ]);
  });
});
