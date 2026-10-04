import type { AiMe } from "../../../types/ai.types";
import type { AiRoute } from "./aiHelpers";
import { AiModelSwitcher } from "./AiModelSwitcher";

interface AiRoutePickerProps {
  me: AiMe | null;
  value: AiRoute | null;
  onChange: (route: AiRoute) => void;
  disabled?: boolean;
}

export function AiRoutePicker({ me, value, onChange, disabled = false }: AiRoutePickerProps) {
  return (
    <AiModelSwitcher
      me={me}
      value={value}
      onChange={onChange}
      persist={false}
      disabled={disabled}
      compact
      placement="top"
    />
  );
}
