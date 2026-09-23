import { useEffect, useRef, type FC } from "react";
import "../../styles/context-menu.css";

export interface ContextMenuAction {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

export interface ContextMenuProps {
  left: number;
  top: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ContextMenu: FC<ContextMenuProps> = ({ left, top, actions, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="wec-flow-context-menu"
      style={{ left, top }}
      role="menu"
    >
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          role="menuitem"
          className={[
            "wec-flow-context-menu__item",
            action.danger ? "wec-flow-context-menu__item--danger" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => {
            action.onSelect();
            onClose();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;
