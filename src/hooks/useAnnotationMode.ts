import { useAnnotationSelector } from "../context/AnnotationContext";

export function useAnnotationMode() {
  const enabled = useAnnotationSelector((state) => state.modeEnabled);
  const setEnabled = useAnnotationSelector((state) => state.setModeEnabled);

  return {
    enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
  };
}
