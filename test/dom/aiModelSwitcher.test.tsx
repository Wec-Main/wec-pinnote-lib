import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiModelSwitcher } from "../../src/components/Ai/AiModelSwitcher";
import { AiMarkdown } from "../../src/components/Ai/AiMarkdown";
import type { AiRoute } from "../../src/components/Ai/aiHelpers";
import type { AiMe } from "../../src/types/ai.types";
import { aiMe, click, connector, flush, press } from "./aiTestUtils";

const me: AiMe = aiMe({
  connectors: [
    connector("claude", {
      models: [
        {
          id: "opus",
          label: "Opus",
          description: "Most capable",
          efforts: ["low", "medium", "high"],
          defaultEffort: "medium",
          isDefault: true,
        },
        {
          id: "sonnet",
          label: "Sonnet",
          description: "Fast",
          efforts: [],
          defaultEffort: null,
          isDefault: false,
        },
      ],
    }),
    connector("codex", {
      models: [
        {
          id: "gpt",
          label: "GPT",
          description: "",
          efforts: ["low", "high"],
          defaultEffort: "low",
          isDefault: true,
        },
      ],
    }),
  ],
});

let container: HTMLDivElement;
let root: Root;
const onChange = vi.fn();

function renderSwitcher(value: AiRoute) {
  act(() => root.render(createElement(AiModelSwitcher, { me, value, onChange, persist: false })));
}

const trigger = () => container.querySelector<HTMLButtonElement>(".wpn-ai-switcher__trigger")!;
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const expandSecond = () =>
  click(document.querySelectorAll<HTMLElement>(".wpn-ai-switcher__group-head")[1]);
const activeLabel = () => {
  const id = listbox()!.getAttribute("aria-activedescendant")!;
  return document.getElementById(id)?.querySelector(".wpn-ai-switcher__option-label")?.firstChild
    ?.textContent;
};

beforeEach(() => {
  onChange.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  renderSwitcher({ provider: "claude", model: "opus", effort: "medium" });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AiModelSwitcher", () => {
  it("shows the route on a chip and lists connected agents' models", () => {
    expect(trigger().textContent).toContain("Opus");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    click(trigger());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
    expect(document.querySelectorAll('[role="group"]')).toHaveLength(2);
    const heads = document.querySelectorAll(".wpn-ai-switcher__group-head");
    expect(heads[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(heads[1]!.getAttribute("aria-expanded")).toBe("false");
    expandSecond();
    expect(document.querySelectorAll('[role="option"]')).toHaveLength(4);
    expect(document.activeElement).toBe(listbox());
  });

  it("moves with arrows, Home and End, and picks with Enter", async () => {
    press(trigger(), "ArrowDown");
    expandSecond();
    press(listbox()!, "Home");
    expect(activeLabel()).toBe("Opus");
    press(listbox()!, "ArrowDown");
    expect(activeLabel()).toBe("Sonnet");
    press(listbox()!, "ArrowDown");
    expect(activeLabel()).toBe("GPT");
    press(listbox()!, "Home");
    expect(activeLabel()).toBe("Opus");
    press(listbox()!, "ArrowUp");
    expect(activeLabel()).toBe("Opus");
    press(listbox()!, "ArrowDown");
    press(listbox()!, "ArrowDown");
    press(listbox()!, "Enter");
    expect(onChange).toHaveBeenCalledWith({ provider: "codex", model: "gpt", effort: "low" });
    expect(listbox()).toBeNull();
    await flush();
    expect(document.activeElement).toBe(trigger());
  });

  it("jumps by typeahead", () => {
    let now = 10_000;
    const spy = vi.spyOn(Date, "now").mockImplementation(() => now);
    click(trigger());
    expandSecond();
    press(listbox()!, "s");
    expect(activeLabel()).toBe("Sonnet");
    now += 1000;
    press(listbox()!, "g");
    press(listbox()!, "p");
    expect(activeLabel()).toBe("GPT");
    now += 1000;
    press(listbox()!, "o");
    expect(activeLabel()).toBe("Opus");
    spy.mockRestore();
  });

  it("closes on Escape and returns focus to the chip", () => {
    click(trigger());
    press(listbox()!, "Escape");
    expect(listbox()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on an outside click", () => {
    click(trigger());
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(listbox()).toBeNull();
  });

  it("changes effort from the Effort row, medium by default", () => {
    click(trigger());
    const row = document.querySelector<HTMLElement>(".wpn-ai-switcher__row--effort")!;
    expect(row.textContent).toContain("Medium");
    click(row);
    const items = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    expect(items.map((item) => item.textContent)).toEqual(["Low", "Medium", "High"]);
    expect(items[1]!.getAttribute("aria-checked")).toBe("true");
    click(items[2]);
    expect(onChange).toHaveBeenCalledWith({ provider: "claude", model: "opus", effort: "high" });
    expect(listbox()).toBeNull();
  });

  it("puts models beyond the first four under More models", () => {
    const many = aiMe({
      connectors: [
        connector("claude", {
          models: Array.from({ length: 6 }, (_, index) => ({
            id: `m${index}`,
            label: `Model ${index}`,
            description: "",
            efforts: [],
            defaultEffort: null,
            isDefault: index === 0,
          })),
        }),
      ],
    });
    act(() =>
      root.render(
        createElement(AiModelSwitcher, {
          me: many,
          value: { provider: "claude", model: "m0", effort: null },
          onChange,
          persist: false,
        }),
      ),
    );
    click(trigger());
    const optionLabels = Array.from(
      document.querySelectorAll(".wpn-ai-switcher__option-label"),
    ).map((node) => node.firstChild?.textContent);
    expect(optionLabels).toEqual(["Model 0", "Model 1", "Model 2", "Model 3"]);
    click(document.querySelector<HTMLElement>(".wpn-ai-switcher__row"));
    const extra = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    expect(extra.map((item) => item.textContent)).toEqual(["Model 4", "Model 5"]);
    click(extra[1]);
    expect(onChange).toHaveBeenCalledWith({ provider: "claude", model: "m5", effort: null });
  });
});

describe("AiModelSwitcher Claude ordering", () => {
  it("lists Haiku before Sonnet in the main list", () => {
    const ids = ["default", "fable", "opus", "sonnet", "haiku", "opus-old"];
    const claude = aiMe({
      connectors: [
        connector("claude", {
          models: ids.map((id) => ({
            id,
            label: id,
            description: "",
            efforts: [],
            defaultEffort: null,
            isDefault: id === "default",
          })),
        }),
      ],
    });
    act(() =>
      root.render(
        createElement(AiModelSwitcher, {
          me: claude,
          value: { provider: "claude", model: "default", effort: null },
          onChange,
          persist: false,
        }),
      ),
    );
    click(trigger());
    const labels = Array.from(document.querySelectorAll(".wpn-ai-switcher__option-label")).map(
      (node) => node.firstChild?.textContent,
    );
    expect(labels).toEqual(["default", "fable", "opus", "haiku", "sonnet"]);
    expect(document.querySelector(".wpn-ai-switcher__row")?.textContent).toContain("More models");
  });
});

describe("AiMarkdown code copy", () => {
  it("copies the code block text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    act(() => root.render(createElement(AiMarkdown, { text: "```ts\nconst a = 1;\n```" })));
    const button = container.querySelector<HTMLButtonElement>(".wpn-ai-md__copy")!;
    expect(button.getAttribute("aria-label")).toBe("Copy code");
    click(button);
    await flush();
    expect(writeText).toHaveBeenCalledWith("const a = 1;");
    expect(button.getAttribute("aria-label")).toBe("Copied");
  });
});
