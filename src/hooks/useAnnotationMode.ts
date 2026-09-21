import { useAnnotationContext } from "../context/AnnotationContext";

export function useAnnotationMode() {
  const context = useAnnotationContext();

  return {
    enabled: context.modeEnabled,
    setEnabled: context.setModeEnabled,
    toggle: () => context.setModeEnabled(!context.modeEnabled),
  };
}
