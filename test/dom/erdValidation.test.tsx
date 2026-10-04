import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErdEditor } from "../../src/features/erd/components/erd/ErdEditor";
import type { ErdDocumentJSON } from "../../src/types/dataModel.types";
import { blogDocument, entity, field, relationship } from "../erdFixtures";
import { buttonByText, click } from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;

function flawed(): ErdDocumentJSON {
  const base = blogDocument();
  return {
    ...base,
    engine: "mysql",
    entities: [
      entity(
        "p",
        [
          field("p_id", { name: "id", primaryKey: true, nullable: false }),
          field("p_name", { name: "name", type: "varchar", nullable: false }),
        ],
        { name: "user" },
      ),
      entity(
        "c",
        [
          field("c_id", { name: "id", primaryKey: true, nullable: false }),
          field("c_pid", { name: "parent_id", type: "uuid" }),
        ],
        { name: "children" },
      ),
    ],
    relationships: [relationship("r", "p", "c", { sourceFieldId: "p_id", targetFieldId: "c_pid" })],
    enums: [],
    notes: [],
  };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(createElement(ErdEditor, { initialDocument: flawed(), name: "Shop" })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const panel = () => container.querySelector(".wpn-erd-validation__panel");
const badge = () => container.querySelector(".wpn-erd-validate-badge");

describe("data model validation UI", () => {
  it("shows nothing until Validate is pressed, then counts and lists issues", () => {
    expect(panel()).toBeNull();
    expect(badge()).toBeNull();
    act(() => click(buttonByText(container, "Validate")));
    expect(panel()).not.toBeNull();
    expect(badge()?.classList.contains("wpn-erd-validate-badge--error")).toBe(true);
    const text = panel()!.textContent ?? "";
    expect(text).toContain("needs a length");
    expect(text).toContain("reserved SQL word");
    expect(text).toContain("A foreign key should have the same type");
  });

  it("marks the offending fields and entities on the canvas", () => {
    act(() => click(buttonByText(container, "Validate")));
    const fieldsWithIssue = [...container.querySelectorAll(".wpn-erd-field")].filter((el) =>
      /wpn-erd-field--issue-(error|warning)/.test(el.className),
    );
    expect(fieldsWithIssue.length).toBeGreaterThan(0);
    expect(
      container.querySelector(".wpn-erd-entity--issue-error, .wpn-erd-entity--issue-warning"),
    ).not.toBeNull();
  });

  it("filters by severity and focuses a field when an issue is clicked", () => {
    act(() => click(buttonByText(container, "Validate")));
    const rows = () => panel()!.querySelectorAll(".wpn-erd-validation__issue");
    const all = rows().length;
    act(() => click(buttonByText(panel() as unknown as HTMLElement, /^Warnings/)));
    const warnings = rows().length;
    expect(warnings).toBeGreaterThan(0);
    expect(warnings).toBeLessThan(all);
    act(() => click(buttonByText(panel() as unknown as HTMLElement, /^Errors/)));
    expect(
      [...rows()].every((row) => row.querySelector(".wpn-erd-validation__severity--error")),
    ).toBe(true);
    const target = [...rows()].find((row) => row.textContent?.includes("needs a length"));
    act(() => click(target));
    expect(container.querySelector(".wpn-erd-field--active")).not.toBeNull();
  });

  it("closes the panel and clears the marks when Validate is pressed again", () => {
    act(() => click(buttonByText(container, "Validate")));
    act(() => click(buttonByText(container, /Validate[0-9✓]/)));
    expect(panel()).toBeNull();
    expect(container.querySelector('[class*="wpn-erd-field--issue"]')).toBeNull();
  });
});
