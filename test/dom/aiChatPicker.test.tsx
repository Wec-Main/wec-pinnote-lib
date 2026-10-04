import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiChatPicker } from "../../src/features/ai/components/AiChatPicker";
import type { AiSession } from "../../src/types/ai.types";
import { click, flush } from "./aiTestUtils";

const chat = (id: string, title: string): AiSession =>
  ({
    aiSessionId: id,
    projectId: "p1",
    title,
    mode: "model",
    scopeKind: "flow",
    scopeId: "f1",
    provider: "claude",
    model: "m",
    effort: null,
    createdById: "u1",
    createdByName: "U",
    nativeSessionOwnerId: null,
    lastMessageAt: null,
    createdAt: "2026-10-03T10:00:00.000Z",
    updatedAt: "2026-10-03T10:00:00.000Z",
    archivedAt: null,
    activeTurn: null,
  }) as AiSession;

let container: HTMLDivElement;
let root: Root;
const onSelect = vi.fn();
const onNew = vi.fn();
const onRename = vi.fn();
const onArchive = vi.fn().mockResolvedValue(undefined);

function render(activeId: string | null, isNew = false, disabled = false) {
  act(() =>
    root.render(
      createElement(AiChatPicker, {
        chats: [chat("a", "Login flow"), chat("b", "Refund flow")],
        activeId,
        isNew,
        disabled,
        onSelect,
        onNew,
        onRename,
        onArchive,
      }),
    ),
  );
}

const trigger = () => container.querySelector<HTMLButtonElement>(".wpn-ai-chats__trigger")!;
const rows = () => Array.from(document.querySelectorAll<HTMLElement>(".wpn-ai-chats__row"));

beforeEach(() => {
  [onSelect, onNew, onRename].forEach((fn) => fn.mockReset());
  onArchive.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AiChatPicker", () => {
  it("shows the active chat and lists every chat", () => {
    render("a");
    expect(trigger().textContent).toContain("Login flow");
    click(trigger());
    expect(rows().map((row) => row.querySelector(".wpn-ai-chats__name")?.textContent)).toEqual([
      "Login flow",
      "Refund flow",
    ]);
    expect(rows()[0]!.className).toContain("wpn-ai-chats__row--active");
  });

  it("switches to another chat and closes", () => {
    render("a");
    click(trigger());
    click(rows()[1]!.querySelector(".wpn-ai-chats__pick"));
    expect(onSelect).toHaveBeenCalledWith("b");
    expect(document.querySelector(".wpn-ai-chats__menu")).toBeNull();
  });

  it("starts a new chat", () => {
    render("a");
    click(trigger());
    click(document.querySelector(".wpn-ai-chats__new"));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("labels a pending new chat", () => {
    render(null, true);
    expect(trigger().textContent).toContain("New chat");
  });

  it("asks before deleting a chat", async () => {
    render("a");
    click(trigger());
    click(rows()[1]!.querySelector('[aria-label="Delete Refund flow"]'));
    expect(onArchive).not.toHaveBeenCalled();
    click(document.querySelector(".wpn-ai-chats__danger"));
    await flush();
    expect(onArchive).toHaveBeenCalledWith("b");
  });

  it("cannot be opened while the AI is running", () => {
    render("a", false, true);
    expect(trigger().disabled).toBe(true);
  });
});
