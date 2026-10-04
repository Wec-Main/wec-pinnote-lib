import { describe, expect, it } from "vitest";
import { pinnedFirst, togglePinned } from "../src/features/ai/components/useAiPinnedSessions";
import { hasUsage, usageText } from "../src/features/ai/components/AiTranscript";
import { listedProviders } from "../src/features/ai/components/aiHelpers";
import { AI_PROVIDERS } from "../src/types/ai.types";
import type { AiSession } from "../src/types/ai.types";

const session = (id: string) => ({ aiSessionId: id }) as AiSession;

describe("pinned sessions", () => {
  it("toggles ids", () => {
    expect(togglePinned([], "a")).toEqual(["a"]);
    expect(togglePinned(["a", "b"], "a")).toEqual(["b"]);
  });

  it("lists pinned sessions first, keeping relative order", () => {
    const sessions = [session("a"), session("b"), session("c")];
    expect(pinnedFirst(sessions, ["c"]).map((s) => s.aiSessionId)).toEqual(["c", "a", "b"]);
    expect(pinnedFirst(sessions, []).map((s) => s.aiSessionId)).toEqual(["a", "b", "c"]);
  });
});

describe("turn usage", () => {
  it("formats usage", () => {
    expect(hasUsage({})).toBe(false);
    expect(
      usageText({ inputTokens: 1200, cachedInputTokens: 500, outputTokens: 300, costUsd: 0.034 }),
    ).toBe("1.2k in (500 cached) · 300 out · $0.03");
  });
});

describe("providers", () => {
  it("lists gemini third", () => {
    expect(AI_PROVIDERS).toEqual(["claude", "codex", "gemini"]);
    expect(listedProviders(null)).toEqual(["claude", "codex", "gemini"]);
  });
});
