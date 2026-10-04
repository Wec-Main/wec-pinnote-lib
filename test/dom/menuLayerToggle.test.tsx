import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuPanel, type MenuItemDefinition } from "../../src/components/primitives/Menu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function render(items: MenuItemDefinition[]) {
  const anchorRef = createRef<HTMLElement>();
  act(() => {
    root.render(
      createElement(MenuPanel, {
        items,
        placement: "bottom-start",
        anchorRef,
        onRequestClose: () => undefined,
      }),
    );
  });
}

describe("MenuPanel layer toggle", () => {
  it("renders a switch on a submenu row and toggles without opening the flyout", () => {
    const onToggle = vi.fn();
    render([
      {
        type: "submenu",
        id: "comments-menu",
        label: "Comments",
        toggle: { label: "Show comments", checked: true, onToggle },
        items: [
          {
            type: "radio",
            id: "v1",
            label: "v1",
            checked: true,
            onSelect: () => undefined,
          },
        ],
      },
    ]);
    const toggle = document.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    act(() => toggle?.click());
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(document.querySelectorAll('[role="menu"]').length).toBe(1);
  });

  it("opens a flyout containing only the versions", () => {
    render([
      {
        type: "submenu",
        id: "flows-menu",
        label: "Flows",
        toggle: { label: "Show flows", checked: false, onToggle: () => undefined },
        items: [
          { type: "radio", id: "v1", label: "v1", checked: true, onSelect: () => undefined },
          { type: "radio", id: "v2", label: "v2", checked: false, onSelect: () => undefined },
        ],
      },
    ]);
    const trigger = document.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
    act(() => trigger?.click());
    const flyout = document.querySelectorAll('[role="menu"]')[1];
    expect(flyout?.querySelectorAll('[role="menuitemradio"]').length).toBe(2);
    expect(flyout?.querySelector('[role="menuitemcheckbox"]')).toBeNull();
    expect(flyout?.querySelector('[role="switch"]')).toBeNull();
  });

  it("renders a switch-style checkbox when the layer has no versions", () => {
    const onToggle = vi.fn();
    render([
      {
        type: "checkbox",
        id: "comments",
        label: "Comments",
        checked: false,
        variant: "switch",
        onToggle,
      },
    ]);
    const item = document.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]');
    expect(item?.querySelector(".wpn-switch")).not.toBeNull();
    act(() => item?.click());
    expect(onToggle).toHaveBeenCalledWith(true);
  });
});
