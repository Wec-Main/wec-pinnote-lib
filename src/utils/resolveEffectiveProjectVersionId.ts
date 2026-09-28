// A host embedding the widget can pin a specific version via
// AnnotationConfig.projectVersionId; when it doesn't, every version-scoped
// fetch/create must fall back to the project's live current version so that
// activating a different version in Settings -> Versioning is reflected
// without a page reload.
export function resolveEffectiveProjectVersionId(
  hostOverride: string | undefined,
  liveCurrentVersionId: string | undefined,
): string | undefined {
  return hostOverride ?? liveCurrentVersionId;
}
