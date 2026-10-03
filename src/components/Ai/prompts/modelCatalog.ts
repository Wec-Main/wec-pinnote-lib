import { isValidModelId } from "../../../ai/modelValidation";
import { listProviders, type ProviderModelTier } from "../../../ai/providerRegistry";
import type { AiMe, AiModelInfo, AiProviderId } from "../../../types/ai.types";
import { connectedProviders, effectiveConnector } from "../aiHelpers";

export type ModelTier = ProviderModelTier;

export const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  strong: "Most capable",
};

export const TIER_HINTS: Record<ModelTier, string> = {
  fast: "Quick and low cost. Best for short, simple tasks.",
  balanced: "Good quality at a reasonable speed. Best for everyday work.",
  strong: "Slowest and most thorough. Best for complex, high-stakes output.",
};

export interface CatalogModel {
  id: string;
  label: string;
  family: string;
  version: number;
  tier: ModelTier;
  description: string;
  live: boolean;
}

export interface ModelFamily {
  family: string;
  models: CatalogModel[];
}

export interface ProviderCatalog {
  provider: AiProviderId;
  connected: boolean;
  families: ModelFamily[];
}

export function tierOf(id: string, label = ""): ModelTier {
  const text = `${id} ${label}`.toLowerCase();
  if (/(haiku|mini|lite|nano)/.test(text)) return "fast";
  if (/flash/.test(text)) return "balanced";
  if (/(opus|fable|pro|max|ultra)/.test(text)) return "strong";
  return "balanced";
}

export function versionOf(id: string, label = ""): number {
  const match = `${label} ${id}`.match(/(\d+(?:[.-]\d+)?)/);
  return match?.[1] ? Number(match[1].replace("-", ".")) : 0;
}

function familyOf(id: string, label: string): string {
  const text = `${id} ${label}`.toLowerCase();
  for (const name of ["opus", "fable", "sonnet", "haiku"]) {
    if (text.includes(name)) return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (/flash-?lite/.test(text)) return "Flash-Lite";
  if (text.includes("flash")) return "Flash";
  if (text.includes("pro")) return "Pro";
  if (text.includes("mini")) return "Mini";
  return "Other";
}

function fromLive(info: AiModelInfo): CatalogModel {
  return {
    id: info.id,
    label: info.label,
    family: familyOf(info.id, info.label),
    version: versionOf(info.id, info.label),
    tier: tierOf(info.id, info.label),
    description: info.description,
    live: true,
  };
}

export function buildProviderCatalogs(me: AiMe | null | undefined): ProviderCatalog[] {
  const connected = new Set(connectedProviders(me));
  return listProviders().map((descriptor) => {
    const provider = descriptor.id;
    const models = new Map<string, CatalogModel>();
    for (const item of descriptor.staticModelCatalog ?? []) {
      models.set(item.id, { ...item, live: false });
    }
    const liveModels = effectiveConnector(me, provider)?.models ?? [];
    for (const info of liveModels) {
      if (info.id === "default" || !isValidModelId(info.id)) continue;
      const live = fromLive(info);
      const known = models.get(info.id);
      models.set(info.id, known ? { ...known, live: true, description: known.description } : live);
    }
    const byFamily = new Map<string, CatalogModel[]>();
    for (const model of models.values()) {
      byFamily.set(model.family, [...(byFamily.get(model.family) ?? []), model]);
    }
    const families = [...byFamily.entries()]
      .map(([family, list]) => ({
        family,
        models: list.sort((a, b) => b.version - a.version),
      }))
      .sort((a, b) => (b.models[0]?.version ?? 0) - (a.models[0]?.version ?? 0));
    return { provider, connected: connected.has(provider), families };
  });
}

export function pickRecommended(
  catalog: ProviderCatalog | undefined,
  tier: ModelTier,
): CatalogModel | null {
  const all = catalog?.families.flatMap((family) => family.models) ?? [];
  const sameTier = all.filter((model) => model.tier === tier).sort((a, b) => b.version - a.version);
  return sameTier[0] ?? null;
}
