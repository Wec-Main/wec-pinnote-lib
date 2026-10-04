import { describe, expect, it } from "vitest";
import {
  CONNECT_AGENT_HINT,
  aiReady,
  connectAgentHint,
  connectedProviders,
  effectiveConnector,
  modelsFor,
  resolveRoute,
} from "../src/features/ai/components/aiHelpers";
import { connectorAccountText, usageText } from "../src/features/ai/components/ProviderCard";
import { mergeAiMeConnectors } from "../src/features/ai/AiRuntimeContext";
import type { AiConnector, AiMe, AiProviderId } from "../src/types/ai.types";
import { parseAiStreamEvent } from "../src/utils/ai/aiStreamGuards";

function row(
  provider: AiProviderId,
  status: AiConnector["status"],
  overrides: Partial<AiConnector> = {},
): AiConnector {
  return {
    provider,
    status,
    auth: status === "connected" ? "subscription" : null,
    account: null,
    cliVersion: null,
    models: [
      {
        id: `${provider}-model`,
        label: "M",
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
    ...overrides,
  };
}

function me(overrides: Partial<AiMe> = {}): AiMe {
  return {
    providers: ["claude", "codex"],
    connectors: [row("claude", "signed_out"), row("codex", "signed_out")],
    canUseAi: true,
    canApplyModelOps: true,
    ...overrides,
  };
}

describe("effectiveConnector", () => {
  it("uses the user's own connector only when it is connected", () => {
    const one = me({ connectors: [row("claude", "connected"), row("codex", "error")] });
    expect(effectiveConnector(one, "claude")?.provider).toBe("claude");
    expect(effectiveConnector(one, "codex")).toBeNull();
    expect(effectiveConnector(null, "claude")).toBeNull();
  });

  it("drives readiness, providers and models from personal connectors", () => {
    expect(aiReady(me())).toBe(false);
    const codex = me({ connectors: [row("claude", "signed_out"), row("codex", "connected")] });
    expect(aiReady(codex)).toBe(true);
    expect(connectedProviders(codex)).toEqual(["codex"]);
    expect(modelsFor(codex, "codex").map((model) => model.id)).toEqual(["codex-model"]);
    expect(modelsFor(codex, "claude")).toEqual([]);
    expect(resolveRoute(codex, { provider: "claude", model: null, effort: null })).toEqual({
      provider: "codex",
      model: "codex-model",
      effort: null,
    });
    expect(aiReady({ ...codex, providers: ["claude"] })).toBe(false);
    expect(aiReady({ ...codex, canUseAi: false })).toBe(false);
  });

  it("asks everyone to connect their own agent", () => {
    expect(connectAgentHint(me())).toBe(CONNECT_AGENT_HINT);
    expect(connectAgentHint(me({ canManageAiTemplates: true }))).toBe(CONNECT_AGENT_HINT);
    expect(CONNECT_AGENT_HINT).not.toMatch(/everyone|admin/i);
  });

  it("describes whether a card uses the user's account", () => {
    expect(usageText(row("claude", "connected"))).toEqual({
      tone: "user",
      text: "Using your account",
    });
    expect(usageText(row("claude", "signed_out"))).toEqual({ tone: "none", text: "Not connected" });
    expect(usageText(null)).toEqual({ tone: "none", text: "Not connected" });
    expect(connectorAccountText(row("codex", "connected", { auth: "api_key" }))).toBe(
      "Your API key",
    );
  });
});

describe("connector merges", () => {
  it("replaces the user's connector rows by provider", () => {
    const base = me();
    const merged = mergeAiMeConnectors(base, [row("codex", "connected")]);
    expect(merged.connectors.map((c) => c.status)).toEqual(["signed_out", "connected"]);
    expect(base.connectors.map((c) => c.status)).toEqual(["signed_out", "signed_out"]);
  });
});

describe("connector stream events", () => {
  it("accepts ai_connectors.updated and ai_connector_login.updated", () => {
    expect(
      parseAiStreamEvent(
        "ai_connectors.updated",
        JSON.stringify({ type: "ai_connectors.updated", connectors: [row("claude", "connected")] }),
      ),
    ).not.toBeNull();
    expect(
      parseAiStreamEvent(
        "ai_connectors.updated",
        JSON.stringify({ type: "ai_connectors.updated", connectors: "nope" }),
      ),
    ).toBeNull();
    const login = {
      type: "ai_connector_login.updated",
      loginId: "L1",
      provider: "claude",
      state: "succeeded",
      error: null,
      connector: row("claude", "connected"),
    };
    expect(parseAiStreamEvent("ai_connector_login.updated", JSON.stringify(login))).toEqual(login);
    expect(
      parseAiStreamEvent("ai_connector_login.updated", JSON.stringify({ ...login, loginId: "" })),
    ).toBeNull();
  });
});
