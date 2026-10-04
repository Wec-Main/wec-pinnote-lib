import type { Annotation } from "../../types/annotation.types";

export function annotationLabel(annotation: Annotation): string {
  if (annotation.path) {
    const segments = annotation.path.split(" > ");
    const last = segments[segments.length - 1];
    if (last) {
      return last;
    }
  }
  return annotation.anchor.elementIdentifier.replace(/[-_]/g, " ");
}
