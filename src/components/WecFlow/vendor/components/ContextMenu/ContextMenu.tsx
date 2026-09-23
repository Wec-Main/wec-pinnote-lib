import { useEffect, useLayoutEffect, useRef, useState, type FC, type RefObject } from "react";
import { Icon, type IconName } from "../../../../primitives";
import "../../styles/context-menu.css";

const VIEWPORT_MARGIN = 8;

function clampIntoViewport(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const overflowRight = rect.right - (window.innerWidth - VIEWPORT_MARGIN);
  const overflowBottom = rect.bottom - (window.innerHeight - VIEWPORT_MARGIN);
  if (overflowRight > 0) {
    element.style.left = `${Math.max(VIEWPORT_MARGIN, rect.left - overflowRight)}px`;
  }
  if (overflowBottom > 0) {
    element.style.top = `${Math.max(VIEWPORT_MARGIN, rect.top - overflowBottom)}px`;
  }
}

function useClampIntoViewport(ref: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    clampIntoViewport(element);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export interface ContextMenuAction {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: IconName;
  disabled?: boolean;
  items?: ContextMenuAction[];
}

export interface ContextMenuProps {
  left: number;
  top: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

interface ContextMenuItemsProps {
  actions: ContextMenuAction[];
  onSelect: (action: ContextMenuAction) => void;
}

interface ContextSubmenuProps {
  action: ContextMenuAction;
  open: boolean;
  onToggle: () => void;
  onSelect: (action: ContextMenuAction) => void;
}

const ContextSubmenu: FC<ContextSubmenuProps> = ({ action, open, onToggle, onSelect }) => {
  const submenuRef = useRef<HTMLDivElement>(null);
  useClampIntoViewport(submenuRef, [open]);

  return (
    <div className="wec-flow-context-menu__item-wrap">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={action.disabled}
        className="wec-flow-context-menu__item"
        onClick={onToggle}
      >
        {action.icon ? <Icon name={action.icon} className="wec-flow-context-menu__icon" /> : null}
        {action.label}
        <Icon name="chevronRight" className="wec-flow-context-menu__caret" />
      </button>
      {open ? (
        <div
          ref={submenuRef}
          className="wec-flow-context-menu wec-flow-context-menu--submenu"
          role="menu"
        >
          <ContextMenuItems actions={action.items ?? []} onSelect={onSelect} />
        </div>
      ) : null}
    </div>
  );
};

const ContextMenuItems: FC<ContextMenuItemsProps> = ({ actions, onSelect }) => {
  const [openSubmenuKey, setOpenSubmenuKey] = useState<string | null>(null);

  return (
    <>
      {actions.map((action) => {
        if (action.items) {
          return (
            <ContextSubmenu
              key={action.key}
              action={action}
              open={openSubmenuKey === action.key}
              onToggle={() =>
                setOpenSubmenuKey((current) => (current === action.key ? null : action.key))
              }
              onSelect={onSelect}
            />
          );
        }
        return (
          <button
            key={action.key}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            className={[
              "wec-flow-context-menu__item",
              action.danger ? "wec-flow-context-menu__item--danger" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(action)}
          >
            {action.icon ? <Icon name={action.icon} className="wec-flow-context-menu__icon" /> : null}
            {action.label}
          </button>
        );
      })}
    </>
  );
};

/**
 * Point-anchored right-click menu. `ContextMenuAction` now supports
 * icon/disabled/nested `items` (submenu), matching primitives/Menu.tsx's
 * item vocabulary, but renders its own positioned panel: Menu.tsx's
 * exported `Menu` only supports a trigger-button anchor, not an arbitrary
 * screen point, so wrapping it directly isn't possible without changing
 * that primitive (owned by Phase 0). Icon rendering and submenu markup
 * below mirror Menu.tsx's conventions.
 */
export const ContextMenu: FC<ContextMenuProps> = ({ left, top, actions, onClose }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  useClampIntoViewport(rootRef, [left, top]);

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

  const handleSelect = (action: ContextMenuAction): void => {
    action.onSelect();
    onClose();
  };

  return (
    <div
      ref={rootRef}
      className="wec-flow-context-menu"
      style={{ left, top }}
      role="menu"
    >
      <ContextMenuItems actions={actions} onSelect={handleSelect} />
    </div>
  );
};

export default ContextMenu;
