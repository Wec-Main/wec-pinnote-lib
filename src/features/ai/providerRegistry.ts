import { createElement, useId, type ComponentType } from "react";
import type { IconName } from "../../components/primitives/Icon";
import type { AiLoginMethod, AiModelInfo, AiProviderId } from "../../types/ai.types";

export type ProviderModelTier = "fast" | "balanced" | "strong";

export interface ProviderCatalogModel {
  id: string;
  label: string;
  family: string;
  version: number;
  tier: ProviderModelTier;
  description: string;
}

export interface ProviderSubscriptionAuth {
  title: string;
  description: string;
  icon: IconName;
  method: AiLoginMethod;
  deviceHelp?: {
    heading: string;
    settingsUrl: string;
    settingsLabel: string;
    toggleLabel: string;
  };
}

export interface ProviderApiKeyAuth {
  title: string;
  description: string;
  icon: IconName;
  name: string;
  placeholder: string;
  host: string;
  url: string;
}

export interface ProviderAuth {
  subscription?: ProviderSubscriptionAuth;
  apiKey?: ProviderApiKeyAuth;
}

export interface ArrangeableModelOption {
  model: AiModelInfo;
}

export interface ArrangedModels<T> {
  options: T[];
  primaryCount: number;
}

export interface ProviderCapabilities {
  supportsEffort: boolean;
  arrangeModels?: <T extends ArrangeableModelOption>(options: T[]) => ArrangedModels<T>;
}

export interface ProviderDescriptor {
  id: AiProviderId;
  label: string;
  signInLabel: string;
  description: string;
  Logo: ComponentType<{ size: number }>;
  auth: ProviderAuth;
  capabilities: ProviderCapabilities;
  staticModelCatalog?: ProviderCatalogModel[];
}

const registry = new Map<AiProviderId, ProviderDescriptor>();

export function registerProvider(descriptor: ProviderDescriptor): void {
  registry.set(descriptor.id, descriptor);
}

export function getProvider(id: string): ProviderDescriptor | undefined {
  return registry.get(id as AiProviderId);
}

export function listProviders(): ProviderDescriptor[] {
  return [...registry.values()];
}

export function listProviderIds(): AiProviderId[] {
  return [...registry.keys()];
}

export function isKnownProviderId(id: string): id is AiProviderId {
  return registry.has(id as AiProviderId);
}

const CLAUDE_MARK = {
  viewBox: "0 0 16 16",
  d: "m3.127 10.604 3.135-1.76.053-.153-.053-.085H6.11l-.525-.032-1.791-.048-1.554-.065-1.505-.08-.38-.081L0 7.832l.036-.234.32-.214.455.04 1.009.069 1.513.105 1.097.064 1.626.17h.259l.036-.105-.089-.065-.068-.064-1.566-1.062-1.695-1.121-.887-.646-.48-.327-.243-.306-.104-.67.435-.48.585.04.15.04.593.456 1.267.981 1.654 1.218.242.202.097-.068.012-.049-.109-.181-.9-1.626-.96-1.655-.428-.686-.113-.411a2 2 0 0 1-.068-.484l.496-.674L4.446 0l.662.089.279.242.411.94.666 1.48 1.033 2.014.302.597.162.553.06.17h.105v-.097l.085-1.134.157-1.392.154-1.792.052-.504.25-.605.497-.327.387.186.319.456-.045.294-.19 1.23-.37 1.93-.243 1.29h.142l.161-.16.654-.868 1.097-1.372.484-.545.565-.601.363-.287h.686l.505.751-.226.775-.707.895-.585.759-.839 1.13-.524.904.048.072.125-.012 1.897-.403 1.024-.186 1.223-.21.553.258.06.263-.218.536-1.307.323-1.533.307-2.284.54-.028.02.032.04 1.029.098.44.024h1.077l2.005.15.525.346.315.424-.053.323-.807.411-3.631-.863-.872-.218h-.12v.073l.726.71 1.331 1.202 1.667 1.55.084.383-.214.302-.226-.032-1.464-1.101-.565-.497-1.28-1.077h-.084v.113l.295.432 1.557 2.34.08.718-.112.234-.404.141-.444-.08-.911-1.28-.94-1.44-.759-1.291-.093.053-.448 4.821-.21.246-.484.186-.403-.307-.214-.496.214-.98.258-1.28.21-1.016.19-1.263.112-.42-.008-.028-.092.012-.953 1.307-1.448 1.957-1.146 1.227-.274.109-.477-.247.045-.44.266-.39 1.586-2.018.956-1.25.617-.723-.004-.105h-.036l-4.212 2.736-.75.096-.324-.302.04-.496.154-.162 1.267-.871z",
};

