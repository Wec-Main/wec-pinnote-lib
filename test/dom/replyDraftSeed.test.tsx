import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buttonByText, click, flush, typeInto } from "./aiTestUtils";

vi.mock("../../src/hooks/useMentionCandidates", () => ({ useMentionCandidates: () => [] }));
vi.mock("../../src/hooks/useReferenceCandidates", () => ({
  useReferenceCandidates: () => ({ references: [], loading: false, request: () => undefined }),
}));

const { AnnotationReplyComposer } =
  await import("../../src/components/AnnotationReplyComposer/AnnotationReplyComposer");

let container: HTMLDivElement;
let root: Root;

function render(seed: { text: string; key: number } | null) {
  act(() =>
    root.render(
      createElement(AnnotationReplyComposer, {
        onSubmit: async () => undefined,
        replyTarget: null,
        onCancelReply: () => undefined,
        seed,
        annotationId: "a1",
      }),
    ),
  );
}

const field = () => container.querySelector<HTMLTextAreaElement>("textarea")!;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("AI draft reply seeding", () => {
  it("fills an empty reply box directly", async () => {
    render(null);
    render({ text: "Thanks, fixed.", key: 1 });
    await flush();
    expect(field().value).toBe("Thanks, fixed.");
    expect(container.querySelector(".wpn-reply-box__seed")).toBeNull();
  });

  it("never overwrites typed text without asking", async () => {
    render(null);
    typeInto(field(), "My own words");
    render({ text: "AI words", key: 1 });
    await flush();
    expect(field().value).toBe("My own words");
    expect(container.querySelector(".wpn-reply-box__seed")).not.toBeNull();

    click(buttonByText(container, "Append"));
    await flush();
    expect(field().value).toBe("My own words\n\nAI words");

    render({ text: "Second draft", key: 2 });
    await flush();
    click(buttonByText(container, "Replace"));
    await flush();
    expect(field().value).toBe("Second draft");

    typeInto(field(), "Keep me");
    render({ text: "Third", key: 3 });
    await flush();
    click(buttonByText(container, "Dismiss"));
    await flush();
    expect(field().value).toBe("Keep me");
  });
});
