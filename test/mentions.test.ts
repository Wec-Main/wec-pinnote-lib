import { describe, expect, it } from "vitest";
import {
  encodeMentions,
  filterMentionCandidates,
  filterReferenceCandidates,
  findMentionQuery,
  mentionsToPlainText,
  referencesInMessage,
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
    expect(findMentionQuery("hello @Ka", 9)).toEqual({ start: 6, query: "Ka", trigger: "@" });
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

const items = [
  { kind: "epic" as const, id: "e1", name: "Checkout" },
  { kind: "flow" as const, id: "f1", name: "Checkout flow" },
  { kind: "dataModel" as const, id: "d1", name: "Orders" },
];

describe("# references", () => {
  it("encodes typed #names alongside @mentions, preferring the longest match", () => {
    expect(encodeMentions("@Ada Lovelace see #checkout flow and #Orders.", people, items)).toBe(
      "@[Ada Lovelace](u3) see #[Checkout flow](flow:f1) and #[Orders](dataModel:d1).",
    );
  });

  it("leaves unknown hashtags and issue numbers alone", () => {
    expect(encodeMentions("fixes #42 and #nothing", people, items)).toBe("fixes #42 and #nothing");
  });

  it("splits references into segments and round-trips through plain text", () => {
    const message = "ping @[Ada Lovelace](u3) about #[Checkout](epic:e1)";
    expect(splitMentions(message)).toEqual([
      { kind: "text", value: "ping " },
      { kind: "mention", name: "Ada Lovelace", userId: "u3" },
      { kind: "text", value: " about " },
      { kind: "reference", refKind: "epic", refId: "e1", name: "Checkout" },
    ]);
    expect(mentionsToPlainText(message)).toBe("ping @Ada Lovelace about #Checkout");
    expect(encodeMentions(mentionsToPlainText(message), people, items)).toBe(message);
  });

  it("lists each referenced item once", () => {
    expect(
      referencesInMessage(
        "#[Orders](dataModel:d1) then #[Orders](dataModel:d1) #[Checkout](epic:e1)",
      ),
    ).toEqual([
      { kind: "dataModel", id: "d1", name: "Orders" },
      { kind: "epic", id: "e1", name: "Checkout" },
    ]);
  });

  it("detects a # query and groups matches by kind", () => {
    expect(findMentionQuery("see #chec", 9)).toEqual({ start: 4, query: "chec", trigger: "#" });
    expect(filterReferenceCandidates(items, "chec").map((item) => item.id)).toEqual(["e1", "f1"]);
  });
});