const CODEX_MARK = {
  viewBox: "0 0 24 24",
  d: "M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z",
};

const GEMINI_STAR =
  "M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12Z";

function PathLogo({ size, mark }: { size: number; mark: { viewBox: string; d: string } }) {
  return createElement(
    "svg",
    {
      viewBox: mark.viewBox,
      width: Math.round(size * 0.6),
      height: Math.round(size * 0.6),
      fill: "currentColor",
      fillRule: "evenodd",
    },
    createElement("path", { d: mark.d }),
  );
}

function ClaudeLogo({ size }: { size: number }) {
  return createElement(PathLogo, { size, mark: CLAUDE_MARK });
}

function CodexLogo({ size }: { size: number }) {
  return createElement(PathLogo, { size, mark: CODEX_MARK });
}

function GeminiLogo({ size }: { size: number }) {
  const id = useId().replace(/:/g, "");
  const px = Math.round(size * 0.6);
  return createElement(
    "svg",
    { viewBox: "0 0 24 24", width: px, height: px },
    createElement(
      "defs",
      null,
      createElement(
        "linearGradient",
        { id: `${id}-a`, x1: "3", y1: "21", x2: "21", y2: "3", gradientUnits: "userSpaceOnUse" },
        createElement("stop", { offset: "0", stopColor: "#4285F4" }),
        createElement("stop", { offset: "0.45", stopColor: "#9B72CB" }),
        createElement("stop", { offset: "0.75", stopColor: "#D96570" }),
        createElement("stop", { offset: "1", stopColor: "#F4B400" }),
      ),
      createElement(
        "radialGradient",
        { id: `${id}-b`, cx: "4", cy: "20", r: "10", gradientUnits: "userSpaceOnUse" },
        createElement("stop", { offset: "0", stopColor: "#34A853", stopOpacity: "0.9" }),
        createElement("stop", { offset: "1", stopColor: "#34A853", stopOpacity: "0" }),
      ),
    ),
    createElement("path", { d: GEMINI_STAR, fill: `url(#${id}-a)` }),
    createElement("path", { d: GEMINI_STAR, fill: `url(#${id}-b)` }),
  );
}

const PRIMARY_MODELS = 4;

const isFamily = (option: ArrangeableModelOption, family: string) =>
  `${option.model.id} ${option.model.label}`.toLowerCase().includes(family);

function arrangeClaudeModels<T extends ArrangeableModelOption>(options: T[]): ArrangedModels<T> {
  const haikuIndex = options.findIndex((option) => isFamily(option, "haiku"));
  const sonnetIndex = options.findIndex((option) => isFamily(option, "sonnet"));
  if (haikuIndex === -1 || sonnetIndex === -1) {
    return { options, primaryCount: PRIMARY_MODELS };
  }
  const arranged = options.slice();
  const [haiku] = arranged.splice(haikuIndex, 1);
  arranged.splice(
    arranged.findIndex((option) => isFamily(option, "sonnet")),
    0,
    haiku!,
  );
  const lastPinned = Math.max(
    arranged.findIndex((option) => isFamily(option, "sonnet")),
    arranged.indexOf(haiku!),
  );
  return { options: arranged, primaryCount: Math.max(PRIMARY_MODELS, lastPinned + 1) };
}

