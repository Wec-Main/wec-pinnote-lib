import { Tooltip } from "../primitives";

interface TagPinProps {
  name: string;
  color: string;
  x: number;
  y: number;
  resolvedTarget: boolean;
  onRemove?: () => void;
}

export function TagPin({ name, color, x, y, resolvedTarget, onRemove }: TagPinProps) {
  return (
    <Tooltip label={onRemove ? `${name} — click to remove` : name} placement="bottom">
      <button
        type="button"
        className={["wpn-tag-pin", resolvedTarget ? "" : "wpn-tag-pin--orphaned"]
          .filter(Boolean)
          .join(" ")}
        style={{ left: x, top: y, backgroundColor: color }}
        aria-label={name}
        onClick={onRemove}
      >
        <span className="wpn-tag-pin__label">{name}</span>
      </button>
    </Tooltip>
  );
}
