import { describe, expect, it } from "vitest";
import {
  AI_DIALOG_HEIGHT,
  AI_DIALOG_WIDTH,
  anchorDialog,
  clampDialog,
  suggestionsFor,
} from "../src/components/Ai/AiFloatingButton";
import {
  isNearBottom,
  resolveToolStatus,
  restoredScrollTop,
  shouldAutoScroll,
  turnFailureText,
} from "../src/components/Ai/AiTranscript";
import {
  AI_ERROR_TEXT,
  aiErrorActions,
  aiErrorCode,
  describeAiError,
  enabledProviders,
  listedProviders,
  providerLabel,
} from "../src/components/Ai/aiHelpers";
import { AnnotationApiError } from "../src/types/annotation.types";
import type { AiMe, AiTurn } from "../src/types/ai.types";

const turn = (overrides: Partial<AiTurn>): AiTurn => ({
  aiTurnId: "t1",
  aiSessionId: "s1",
  userId: "u1",
  userName: null,
  provider: "claude",
  model: "m",
  effort: null,
  mode: "model",
  status: "failed",
  errorCode: null,
  errorMessage: null,
  usage: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

describe("transcript auto-scroll rule", () => {
  it("is near the bottom within the threshold only", () => {
    expect(isNearBottom({ scrollTop: 920, scrollHeight: 1000, clientHeight: 0 })).toBe(true);
    expect(isNearBottom({ scrollTop: 600, scrollHeight: 1000, clientHeight: 320 })).toBe(true);
    expect(isNearBottom({ scrollTop: 500, scrollHeight: 1000, clientHeight: 320 })).toBe(false);
    expect(isNearBottom({ scrollTop: 0, scrollHeight: 300, clientHeight: 300 })).toBe(true);
  });

  it("follows new content only near the bottom, or for your own new message", () => {
    expect(shouldAutoScroll(true, false)).toBe(true);
    expect(shouldAutoScroll(false, false)).toBe(false);
    expect(shouldAutoScroll(false, true)).toBe(true);
  });

  it("keeps the visible message in place when older messages load above", () => {
    expect(restoredScrollTop({ scrollTop: 40, scrollHeight: 1000 }, 1600)).toBe(640);
    expect(restoredScrollTop({ scrollTop: 0, scrollHeight: 1000 }, 900)).toBe(0);
  });
});

describe("tool chips", () => {
  it("resolve when the turn is no longer active", () => {
    expect(resolveToolStatus("running", true, undefined)).toBe("running");
    expect(resolveToolStatus("running", false, undefined)).toBe("stopped");
    expect(resolveToolStatus("running", false, turn({ status: "failed" }))).toBe("failed");
    expect(resolveToolStatus("running", false, turn({ status: "interrupted" }))).toBe("stopped");
    expect(resolveToolStatus("ok", false, undefined)).toBe("done");
    expect(resolveToolStatus("error", true, undefined)).toBe("failed");
  });
});

describe("AI error codes", () => {
  it("reads the code from the top level, then details, then a regex fallback", () => {
    expect(aiErrorCode(new AnnotationApiError("x", 409, '{"code":"rate_limited"}'))).toBe(
      "rate_limited",
    );
    expect(
      aiErrorCode(
        new AnnotationApiError("x", 409, '{"error":"x","details":{"code":"connector_required"}}'),
      ),
    ).toBe("connector_required");
    expect(aiErrorCode(new AnnotationApiError("runner_lost while working", 500, "oops"))).toBe(
      "runner_lost",
    );
    expect(aiErrorCode(new AnnotationApiError("Too many", 429, null))).toBe("rate_limited");
    expect(aiErrorCode({ code: "internal" })).toBe("internal");
    expect(aiErrorCode(new Error("plain"))).toBeNull();
  });

  it("has friendly text for every known code", () => {
    for (const code of [
      "provider_error",
      "internal",
      "session_reset",
      "session_not_found",
      "interrupted",
      "rate_limited",
      "runtime_busy",
      "runner_lost",
      "auth_expired",
      "connector_required",
    ]) {
      expect(AI_ERROR_TEXT[code]).toBeTruthy();
    }
    expect(describeAiError(new AnnotationApiError("x", 500, '{"code":"internal"}'))).toBe(
      AI_ERROR_TEXT.internal,
    );
    expect(turnFailureText(turn({ errorCode: "session_reset" }))).toBe(AI_ERROR_TEXT.session_reset);
    expect(turnFailureText(turn({ errorCode: "weird", errorMessage: "Raw" }))).toBe("Raw");
    expect(turnFailureText(turn({ status: "interrupted" }))).toBe("Stopped.");
  });

  it("maps codes to actions", () => {
    expect(aiErrorActions("auth_expired")).toEqual(["integrations", "switch_provider"]);
    expect(aiErrorActions("rate_limited")).toEqual(["retry", "switch_provider"]);
    expect(aiErrorActions("forbidden")).toEqual([]);
    expect(aiErrorActions("runner_lost")).toEqual(["retry"]);
    expect(aiErrorActions("internal")).toEqual(["retry", "switch_provider"]);
    expect(aiErrorActions(null)).toEqual(["retry", "switch_provider"]);
  });
});

describe("providers", () => {
  const me = (providers: AiMe["providers"]): AiMe => ({
    providers,
    connectors: [],
    canUseAi: true,
    canApplyModelOps: true,
  });

  it("does not depend on the order the server sends", () => {
    expect(enabledProviders(me(["codex", "claude"]))).toEqual(["claude", "codex"]);
    expect(enabledProviders(me(["gemini", "codex", "claude"]))).toEqual([
      "claude",
      "codex",
      "gemini",
    ]);
    expect(listedProviders(me(["gemini"]))).toEqual(["claude", "codex", "gemini"]);
    expect(providerLabel("gemini")).toBe("Gemini");
    expect(providerLabel("mistral")).toBe("Mistral");
  });
});

describe("floating dialog geometry", () => {
  const viewport = { width: 1280, height: 900 };

  it("anchors 420x640 above the button, right aligned", () => {
    const rect = anchorDialog({ x: 1208, y: 828, size: 52 }, viewport);
    expect(rect).toEqual({
      left: 1208 + 52 - AI_DIALOG_WIDTH,
      top: 828 - 12 - AI_DIALOG_HEIGHT,
      width: AI_DIALOG_WIDTH,
      height: AI_DIALOG_HEIGHT,
    });
  });

  it("opens below a button near the top and stays inside the viewport", () => {
    const rect = anchorDialog({ x: 20, y: 20, size: 52 }, viewport);
    expect(rect.top).toBe(20 + 52 + 12);
    expect(rect.left).toBe(12);
    const small = anchorDialog({ x: 500, y: 300, size: 52 }, { width: 600, height: 500 });
    expect(small.height).toBe(476);
    expect(small.top).toBe(12);
  });

  it("re-clamps a dragged dialog when the window shrinks", () => {
    expect(
      clampDialog({ left: 900, top: 300, width: 420, height: 640 }, { width: 1000, height: 700 }),
    ).toEqual({ left: 568, top: 48, width: 420, height: 640 });
  });

  it("picks suggestions for the current surface", () => {
    expect(suggestionsFor("erd")[0]?.title).toMatch(/data model/i);
    expect(suggestionsFor("flow")[0]?.title).toMatch(/flow/i);
    expect(suggestionsFor("comments")[0]?.title).toMatch(/comments/i);
  });
});
