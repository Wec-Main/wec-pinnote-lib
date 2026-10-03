import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AiComposer,
  filterMentionCandidates,
  findMentionQuery,
  type AiMentionCandidate,
} from "../../src/components/Ai/AiComposer";
import { click, flush, press, typeInto } from "./aiTestUtils";

const candidates: AiMentionCandidate[] = [
  {
    trigger: "#",
    mention: { kind: "data_model", id: "dm1", label: "Orders" },
    description: "Data model",
  },
  {
    trigger: "#",
    mention: { kind: "flow", id: "f1", label: "Checkout flow" },
    description: "Flow",
  },
  { trigger: "#", mention: { kind: "annotation", id: "a42", label: "#42" } },
  { trigger: "@", mention: { kind: "user", id: "u2", label: "Priya" } },
];

let container: HTMLDivElement;
let root: Root;
const onSend = vi.fn();
const onMentionTrigger = vi.fn();

function field() {
  return container.querySelector<HTMLTextAreaElement>("textarea")!;
}

beforeEach(() => {
  onSend.mockReset().mockResolvedValue(undefined);
  onMentionTrigger.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(AiComposer, { candidates, onSend, onMentionTrigger })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("mention helpers", () => {
  it("finds a trigger before the caret", () => {
    expect(findMentionQuery("optimize #Ord", 13)).toEqual({ trigger: "#", query: "Ord", start: 9 });
    expect(findMentionQuery("email a@b", 9)).toBeNull();
    expect(filterMentionCandidates(candidates, "#", "42").map((c) => c.mention.id)).toEqual([
      "a42",
    ]);
  });
});

describe("epic mentions", () => {
  const withEpic: AiMentionCandidate[] = [
    ...candidates,
    {
      trigger: "#",
      mention: { kind: "epic", id: "e1", label: "Checkout revamp" },
      description: "Epic · In progress",
    },
  ];

  it("finds an epic by name, by kind and by status", () => {
    const ids = (query: string) =>
      filterMentionCandidates(withEpic, "#", query).map((c) => c.mention.id);
    expect(ids("check")).toContain("e1");
    expect(ids("epic")).toContain("e1");
    expect(ids("progress")).toContain("e1");
  });
});

describe("AiComposer", () => {
  it("turns a # mention into a chip and sends it in mentions[]", async () => {
    typeInto(field(), "optimize #Ord");
    expect(onMentionTrigger).toHaveBeenCalledWith("#");
    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain("Orders");

    press(field(), "Enter");
    expect(container.querySelector(".wpn-ai-chips")?.textContent).toContain("Orders");
    expect(field().value).toBe("optimize ");
    expect(onSend).not.toHaveBeenCalled();

    typeInto(field(), "optimize this, keep it short");
    press(field(), "Enter");
    await flush();
    expect(onSend).toHaveBeenCalledWith({
      text: "optimize this, keep it short",
      mentions: [{ kind: "data_model", id: "dm1", label: "Orders" }],
    });
    expect(field().value).toBe("");
    expect(container.querySelector(".wpn-ai-chips")).toBeNull();
  });

  it("supports @ teammates", () => {
    typeInto(field(), "ask @Pri");
    press(field(), "Enter");
    expect(container.querySelector(".wpn-ai-chips")?.textContent).toContain("@Priya");
  });

  it("Shift+Enter does not send; Escape closes the picker", async () => {
    typeInto(field(), "line one");
    press(field(), "Enter", { shiftKey: true });
    await flush();
    expect(onSend).not.toHaveBeenCalled();

    typeInto(field(), "line one #Che");
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    press(field(), "Escape");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("keeps the text when sending fails", async () => {
    onSend.mockRejectedValueOnce(new Error("offline"));
    typeInto(field(), "hello");
    press(field(), "Enter");
    await flush();
    expect(field().value).toBe("hello");
  });
});

describe("AiComposer drafts", () => {
  function remount(props: Record<string, unknown>) {
    act(() => root.unmount());
    root = createRoot(container);
    act(() =>
      root.render(createElement(AiComposer, { candidates, onSend, onMentionTrigger, ...props })),
    );
  }

  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("keeps the draft per session in sessionStorage and clears it after sending", async () => {
    remount({ draftKey: "s1" });
    typeInto(field(), "half written");
    expect(JSON.parse(window.sessionStorage.getItem("wpn-ai:draft:s1") ?? "{}").text).toBe(
      "half written",
    );
    remount({ draftKey: "s2" });
    expect(field().value).toBe("");
    remount({ draftKey: "s1" });
    expect(field().value).toBe("half written");
    press(field(), "Enter");
    await flush();
    expect(onSend).toHaveBeenCalledWith({ text: "half written", mentions: [] });
    expect(window.sessionStorage.getItem("wpn-ai:draft:s1")).toBeNull();
  });

  it("swaps drafts when the session changes without remounting", () => {
    window.sessionStorage.setItem(
      "wpn-ai:draft:b",
      JSON.stringify({ text: "draft for b", mentions: [] }),
    );
    remount({ draftKey: "a" });
    typeInto(field(), "draft for a");
    act(() =>
      root.render(
        createElement(AiComposer, { candidates, onSend, onMentionTrigger, draftKey: "b" }),
      ),
    );
    expect(field().value).toBe("draft for b");
  });

  it("survives a storage that throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    remount({ draftKey: "s1" });
    typeInto(field(), "still works");
    expect(field().value).toBe("still works");
    spy.mockRestore();
  });

  it("shows a counter near the limit and blocks sending over it", () => {
    remount({ maxLength: 10 });
    typeInto(field(), "1234567");
    expect(container.querySelector(".wpn-ai-composer__counter")).toBeNull();
    typeInto(field(), "123456789");
    expect(container.querySelector(".wpn-ai-composer__counter")?.textContent).toBe("9 / 10");
    typeInto(field(), "12345678901");
    expect(container.querySelector<HTMLButtonElement>('[aria-label="Send to AI"]')?.disabled).toBe(
      true,
    );
  });

  it("sends the selection only while the chip is on", async () => {
    const selection = { kind: "data_model" as const, id: "dm1", itemIds: ["e1", "e2"] };
    remount({ selection: { selection, label: "2 entities" } });
    expect(container.textContent).toContain("Include selection · 2 entities");
    typeInto(field(), "explain");
    press(field(), "Enter");
    await flush();
    expect(onSend).toHaveBeenLastCalledWith({ text: "explain", mentions: [], selection });
    click(container.querySelector(".wpn-ai-mention__toggle"));
    typeInto(field(), "again");
    press(field(), "Enter");
    await flush();
    expect(onSend).toHaveBeenLastCalledWith({ text: "again", mentions: [] });
  });

  it("clears the blur timer on unmount", () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, "clearTimeout");
    act(() => {
      field().dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    act(() => root.unmount());
    expect(clear).toHaveBeenCalled();
    root = createRoot(container);
    clear.mockRestore();
    vi.useRealTimers();
  });
});

describe("mention search box", () => {
  const search = () =>
    container.querySelector<HTMLInputElement>(".wpn-ai-mention-menu__search input");
  const options = () =>
    [...container.querySelectorAll(".wpn-mention__option .wpn-mention__name")].map(
      (node) => node.textContent,
    );

  it("filters the list from the search box and selects with Enter", async () => {
    act(() => field().focus());
    typeInto(field(), "Look at #");
    expect(search()).not.toBeNull();
    expect(options()).toEqual(["Orders", "Checkout flow", "#42"]);
    act(() => search()!.focus());
    typeInto(search()!, "check");
    expect(options()).toEqual(["Checkout flow"]);
    press(search()!, "Enter");
    await flush();
    expect(container.querySelector(".wpn-ai-chips")?.textContent).toContain("Checkout flow");
    expect(search()).toBeNull();
    expect(field().value).toBe("Look at ");
  });

  it("keeps the list open while focus moves into the search box", async () => {
    act(() => field().focus());
    typeInto(field(), "#");
    act(() => {
      search()!.focus();
      field().dispatchEvent(new FocusEvent("blur"));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });
    expect(search()).not.toBeNull();
    press(search()!, "Escape");
    expect(search()).toBeNull();
  });
});
