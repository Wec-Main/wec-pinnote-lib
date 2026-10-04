import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiMarkdown } from "../../src/features/ai/components/AiMarkdown";

const DOCUMENT = [
  "# Plan",
  "",
  "Intro with `code` and **bold**.",
  "",
  "- one",
  "  - nested",
  "",
  "- two",
  "",
  "```ts",
  "const a = 1;",
  "",
  "const b = 2;",
  "```",
  "",
  "| a | b |",
  "| --- | :-: |",
  "| 1 | 2 |",
  "",
  "Tail paragraph that keeps growing",
].join("\n");

describe("AiMarkdown streaming", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const fresh = (text: string) => {
    const reference = document.createElement("div");
    const referenceRoot = createRoot(reference);
    act(() => referenceRoot.render(createElement(AiMarkdown, { text, streaming: true })));
    const html = reference.innerHTML;
    act(() => referenceRoot.unmount());
    return html;
  };

  const show = (text: string) =>
    act(() => root.render(createElement(AiMarkdown, { text, streaming: true })));

  it("renders every streamed prefix like a fresh render", () => {
    for (let length = 0; length <= DOCUMENT.length; length += 3) {
      const prefix = DOCUMENT.slice(0, length);
      show(prefix);
      expect(host.innerHTML).toBe(fresh(prefix));
    }
  });

  it("keeps DOM nodes of completed blocks while the tail grows", () => {
    show(DOCUMENT.slice(0, DOCUMENT.indexOf("Tail")));
    const heading = host.querySelector("h1");
    const pre = host.querySelector("pre");
    const table = host.querySelector("table");
    show(DOCUMENT);
    show(`${DOCUMENT} and more\n\nAnother paragraph`);
    expect(host.querySelector("h1")).toBe(heading);
    expect(host.querySelector("pre")).toBe(pre);
    expect(host.querySelector("table")).toBe(table);
    expect(host.querySelectorAll("p")).toHaveLength(3);
  });
});
