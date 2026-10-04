import { describe, expect, it } from "vitest";
import { AI_EFFORTS, isAiEffort, isValidModelId } from "../src/features/ai/modelValidation";
import { buildProviderCatalogs } from "../src/features/ai/components/prompts/modelCatalog";
import { TEMPLATE_EFFORTS } from "../src/features/ai/components/promptTemplateLogic";

describe("model and effort validation", () => {
  it("matches the server effort enum", () => {
    expect([...AI_EFFORTS]).toEqual([
      "default",
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "max",
    ]);
    expect(TEMPLATE_EFFORTS).toBe(AI_EFFORTS);
    expect(isAiEffort("xhigh")).toBe(true);
    expect(isAiEffort("ultra")).toBe(false);
  });

  it("accepts the server charset and rejects the rest", () => {
    expect(isValidModelId("claude-opus-4-8")).toBe(true);
    expect(isValidModelId("org/model:v1@2[x]")).toBe(true);
    expect(isValidModelId("-leading")).toBe(false);
    expect(isValidModelId("has space")).toBe(false);
    expect(isValidModelId("")).toBe(false);
    expect(isValidModelId("a".repeat(101))).toBe(false);
  });

  it("keeps every static catalog model valid", () => {
    for (const catalog of buildProviderCatalogs(null)) {
      for (const family of catalog.families) {
        for (const model of family.models) expect(isValidModelId(model.id)).toBe(true);
      }
    }
  });
});
