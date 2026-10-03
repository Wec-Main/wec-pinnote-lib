import { describe, expect, it } from "vitest";
import { caretPosition } from "../../src/utils/caretPosition";

function makeField(value: string): HTMLTextAreaElement {
  const field = document.createElement("textarea");
  field.value = value;
  document.body.appendChild(field);
  return field;
}

describe("caretPosition", () => {
  it("returns a position without throwing", () => {
    const field = makeField("hello @wo");
    const position = caretPosition(field, 9);
    expect(typeof position.left).toBe("number");
    expect(typeof position.top).toBe("number");
    expect(typeof position.lineHeight).toBe("number");
  });

  it("reuses a single mirror element across calls instead of recreating it", () => {
    const field = makeField("hello @wo");
    caretPosition(field, 3);
    caretPosition(field, 6);
    caretPosition(field, 9);

    const mirrors = document.body.querySelectorAll('div[style*="visibility: hidden"]');
    expect(mirrors.length).toBe(1);
  });
});
