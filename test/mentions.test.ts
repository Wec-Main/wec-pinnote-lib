import { describe, expect, it } from "vitest";
import {
  encodeMentions,
  filterMentionCandidates,
  findMentionQuery,
  mentionsToPlainText,
  splitMentions,
} from "../src/utils/mentions";

const people = [
  { id: "u1", name: "Kavi N" },
  { id: "u2", name: "Kavi Narayan" },
  { id: "u3", name: "Ada Lovelace" },
];

describe("encodeMentions", () => {
  it("encodes a typed @name as a mention token, preferring the longest match", () => {
    expect(encodeMentions("hi @Kavi Narayan and @ada lovelace!", people)).toBe(
      "hi @[Kavi Narayan](u2) and @[Ada Lovelace](u3)!",
    );
  });

  it("leaves emails and unknown names untouched", () => {
    expect(encodeMentions("mail kavi@Kavi N.com or @Nobody", people)).toBe(
      "mail kavi@Kavi N.com or @Nobody",
    );
  });

  it("does not match a name that continues into a longer word", () => {
    expect(encodeMentions("@Kavi Nx", people)).toBe("@Kavi Nx");
  });
});

describe("splitMentions and mentionsToPlainText", () => {
  const message = "ping @[Ada Lovelace](u3), then @[Kavi N](u1)";

  it("splits text and mention segments in order", () => {
    expect(splitMentions(message)).toEqual([
      { kind: "text", value: "ping " },
      { kind: "mention", name: "Ada Lovelace", userId: "u3" },
      { kind: "text", value: ", then " },
      { kind: "mention", name: "Kavi N", userId: "u1" },
    ]);
  });

  it("round-trips through plain text back to the same tokens", () => {
    expect(mentionsToPlainText(message)).toBe("ping @Ada Lovelace, then @Kavi N");
    expect(encodeMentions(mentionsToPlainText(message), people)).toBe(message);
  });
});

describe("findMentionQuery", () => {
  it("returns the query typed after @ up to the caret", () => {
    expect(findMentionQuery("hello @Ka", 9)).toEqual({ start: 6, query: "Ka" });
  });

  it("ignores @ inside a word and after a newline", () => {
    expect(findMentionQuery("kavi@Ka", 7)).toBeNull();
    expect(findMentionQuery("@Ka\nx", 5)).toBeNull();
  });
});

describe("filterMentionCandidates", () => {
  it("ranks word-prefix matches before substring matches", () => {
    expect(filterMentionCandidates(people, "lo").map((person) => person.id)).toEqual(["u3"]);
    expect(filterMentionCandidates(people, "na").map((person) => person.id)).toEqual(["u2"]);
  });
});
