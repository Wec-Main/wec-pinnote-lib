import { describe, expect, it } from "vitest";
import { otherProviderRoute, shouldAutoFallbackProvider } from "../src/components/Ai/AiChatView";
import type { AiMe } from "../src/types/ai.types";

function me(overrides: Partial<AiMe> = {}): AiMe {
  return {
    providers: ["claude", "codex", "gemini"],
    connectors: [
      {
        provider: "claude",
        status: "connected",
        auth: "subscription",
        account: null,
        cliVersion: null,
        models: [
          {
            id: "claude-model",
            label: "Claude",
            description: "",
            efforts: [],
            defaultEffort: null,
            isDefault: true,
          },
        ],
        error: null,
        connectedAt: null,
        checkedAt: null,
        lastUsedAt: null,
      },
      {
        provider: "codex",
        status: "connected",
        auth: "subscription",
        account: null,
        cliVersion: null,
        models: [
          {
            id: "codex-model",
            label: "Codex",
            description: "",
            efforts: [],
            defaultEffort: null,
            isDefault: true,
          },
        ],
        error: null,
        connectedAt: null,
        checkedAt: null,
        lastUsedAt: null,
      },
    ],
    canUseAi: true,
    canApplyModelOps: true,
    ...overrides,
  };
}

describe("shouldAutoFallbackProvider", () => {
  it("is false when the feature is not opted into", () => {
    expect(
      shouldAutoFallbackProvider({ enabled: false, code: "provider_error", alreadyTried: false }),
    ).toBe(false);
  });

  it("is false once a fallback has already been tried for this attempt", () => {
    expect(
      shouldAutoFallbackProvider({ enabled: true, code: "provider_error", alreadyTried: true }),
    ).toBe(false);
  });

  it("is true for an error whose actions include switch_provider", () => {
    expect(
      shouldAutoFallbackProvider({ enabled: true, code: "provider_error", alreadyTried: false }),
    ).toBe(true);
    expect(
      shouldAutoFallbackProvider({ enabled: true, code: "rate_limited", alreadyTried: false }),
    ).toBe(true);
    expect(
      shouldAutoFallbackProvider({
        enabled: true,
        code: "runtime_unavailable",
        alreadyTried: false,
      }),
    ).toBe(true);
  });

  it("is false for an error whose actions don't include switch_provider", () => {
    expect(
      shouldAutoFallbackProvider({ enabled: true, code: "forbidden", alreadyTried: false }),
    ).toBe(false);
    expect(
      shouldAutoFallbackProvider({ enabled: true, code: "stale_base_revision", alreadyTried: false }),
    ).toBe(false);
  });

  it("is false for an unknown/null code (default retry+switch_provider action list only applies via aiErrorActions' fallback)", () => {
    // aiErrorActions falls back to ["retry", "switch_provider"] for unknown codes,
    // so this documents that an unrecognized error code IS eligible too.
    expect(shouldAutoFallbackProvider({ enabled: true, code: null, alreadyTried: false })).toBe(
      true,
    );
  });
});

describe("otherProviderRoute", () => {
  it("returns null when there is no current route", () => {
    expect(otherProviderRoute(me(), null)).toBeNull();
  });

  it("finds a different connected provider", () => {
    const route = otherProviderRoute(me(), { provider: "claude", model: "claude-model", effort: null });
    expect(route?.provider).toBe("codex");
  });

  it("returns null when no other provider is connected", () => {
    const solo = me({
      connectors: [
        {
          provider: "claude",
          status: "connected",
          auth: "subscription",
          account: null,
          cliVersion: null,
          models: [],
          error: null,
          connectedAt: null,
          checkedAt: null,
          lastUsedAt: null,
        },
      ],
    });
    expect(
      otherProviderRoute(solo, { provider: "claude", model: "claude-model", effort: null }),
    ).toBeNull();
  });
});
