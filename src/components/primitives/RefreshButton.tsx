import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

interface RefreshButtonProps {
  label: string;
  loading?: boolean;
  onRefresh: () => void;
}

export function RefreshButton({ label, loading = false, onRefresh }: RefreshButtonProps) {
  return (
    <Tooltip label={loading ? "Refreshing..." : "Refresh"} placement="bottom">
      <button
        type="button"
        className="wpn-refresh-btn"
        aria-label={label}
        aria-busy={loading}
        disabled={loading}
        onClick={onRefresh}
      >
        <Icon
          name="refresh"
          className={["wpn-refresh-btn__icon", loading ? "wpn-icon-btn__icon--spinning" : ""]
            .filter(Boolean)
            .join(" ")}
        />
        {loading ? "Refreshing" : "Refresh"}
      </button>
    </Tooltip>
  );
}
