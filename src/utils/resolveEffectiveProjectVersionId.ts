export function resolveEffectiveProjectVersionId(
  hostOverride: string | undefined,
  liveCurrentVersionId: string | undefined,
): string | undefined {
  return hostOverride ?? liveCurrentVersionId;
}
