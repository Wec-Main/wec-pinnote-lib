import type { AiMe, AiModelInfo, AiProviderId } from "../../../types/ai.types";
import { connectedProviders, effectiveConnector } from "../aiHelpers";

export type ModelTier = "fast" | "balanced" | "strong";

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

interface StaticModel {
  id: string;
  label: string;
  family: string;
  version: number;
  tier: ModelTier;
  description: string;
}

const STATIC_MODELS: Record<AiProviderId, StaticModel[]> = {
  claude: [
    {
      id: "claude-fable-5-1",
      label: "Fable 5.1",
      family: "Fable",
      version: 5.1,
      tier: "strong",
      description: "For your toughest challenges",
    },
    {
      id: "claude-fable-5",
      label: "Fable 5",
      family: "Fable",
      version: 5,
      tier: "strong",
      description: "Most capable for your hardest and longest-running tasks",
    },
    {
      id: "claude-opus-5-5",
      label: "Opus 5.5",
      family: "Opus",
      version: 5.5,
      tier: "strong",
      description: "For complex work and everyday tasks",
    },
    {
      id: "claude-opus-4-8",
      label: "Opus 4.8",
      family: "Opus",
      version: 4.8,
      tier: "strong",
      description: "Best for everyday, complex tasks",
    },
    {
      id: "claude-opus-4-7",
      label: "Opus 4.7",
      family: "Opus",
      version: 4.7,
      tier: "strong",
      description: "Best for everyday, complex tasks",
    },
    {
      id: "claude-opus-4-6",
      label: "Opus 4.6",
      family: "Opus",
      version: 4.6,
      tier: "strong",
      description: "Best for everyday, complex tasks",
    },
    {
      id: "claude-sonnet-5-5",
      label: "Sonnet 5.5",
      family: "Sonnet",
      version: 5.5,
      tier: "balanced",
      description: "Most efficient for simpler tasks",
    },
    {
      id: "claude-sonnet-5",
      label: "Sonnet 5",
      family: "Sonnet",
      version: 5,
      tier: "balanced",
      description: "Efficient for routine tasks",
    },
    {
      id: "claude-sonnet-4-6",
      label: "Sonnet 4.6",
      family: "Sonnet",
      version: 4.6,
      tier: "balanced",
      description: "Efficient for routine tasks",
    },
    {
      id: "claude-haiku-4-5-20251001",
      label: "Haiku 4.5",
      family: "Haiku",
      version: 4.5,
      tier: "fast",
      description: "Fastest for quick answers",
    },
  ],
  codex: [
    {
      id: "gpt-5.3-codex",
      label: "GPT-5.3 Codex",
      family: "GPT-5 Codex",
      version: 5.3,
      tier: "strong",
      description: "Most capable Codex model for agentic coding",
    },
    {
      id: "gpt-5.2-codex",
      label: "GPT-5.2 Codex",
      family: "GPT-5 Codex",
      version: 5.2,
      tier: "strong",
      description: "Capable Codex model for complex work",
    },
    {
      id: "gpt-5.1-codex-max",
      label: "GPT-5.1 Codex Max",
      family: "GPT-5 Codex",
      version: 5.11,
      tier: "strong",
      description: "Deepest reasoning for long-running tasks",
    },
    {
      id: "gpt-5.1-codex",
      label: "GPT-5.1 Codex",
      family: "GPT-5 Codex",
      version: 5.1,
      tier: "balanced",
      description: "Balanced Codex model for everyday tasks",
    },
    {
      id: "gpt-5-codex",
      label: "GPT-5 Codex",
      family: "GPT-5 Codex",
      version: 5,
      tier: "balanced",
      description: "Efficient for routine coding tasks",
    },
    {
      id: "gpt-5.1-codex-mini",
      label: "GPT-5.1 Codex Mini",
      family: "GPT-5 Codex Mini",
      version: 5.1,
      tier: "fast",
      description: "Fastest for quick answers",
    },
    {
      id: "gpt-5-codex-mini",
      label: "GPT-5 Codex Mini",
      family: "GPT-5 Codex Mini",
      version: 5,
      tier: "fast",
      description: "Smaller and cheaper for simple tasks",
    },
  ],
  gemini: [
    {
      id: "gemini-3.1-pro-preview",
      label: "Gemini 3.1 Pro",
      family: "Pro",
      version: 3.1,
      tier: "strong",
      description: "Most capable Gemini model (preview)",
    },
    {
      id: "gemini-3-pro-preview",
      label: "Gemini 3 Pro",
      family: "Pro",
      version: 3,
      tier: "strong",
      description: "Advanced reasoning (preview)",
    },
    {
      id: "gemini-2.5-pro",
      label: "Gemini 2.5 Pro",
      family: "Pro",
      version: 2.5,
      tier: "strong",
      description: "Stable Pro model with deep reasoning",
    },
    {
      id: "gemini-3.8-flash",
      label: "Gemini 3.8 Flash",
      family: "Flash",
      version: 3.8,
      tier: "balanced",
      description: "Latest Flash: fast with strong quality",
    },
    {
      id: "gemini-3.5-flash",
      label: "Gemini 3.5 Flash",
      family: "Flash",
      version: 3.5,
      tier: "balanced",
      description: "Fast and efficient for everyday tasks",
    },
    {
      id: "gemini-3-flash-preview",
      label: "Gemini 3 Flash",
      family: "Flash",
      version: 3,
      tier: "balanced",
      description: "Fast and efficient (preview)",
    },
    {
      id: "gemini-2.5-flash",
      label: "Gemini 2.5 Flash",
      family: "Flash",
      version: 2.5,
      tier: "balanced",
      description: "Efficient for routine tasks",
    },
    {
      id: "gemini-3.5-flash-lite",
      label: "Gemini 3.5 Flash-Lite",
      family: "Flash-Lite",
      version: 3.5,
      tier: "fast",
      description: "Fastest and cheapest for quick answers",
    },
    {
      id: "gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash-Lite",
      family: "Flash-Lite",
      version: 3.1,
      tier: "fast",
      description: "Fast and cheap for simple tasks",
    },
    {
      id: "gemini-2.5-flash-lite",
      label: "Gemini 2.5 Flash-Lite",
      family: "Flash-Lite",
      version: 2.5,
      tier: "fast",
      description: "Lightweight for simple tasks",
    },
  ],
};

const PROVIDERS: AiProviderId[] = ["claude", "codex", "gemini"];

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
  return PROVIDERS.map((provider) => {
    const models = new Map<string, CatalogModel>();
    for (const item of STATIC_MODELS[provider]) {
      models.set(item.id, { ...item, live: false });
    }
    const liveModels = effectiveConnector(me, provider)?.models ?? [];
    for (const info of liveModels) {
      if (info.id === "default") continue;
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
