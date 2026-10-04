import { afterEach, describe, expect, it } from "vitest";
import {
  ANNOTATION_SCOPE_ATTRIBUTE,
  activeScopeRoot,
  findScopeRoot,
  isRendered,
  parseScopedSelector,
  scopeRootOf,
  scopedSelector,
} from "../../src/utils/annotation/annotationScope";

afterEach(() => {
  document.body.innerHTML = "";
});

function scoped(name: string, hidden = false): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, name);
  if (hidden) {
    el.hidden = true;
  }
  document.body.appendChild(el);
  return el;
}

describe("activeScopeRoot", () => {
  it("returns null when no scope is present", () => {
    expect(activeScopeRoot(document)).toBeNull();
  });

  it("returns the last-in-document-order scope when several are present", () => {
    scoped("first");
    const second = scoped("second");
    expect(activeScopeRoot(document)).toBe(second);
  });

  it("skips a hidden scope and resolves to the visible one", () => {
    scoped("hidden-one", true);
    const visible = scoped("visible-one");
    expect(activeScopeRoot(document)).toBe(visible);
  });

  it("resolves to the innermost scope when scopes are nested", () => {
    const outer = scoped("outer");
    const inner = document.createElement("div");
    inner.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, "inner");
    outer.appendChild(inner);
    expect(activeScopeRoot(document)).toBe(inner);
  });

  it("excludes .wpn-root from scope detection", () => {
    const libraryRoot = document.createElement("div");
    libraryRoot.className = "wpn-root";
    libraryRoot.setAttribute(ANNOTATION_SCOPE_ATTRIBUTE, "library");
    document.body.appendChild(libraryRoot);
    expect(scopeRootOf(libraryRoot)).toBeNull();
  });
});

describe("scopedSelector / parseScopedSelector", () => {
  it("round-trips a plain name", () => {
    const encoded = scopedSelector("login-forgot_password", "#email");
    expect(parseScopedSelector(encoded)).toEqual({
      scope: "login-forgot_password",
      inner: "#email",
    });
  });

  it("round-trips a name that needs escaping", () => {
    const name = "login::forgot password / v2";
    const encoded = scopedSelector(name, "div > span:nth-of-type(2)");
    expect(parseScopedSelector(encoded)).toEqual({
      scope: name,
      inner: "div > span:nth-of-type(2)",
    });
  });

  it("treats an unscoped selector as inner with a null scope", () => {
    expect(parseScopedSelector("#email")).toEqual({ scope: null, inner: "#email" });
  });
});

describe("findScopeRoot", () => {
  it("finds the element carrying the named scope", () => {
    const el = scoped("target");
    expect(findScopeRoot("target")).toBe(el);
  });

  it("returns null when no element carries that scope name", () => {
    expect(findScopeRoot("missing")).toBeNull();
  });
});

describe("isRendered", () => {
  it("is true for a plain attached element", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(isRendered(el)).toBe(true);
  });

  it("is false for a hidden element", () => {
    const el = document.createElement("div");
    el.hidden = true;
    document.body.appendChild(el);
    expect(isRendered(el)).toBe(false);
  });

  it("is false when display:none is set on an ancestor", () => {
    const parent = document.createElement("div");
    parent.style.display = "none";
    const child = document.createElement("div");
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(isRendered(child)).toBe(false);
  });
});
