import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErdEditor } from "../../src/features/erd/components/erd/ErdEditor";
import { blogDocument } from "../erdFixtures";
import { buttonByText, click, typeInto } from "./aiTestUtils";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() =>
    root.render(createElement(ErdEditor, { initialDocument: blogDocument(), name: "Blog" })),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const outlineItems = () => [
  ...container.querySelectorAll<HTMLButtonElement>(".wpn-erd__outline-item"),
];
const labels = () =>
  [...container.querySelectorAll(".wpn-flowchart-ui__field-label")].map((n) => n.textContent);
const tabButtons = () => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const fieldInput = (label: string) => {
  const match = [...container.querySelectorAll(".wpn-flowchart-ui__field")].find(
    (el) => el.querySelector(".wpn-flowchart-ui__field-label")?.textContent === label,
  );
  return match?.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea") ?? null;
};

describe("data model sidebar and properties", () => {
  it("lists entities in the sidebar and opens the entity with General and Fields tabs", () => {
    const items = outlineItems();
    expect(items.length).toBeGreaterThan(0);
    act(() => click(items[0] ?? null));
    const tabs = [...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(tabs[0]).toBe("General");
    expect(tabs[1]).toMatch(/^Fields \(\d+\)$/);
    expect(labels()).toEqual(expect.arrayContaining(["Name", "Schema", "Comments"]));
    expect(container.textContent).not.toContain("Add field");
    act(() => click(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1] ?? null));
    expect(container.textContent).toContain("Add field");
    expect(labels()).not.toContain("Schema");
  });

  it("adds an enum from the palette and edits its values", () => {
    act(() => click(buttonByText(container, "Enum")));
    expect(container.querySelector(".wpn-flowchart-properties__header-title")?.textContent).toBe(
      "Enum",
    );
    act(() => click(buttonByText(container, "Add value")));
    expect(container.querySelector('input[aria-label="Value 1"]')).not.toBeNull();
    expect(outlineItems().some((item) => item.textContent?.startsWith("enum"))).toBe(true);
  });

  it("puts Engine above the large Description on the data model overview", () => {
    const order = labels();
    expect(order).toContain("Engine");
    expect(order.indexOf("Engine")).toBeLessThan(order.indexOf("Description"));
  });

  it("entity General tab edits group and lock, and locking disables editing", () => {
    const items = outlineItems();
    act(() => click(items[0] ?? null));
    expect(tabButtons().map((tab) => tab.textContent)).toEqual([
      "General",
      expect.stringMatching(/^Fields/),
    ]);
    expect(labels()).toEqual(expect.arrayContaining(["Group / subject area"]));

    typeInto(fieldInput("Group / subject area") as HTMLInputElement, "Billing");
    expect(outlineItems()[0]?.closest(".wpn-erd__outline-subgroup")?.textContent).toContain(
      "Billing",
    );

    const lockSwitch = container.querySelector<HTMLButtonElement>(
      '[aria-label="Locked — prevents edits"]',
    );
    expect(lockSwitch).not.toBeNull();
    act(() => click(lockSwitch));
    expect(fieldInput("Name")?.hasAttribute("disabled")).toBe(true);
  });

  it("converts an enum to a lookup table and selects the new entity", () => {
    act(() => click(buttonByText(container, "Enum")));
    act(() => click(buttonByText(container, "Add value")));
    act(() => click(buttonByText(container, "Convert to table")));
    expect(container.querySelector(".wpn-flowchart-properties__header-title")?.textContent).toBe(
      "Entity",
    );
  });

  it("materializes a join table for a many-to-many relationship", () => {
    const postsItem = outlineItems().find((item) => item.textContent?.includes("posts"));
    act(() => click(postsItem ?? null));
    act(() => click(tabButtons()[1] ?? null));
    const relButtons = [
      ...container.querySelectorAll<HTMLButtonElement>(".wpn-flowchart-properties__endpoint"),
    ];
    const manyToMany = relButtons.find((button) => button.textContent?.includes("tags"));
    act(() => click(manyToMany ?? null));
    expect(container.querySelector(".wpn-flowchart-properties__header-title")?.textContent).toBe(
      "Relationship",
    );
    act(() => click(buttonByText(container, "Materialize join table")));
    expect(container.querySelector(".wpn-flowchart-properties__header-title")?.textContent).toBe(
      "Entity",
    );
  });
});
