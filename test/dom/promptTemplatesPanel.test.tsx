import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PromptTemplatesView } from "../../src/components/Ai/PromptTemplatesPanel";
import { AiRuntimeContext } from "../../src/context/AiRuntimeContext";
import type { AiActionTemplateDto } from "../../src/types/ai.types";
import {
  aiMe,
  buttonByText,
  click,
  connector,
  fakeRuntime,
  flush,
  jsonResponse,
  typeInto,
} from "./aiTestUtils";

type DtoBase = AiActionTemplateDto["defaultTemplate"];

function base(overrides: Partial<DtoBase> = {}): DtoBase {
  return {
    actionKey: "comment.draft_reply",
    name: "Draft reply",
    description: "Draft a reply",
    surface: "annotation",
    systemPrompt: "<role>helper</role>",
    userTemplate: "<pinnote_context>\n{{input}}\n</pinnote_context>",
    inputSpec: { include: ["comments"], limits: { maxComments: 20 } },
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
    ...overrides,
  };
}

function template(
  overrides: Partial<AiActionTemplateDto> = {},
  defaults: Partial<DtoBase> = {},
): AiActionTemplateDto {
  const fields = base(overrides);
  return {
    ...fields,
    overridden: false,
    runnable: true,
    target: "annotation",
    allowedIncludes: ["title", "comments", "comments.user", "comments.content"],
    allowedOutputFormats: ["json"],
    placeholders: ["input", "prompt", "ops_grammar", "project_name", "user_name", "target_name"],
    defaultTemplate: base({ actionKey: fields.actionKey, ...defaults }),
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;
let server: AiActionTemplateDto[];
const fetchMock = vi.fn();

const path = (url: string) => new URL(url).pathname.replace("/api/v1/pinnote", "");
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => ((init as RequestInit)?.method ?? "GET") === method);
const codeAreas = () =>
  Array.from(container.querySelectorAll<HTMLTextAreaElement>(".wpn-ai-prompts__code"));
const saveButton = () => buttonByText(container, "Save")!;

beforeEach(async () => {
  server = [
    template({}),
    template(
      {
        actionKey: "erd.explain",
        name: "Explain model",
        surface: "data_model",
        outputFormat: "markdown",
        outputSchema: null,
        overridden: true,
        source: "org",
        systemPrompt: "custom",
        target: "data_model",
        inputSpec: {
          include: ["model"],
          limits: { maxEntities: 80, alwaysIncludeSelection: true },
        },
        allowedIncludes: ["model", "model.name", "selection"],
        allowedOutputFormats: ["markdown", "text"],
      },
      { systemPrompt: "original", userTemplate: "{{input}}", outputFormat: "markdown" },
    ),
    template({
      actionKey: "chat",
      name: "Chat assistant",
      surface: "chat",
      systemPrompt: "",
      userTemplate: "{{input}}\n{{prompt}}",
      inputSpec: {},
      outputFormat: "markdown",
      outputSchema: null,
      runnable: false,
      target: null,
      allowedIncludes: ["project", "selection"],
      allowedOutputFormats: ["markdown"],
    }),
  ];
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const route = path(url);
    const method = init?.method ?? "GET";
    if (route === "/ai/action-templates" && method === "GET") return jsonResponse(server);
    const match = /^\/ai\/action-templates\/([^/]+)$/.exec(route);
    if (match && method === "PUT") {
      const key = decodeURIComponent(match[1]!);
      const current = server.find((item) => item.actionKey === key)!;
      const saved = {
        ...current,
        ...JSON.parse(String(init?.body)),
        overridden: true,
        source: "org",
        version: current.version + 1,
      };
      server = server.map((item) => (item.actionKey === key ? saved : item));
      return jsonResponse(saved);
    }
    if (match && method === "DELETE") {
      const key = decodeURIComponent(match[1]!);
      server = server.map((item) =>
        item.actionKey === key
          ? { ...item, ...item.defaultTemplate, overridden: false, source: "global" }
          : item,
      );
      return jsonResponse(server.find((item) => item.actionKey === key));
    }
    const preview = /^\/ai\/action-templates\/([^/]+)\/preview$/.exec(route);
    if (preview && method === "POST") {
      return jsonResponse({
        system: "rendered system",
        user: "rendered user",
        input: { title: "Button" },
        errors: ["Unknown placeholders: nope"],
      });
    }
    throw new Error(`unexpected ${method} ${route}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const runtime = fakeRuntime({
    me: aiMe({ connectors: [connector("claude")], canManageAiTemplates: true }),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      createElement(
        AiRuntimeContext.Provider,
        { value: runtime.value },
        createElement(PromptTemplatesView, {
          targets: [{ kind: "annotation", id: "a1", label: "#1 · Button" }],
        }),
      ),
    ),
  );
  await flush();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("PromptTemplatesView", () => {
  it("lists actions with Default and Overridden badges", () => {
    const badges = Array.from(container.querySelectorAll(".wpn-ai-prompts__badge")).map(
      (badge) => badge.textContent,
    );
    expect(badges).toEqual(["Default", "Overridden", "Default"]);
  });

  it("saves an edited template with a parsed schema", async () => {
    expect(saveButton().disabled).toBe(true);
    typeInto(codeAreas()[0]!, "<role>better</role>");
    typeInto(codeAreas()[2]!, '{"type":"object","required":["reply"]}');
    expect(saveButton().disabled).toBe(false);
    click(saveButton());
    await flush();
    const [[url, init]] = calls("PUT") as [[string, RequestInit]];
    expect(path(url)).toBe("/ai/action-templates/comment.draft_reply");
    expect(JSON.parse(String(init.body))).toMatchObject({
      systemPrompt: "<role>better</role>",
      outputSchema: { type: "object", required: ["reply"] },
      inputSpec: { include: ["comments"] },
    });
    expect(container.textContent).toContain("Saved.");
    const badges = Array.from(container.querySelectorAll(".wpn-ai-prompts__badge")).map(
      (badge) => badge.textContent,
    );
    expect(badges).toEqual(["Overridden", "Overridden", "Default"]);
  });

  it("validates the schema and the {{input}} placeholder live", () => {
    typeInto(codeAreas()[2]!, "{not json");
    expect(container.textContent).toContain("Invalid JSON");
    expect(codeAreas()[2]!.getAttribute("aria-invalid")).toBe("true");
    expect(saveButton().disabled).toBe(true);

    typeInto(codeAreas()[2]!, "{}");
    typeInto(codeAreas()[1]!, "no placeholder");
    expect(container.textContent).toContain("The user template must contain {{input}}.");
    expect(saveButton().disabled).toBe(true);

    typeInto(codeAreas()[1]!, "{{input}}");
    expect(saveButton().disabled).toBe(false);
  });

  it("inserts placeholders from the palette", () => {
    const user = codeAreas()[1]!;
    act(() => {
      user.focus();
    });
    user.setSelectionRange(0, 0);
    click(buttonByText(container, "{{project_name}}"));
    expect(codeAreas()[1]!.value.startsWith("{{project_name}}")).toBe(true);
  });

  it("resets an override after confirmation and shows the diff", async () => {
    click(buttonByText(container, /Explain model/));
    await flush();
    click(buttonByText(container, "Diff vs default"));
    expect(container.querySelector(".wpn-ai-prompts__diff-line--add")?.textContent).toContain(
      "custom",
    );

    click(buttonByText(container, "Reset to default"));
    const dialog = container.querySelector(".wpn-confirm");
    expect(dialog).not.toBeNull();
    expect(calls("DELETE")).toHaveLength(0);
    click(buttonByText(dialog!, "Reset to default"));
    await flush();
    expect(calls("DELETE")).toHaveLength(1);
    expect(path(String(calls("DELETE")[0]![0]))).toBe("/ai/action-templates/erd.explain");
    expect(codeAreas()[0]!.value).toBe("original");
    const badges = Array.from(container.querySelectorAll(".wpn-ai-prompts__badge")).map(
      (badge) => badge.textContent,
    );
    expect(badges).toEqual(["Default", "Default", "Default"]);
  });

  it("offers only the allowed output formats and include fields, with boolean limits as checkboxes", async () => {
    click(buttonByText(container, /Explain model/));
    await flush();
    const formats = Array.from(container.querySelectorAll('[role="radio"]')).map(
      (item) => item.textContent,
    );
    expect(formats).toEqual(["Markdown", "Text"]);
    const checks = Array.from(
      container.querySelectorAll<HTMLLabelElement>(".wpn-ai-prompts__check"),
    ).map((label) => label.textContent);
    expect(checks).toEqual(
      expect.arrayContaining(["model", "model.name", "selection", "alwaysIncludeSelection"]),
    );
    expect(saveButton().disabled).toBe(true);
    typeInto(codeAreas()[0]!, "changed");
    expect(saveButton().disabled).toBe(false);
  });

  it("sends the preview body the API validates and shows its errors", async () => {
    typeInto(
      container.querySelector<HTMLInputElement>(".wpn-ai-prompts__limit--grow input")!,
      "be brief",
    );
    click(buttonByText(container, /Render preview/));
    await flush();
    const [[url, init]] = calls("POST") as [[string, RequestInit]];
    expect(path(url)).toBe("/ai/action-templates/comment.draft_reply/preview");
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(["prompt", "targetId", "template"]);
    expect(body).toMatchObject({ targetId: "a1", prompt: "be brief" });
    expect(body.template).toMatchObject({ systemPrompt: "<role>helper</role>" });
    expect(container.textContent).toContain("rendered system");
    expect(container.textContent).toContain("Unknown placeholders: nope");
  });

  it("hides the test run for actions the API cannot run", async () => {
    expect(buttonByText(container, /Test run/)).not.toBeNull();
    click(buttonByText(container, /Chat assistant/));
    await flush();
    expect(buttonByText(container, /Test run/)).toBeNull();
    expect(buttonByText(container, /Render preview/)).not.toBeNull();
  });
});
