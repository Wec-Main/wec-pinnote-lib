import { afterEach, describe, expect, it } from "vitest";
import { generateSelector, isStableId } from "../../src/utils/selectorGenerator";
import { ANNOTATION_SCOPE_ATTRIBUTE } from "../../src/utils/annotationScope";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isStableId", () => {
  it.each([
    ["radix-:r1:-content", false],
    ["headlessui-menu-1", false],
    ["mui-123", false],
    ["«r0»", false],
    ["reset-email", true],
    ["hero_banner", true],
  ])("isStableId(%s) is %s", (id, expected) => {
    expect(isStableId(id)).toBe(expected);
  });
});

function modalCard(scopeName: string): HTMLElement {
  const card = document.createElement("div");
  card.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, scopeName);
  card.innerHTML = `
    <div class="header">
      <h3>Title</h3>
    </div>
    <form>
      <p>Enter something</p>
      <input />
    </form>
  `;
  document.body.appendChild(card);
  return card;
}

describe("generateSelector with scope", () => {
  it("produces different selectors for identical markup in two different scopes", () => {
    const cardA = modalCard("login-forgot_password");
    const inputA = cardA.querySelector("input")!;
    const scopeRootA = cardA;
    const resultA = generateSelector(inputA, { name: "login-forgot_password", root: scopeRootA });

    document.body.innerHTML = "";

    const cardB = modalCard("login-forgot_username");
    const inputB = cardB.querySelector("input")!;
    const scopeRootB = cardB;
    const resultB = generateSelector(inputB, { name: "login-forgot_username", root: scopeRootB });

    expect(resultA.selector).not.toBe(resultB.selector);
    expect(resultA.selector.startsWith("@scope:")).toBe(true);
    expect(resultB.selector.startsWith("@scope:")).toBe(true);
  });

  it("produces the same unscoped output as before when no scope is passed", () => {
    const container = document.createElement("div");
    container.innerHTML = `<button>Send</button>`;
    document.body.appendChild(container);
    const button = container.querySelector("button")!;

    const unscoped = generateSelector(button);
    expect(unscoped.selector.startsWith("@scope:")).toBe(false);
  });
});
