import { afterEach, describe, expect, it } from "vitest";
import { getElementLabel, resolveElement } from "../../src/utils/elementResolver";
import { generateSelector } from "../../src/utils/selectorGenerator";
import { ANNOTATION_SCOPE_ATTRIBUTE } from "../../src/utils/annotationScope";
import type { AnnotationAnchor } from "../../src/types/annotation.types";

afterEach(() => {
  document.body.innerHTML = "";
});

function anchorFor(selector: string, elementIdentifier: string): AnnotationAnchor {
  return {
    selector,
    elementIdentifier,
    relativeX: 0.5,
    relativeY: 0.5,
    fallbackX: 0,
    fallbackY: 0,
    viewportWidth: 1024,
    viewportHeight: 768,
  };
}

describe("resolveElement without scope", () => {
  it("resolves a duplicate name by picking the single visible match", () => {
    document.body.innerHTML = `
      <input name="email" hidden />
      <input name="email" />
    `;
    const visible = document.querySelectorAll('input[name="email"]')[1] as HTMLElement;
    const anchor = anchorFor("", "email");
    expect(resolveElement(anchor)).toBe(visible);
  });

  it("resolves two visible matches with distinct labels by label", () => {
    document.body.innerHTML = `
      <button aria-label="Submit form">Submit form</button>
      <button aria-label="Submit search">Submit search</button>
    `;
    const target = document.querySelectorAll("button")[1] as HTMLElement;
    const anchor = anchorFor("", "Submit search");
    expect(resolveElement(anchor)).toBe(target);
  });

  it("returns null on full ambiguity", () => {
    document.body.innerHTML = `
      <span>Save</span>
      <span>Save</span>
    `;
    const anchor = anchorFor("", "Save");
    expect(resolveElement(anchor)).toBeNull();
  });

  it("resolves a button-with-inner-span by label to the button, not the span", () => {
    document.body.innerHTML = `<button><span>Send</span></button>`;
    const button = document.querySelector("button")!;
    const anchor = anchorFor("", "Send");
    expect(resolveElement(anchor)).toBe(button);
  });

  it("falls through to a label match when a stale nth-of-type selector now uniquely matches a different element", () => {
    document.body.innerHTML = `
      <div class="box">
        <button>Cancel</button>
        <button>Sign In</button>
      </div>
    `;
    const signInButton = document.querySelectorAll("button")[1] as HTMLElement;
    const { selector } = generateSelector(signInButton);
    const anchor = anchorFor(selector, getElementLabel(signInButton));

    expect(resolveElement(anchor)).toBe(signInButton);

    const box = document.querySelector(".box")!;
    box.innerHTML = `<button>Sign In</button><button>Cancel</button>`;
    const relocatedSignIn = document.querySelectorAll("button")[0] as HTMLElement;
    const staleMatch = document.querySelector(selector);
    expect(staleMatch).not.toBe(relocatedSignIn);

    expect(resolveElement(anchor)).toBe(relocatedSignIn);
  });

  it("accepts a lone selector match as-is when there is no elementIdentifier to cross-check", () => {
    document.body.innerHTML = `
      <div class="box">
        <button>Cancel</button>
        <button>Sign In</button>
      </div>
    `;
    const signInButton = document.querySelectorAll("button")[1] as HTMLElement;
    const { selector } = generateSelector(signInButton);
    const anchor = anchorFor(selector, "");

    expect(resolveElement(anchor)).toBe(signInButton);
  });
});

describe("resolveElement with scope", () => {
  function modal(scopeName: string): HTMLElement {
    const el = document.createElement("div");
    el.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, scopeName);
    el.innerHTML = `<input name="email" />`;
    document.body.appendChild(el);
    return el;
  }

  it("returns null when the anchor's scope is absent", () => {
    const card = modal("login-forgot_password");
    const input = card.querySelector("input")!;
    const { selector, elementIdentifier } = generateSelector(input, {
      name: "login-forgot_password",
      root: card,
    });
    document.body.innerHTML = "";
    expect(resolveElement(anchorFor(selector, elementIdentifier))).toBeNull();
  });

  it("returns null when the anchor's scope is present but not topmost", () => {
    const cardA = modal("login-forgot_password");
    const inputA = cardA.querySelector("input")!;
    const { selector, elementIdentifier } = generateSelector(inputA, {
      name: "login-forgot_password",
      root: cardA,
    });
    modal("login-forgot_username");

    expect(resolveElement(anchorFor(selector, elementIdentifier))).toBeNull();
  });

  it("resolves when the anchor's scope is the active (topmost) one", () => {
    modal("login-forgot_password");
    const cardB = modal("login-forgot_username");
    const inputB = cardB.querySelector("input")!;
    const { selector, elementIdentifier } = generateSelector(inputB, {
      name: "login-forgot_username",
      root: cardB,
    });

    expect(resolveElement(anchorFor(selector, elementIdentifier))).toBe(inputB);
  });

  it("returns null for an unscoped anchor while a scope is active", () => {
    document.body.innerHTML = `<input name="standalone" />`;
    const input = document.querySelector("input")!;
    const { selector, elementIdentifier } = generateSelector(input);

    const scopedContainer = document.createElement("div");
    scopedContainer.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, "some-scope");
    document.body.appendChild(scopedContainer);

    expect(resolveElement(anchorFor(selector, elementIdentifier))).toBeNull();
  });
});
