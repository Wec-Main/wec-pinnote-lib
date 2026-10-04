import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotesRewriteReview,
  type NotesRewrite,
} from "../../src/features/ai/components/AiNotesRewrite";
import { IDLE_AI_ACTION } from "../../src/features/ai/components/useAiAction";
import type { AiActionRunState } from "../../src/types/ai.types";
import { buttonByText, click } from "./aiTestUtils";

const ORIGINAL = "Goal:\n- let customers raise tickets\n- admins see all tickets";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function rewrite(state: Partial<AiActionRunState>, suggestion = ""): NotesRewrite {
  return {
    available: true,
    open: true,
    running: state.status === "running",
    state: { ...IDLE_AI_ACTION, ...state },
    suggestion,
    start: vi.fn(),
    close: vi.fn(),
  };
}

function show(value: NotesRewrite, onApprove = vi.fn()) {
  act(() =>
    root.render(
      createElement(NotesRewriteReview, {
        rewrite: value,
        original: ORIGINAL,
        busy: false,
        onApprove,
      }),
    ),
  );
  return onApprove;
}

describe("NotesRewriteReview", () => {
  it("renders nothing until a rewrite is started", () => {
    show({ ...rewrite({}), open: false });
    expect(container.textContent).toBe("");
  });

  it("streams the suggestion and can be stopped without saving", () => {
    const value = rewrite({ status: "running" }, "Goal:\n- Let customers");
    const onApprove = show(value);
    expect(container.textContent).toContain("Rewriting your notes");
    expect(buttonByText(container, "Approve and save")).toBeNull();
    click(buttonByText(container, "Stop"));
    expect(value.close).toHaveBeenCalled();
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("saves the corrected notes only when approved", () => {
    const fixed = "Goal:\n- Let customers raise tickets.\n- Admins see all tickets.";
    const value = rewrite({ status: "done" }, `${fixed}\n`);
    const onApprove = show(value);
    expect(container.querySelector(".wpn-notes-rewrite__text")?.textContent).toBe(fixed);
    expect(container.querySelector(".wpn-notes-rewrite__warn")).toBeNull();
    click(buttonByText(container, "Approve and save"));
    expect(onApprove).toHaveBeenCalledWith(fixed);
    expect(value.close).toHaveBeenCalled();
  });

  it("discards the suggestion without saving", () => {
    const value = rewrite({ status: "done" }, "Goal:\n- Let customers raise tickets.");
    const onApprove = show(value);
    click(buttonByText(container, "Discard"));
    expect(value.close).toHaveBeenCalled();
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("says so when the notes are already correct and offers nothing to save", () => {
    show(rewrite({ status: "done" }, `  ${ORIGINAL}  `));
    expect(container.textContent).toContain("Your notes already look good");
    expect(buttonByText(container, "Approve and save")).toBeNull();
    expect(buttonByText(container, "Close")).not.toBeNull();
  });

  it("warns when the suggestion is much shorter than the notes", () => {
    show(rewrite({ status: "done" }, "Goal: tickets."));
    expect(container.querySelector(".wpn-notes-rewrite__warn")?.textContent).toContain(
      "noticeably shorter",
    );
  });

  it("shows the error and lets the user close it", () => {
    show(
      rewrite({
        status: "error",
        error: { code: "provider_error", message: "The AI is busy.", retryable: true },
      }),
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("The AI is busy.");
    expect(buttonByText(container, "Approve and save")).toBeNull();
  });
});
