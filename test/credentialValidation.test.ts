import { describe, expect, it } from "vitest";
import { emailError, passwordError } from "../src/utils/credentialValidation";

describe("emailError", () => {
  it.each(["priya@company.com", "a+b@sub.x.com", "o'n@x.co", "kavi@gmail.ai"])(
    "accepts %j like the API does",
    (input) => {
      expect(emailError(input)).toBeNull();
    },
  );

  it.each([
    ["", "Email is required."],
    ["priya company.com", "Email can't contain spaces."],
    ["priya.company.com", 'Include an "@" in the email, e.g. name@company.com.'],
    ["a@b@c.com", 'Email can contain only one "@".'],
    ["@company.com", 'Add the name before "@", e.g. name@company.com.'],
    ["priya@", 'Add a domain after "@", e.g. company.com.'],
    ["priya@company", '"company" is missing a domain ending, e.g. .com or .in.'],
    ["priya@company..com", "The domain can't start with a dot or contain consecutive dots."],
    [
      "kavi@gmail.ai2",
      '".ai2" isn\'t a valid domain ending. Use at least 2 letters and no numbers, e.g. .com or .ai.',
    ],
    ["a..b@x.com", 'The name before "@" can\'t contain consecutive dots.'],
    [".a@x.com", 'The name before "@" can\'t start or end with a dot.'],
    ["a@-x.com", "Domain parts can't start with a hyphen."],
    ["a_b@x_y.com", '"_" isn\'t allowed in the domain. Use letters, numbers, dots and hyphens.'],
  ])("explains what is wrong with %j", (input, message) => {
    expect(emailError(input)).toBe(message);
  });
});

describe("passwordError", () => {
  it("allows a blank password so one can be generated", () => {
    expect(passwordError("")).toBeNull();
  });

  it("says how many characters are missing", () => {
    expect(passwordError("abcde")).toMatch(/^Add 3 more characters\./);
    expect(passwordError("abcdefg")).toMatch(/^Add 1 more character\./);
  });

  it("rejects a password of only spaces", () => {
    expect(passwordError("        ")).toBe("A password can't be only spaces.");
  });

  it("accepts eight or more characters", () => {
    expect(passwordError("abcdefgh")).toBeNull();
  });
});