registerProvider({
  id: "claude",
  label: "Claude",
  signInLabel: "Claude",
  description: "Anthropic's coding agent",
  Logo: ClaudeLogo,
  auth: {
    subscription: {
      title: "Claude subscription",
      description: "Use your Pro or Max plan",
      icon: "sparkles",
      method: "link_paste",
    },
    apiKey: {
      title: "API key",
      description: "Pay as you go with an Anthropic Console key",
      icon: "key",
      name: "Anthropic API key",
      placeholder: "sk-ant-…",
      host: "console.anthropic.com",
      url: "https://console.anthropic.com/settings/keys",
    },
  },
  capabilities: {
    supportsEffort: true,
    arrangeModels: arrangeClaudeModels,
  },
  staticModelCatalog: [
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
      id: "claude-opus-5",
      label: "Opus 5",
      family: "Opus",
      version: 5,
      tier: "strong",
      description: "Best for everyday, complex tasks",
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
      id: "claude-opus-4-5",
      label: "Opus 4.5",
      family: "Opus",
      version: 4.5,
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
});

registerProvider({
  id: "codex",
  label: "Codex",
  signInLabel: "ChatGPT",
  description: "OpenAI's coding agent",
  Logo: CodexLogo,
  auth: {
    subscription: {
      title: "ChatGPT subscription",
      description: "Plus, Pro or Team",
      icon: "sparkles",
      method: "device_code",
      deviceHelp: {
        heading: 'ChatGPT says "Enable device code sign-in"?',
        settingsUrl: "https://chatgpt.com/#settings/Security",
        settingsLabel: "ChatGPT Security Settings",
        toggleLabel: "Connect with an API key instead",
      },
    },
    apiKey: {
      title: "API key",
      description: "OpenAI platform key",
      icon: "key",
      name: "OpenAI API key",
      placeholder: "sk-…",
      host: "platform.openai.com",
      url: "https://platform.openai.com/api-keys",
    },
  },
  capabilities: {
    supportsEffort: true,
  },
  staticModelCatalog: [
    {
      id: "gpt-6-astra",
      label: "GPT-6 Astra",
      family: "Astra",
      version: 6,
      tier: "strong",
      description: "Frontier intelligence for the most demanding work",
    },
    {
      id: "gpt-6.1-sol",
      label: "GPT-6.1 Sol",
      family: "Sol",
      version: 6.1,
      tier: "balanced",
      description: "Latest workhorse model for coding and everyday work",
    },
    {
      id: "gpt-6-sol",
      label: "GPT-6 Sol",
      family: "Sol",
      version: 6,
      tier: "balanced",
      description: "Previous generation workhorse model",
    },
    {
      id: "gpt-5.6-sol",
      label: "GPT-5.6 Sol",
      family: "Sol",
      version: 5.6,
      tier: "balanced",
      description: "Older generation workhorse model",
    },
    {
      id: "gpt-5.6-terra",
      label: "GPT-5.6 Terra",
      family: "Terra",
      version: 5.6,
      tier: "balanced",
      description: "Older balanced model for straightforward work",
    },
    {
      id: "gpt-6-luna",
      label: "GPT-6 Luna",
      family: "Luna",
      version: 6,
      tier: "fast",
      description: "Fast and affordable model for easier tasks",
    },
    {
      id: "gpt-5.6-luna",
      label: "GPT-5.6 Luna",
      family: "Luna",
      version: 5.6,
      tier: "fast",
      description: "Older fast and efficient model",
    },
    {
      id: "gpt-5.5",
      label: "GPT-5.5",
      family: "GPT-5.5",
      version: 5.5,
      tier: "balanced",
      description: "Legacy coding model",
    },
  ],
});

registerProvider({
  id: "gemini",
  label: "Gemini",
  signInLabel: "Google",
  description: "Google's coding agent",
  Logo: GeminiLogo,
  auth: {
    subscription: {
      title: "Google account",
      description: "Use your Gemini plan",
      icon: "sparkles",
      method: "link_paste",
    },
    apiKey: {
      title: "API key",
      description: "Google AI Studio key",
      icon: "key",
      name: "Gemini API key",
      placeholder: "AIza…",
      host: "aistudio.google.com",
      url: "https://aistudio.google.com/apikey",
    },
  },
  capabilities: {
    supportsEffort: true,
  },
  staticModelCatalog: [
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
});
