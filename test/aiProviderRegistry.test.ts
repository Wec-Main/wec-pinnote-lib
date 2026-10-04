import { describe, expect, it } from "vitest";
import {
  getProvider,
  isKnownProviderId,
  listProviderIds,
  listProviders,
  registerProvider,
  type ProviderDescriptor,
} from "../src/ai/providerRegistry";

describe("providerRegistry", () => {
  it("registers claude, codex and gemini as built-ins", () => {
    expect(listProviderIds().sort()).toEqual(["claude", "codex", "gemini"]);
  });

  it("looks up a descriptor by id", () => {
    const claude = getProvider("claude");
    expect(claude?.label).toBe("Claude");
    expect(claude?.signInLabel).toBe("Claude");
    expect(claude?.auth.subscription?.title).toBe("Claude subscription");
    expect(claude?.auth.apiKey?.host).toBe("console.anthropic.com");
  });

  it("returns undefined for an unknown provider id", () => {
    expect(getProvider("not-a-provider")).toBeUndefined();
  });

  it("reports known provider ids", () => {
    expect(isKnownProviderId("codex")).toBe(true);
    expect(isKnownProviderId("not-a-provider")).toBe(false);
  });

  it("gives codex a device-flow sign-in label and help copy", () => {
    const codex = getProvider("codex");
    expect(codex?.signInLabel).toBe("ChatGPT");
    expect(codex?.auth.subscription?.method).toBe("device_code");
    expect(codex?.auth.subscription?.deviceHelp?.settingsUrl).toContain("chatgpt.com");
  });

  it("carries a static model catalog for every built-in provider", () => {
    for (const descriptor of listProviders()) {
      expect(descriptor.staticModelCatalog?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it("only arranges models for providers that declare it (claude)", () => {
    expect(getProvider("claude")?.capabilities.arrangeModels).toBeTypeOf("function");
    expect(getProvider("codex")?.capabilities.arrangeModels).toBeUndefined();
    expect(getProvider("gemini")?.capabilities.arrangeModels).toBeUndefined();
  });

  it("pins haiku next to sonnet and extends the primary count", () => {
    const arrange = getProvider("claude")?.capabilities.arrangeModels;
    expect(arrange).toBeDefined();
    const options = [
      { model: { id: "claude-opus-5-5", label: "Opus 5.5" } },
      { model: { id: "claude-haiku-4-5", label: "Haiku 4.5" } },
      { model: { id: "claude-sonnet-5-5", label: "Sonnet 5.5" } },
    ] as never[];
    const result = arrange!(options);
    expect(result.options.map((o: { model: { id: string } }) => o.model.id)).toEqual([
      "claude-opus-5-5",
      "claude-haiku-4-5",
      "claude-sonnet-5-5",
    ]);
    expect(result.primaryCount).toBeGreaterThanOrEqual(3);
  });

  it("lets a caller register an additional provider without disturbing the built-ins", () => {
    const extra: ProviderDescriptor = {
      id: "codex",
      label: "Codex (test override)",
      signInLabel: "Codex",
      description: "overridden for this test",
      Logo: () => null,
      auth: {},
      capabilities: { supportsEffort: false },
    };
    const before = getProvider("codex");
    registerProvider(extra);
    expect(getProvider("codex")?.label).toBe("Codex (test override)");
    registerProvider(before!);
    expect(getProvider("codex")?.label).toBe("Codex");
  });
});
