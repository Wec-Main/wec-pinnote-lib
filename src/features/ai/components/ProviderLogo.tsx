import { getProvider } from "../providerRegistry";
import type { AiProviderId } from "../../../types/ai.types";

export type ProviderLogoId = AiProviderId;

interface ProviderLogoProps {
  provider: ProviderLogoId;
  size?: number;
  className?: string;
}

export function ProviderLogo({ provider, size = 32, className }: ProviderLogoProps) {
  const descriptor = getProvider(provider);
  if (!descriptor) return null;
  const Logo = descriptor.Logo;
  return (
    <span
      className={["wpn-ai-logo", `wpn-ai-logo--${provider}`, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Logo size={size} />
    </span>
  );
}
