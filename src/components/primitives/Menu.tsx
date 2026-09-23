import {
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useFloatingPosition } from "../../hooks/useFloatingPosition";
import { useOutsidePointerDown } from "../../hooks/useOutsidePointerDown";
import { Icon, type IconName } from "./Icon";

export interface MenuActionItem {
  type: "action";
  id: string;
  label: string;
  icon?: IconName;
  shortcut?: string;
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}

export interface MenuCheckboxItem {
  type: "checkbox";
  id: string;
  label: string;
  checked: boolean;
  icon?: IconName;
  shortcut?: string;
  disabled?: boolean;
  onToggle: (checked: boolean) => void;
}

export interface MenuSeparatorItem {
  type: "separator";
  id: string;
}

export interface MenuSubmenuItem {
  type: "submenu";
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  items: MenuItemDefinition[];
}

export type MenuItemDefinition =
  | MenuActionItem
  | MenuCheckboxItem
  | MenuSeparatorItem
  | MenuSubmenuItem;

export interface MenuDefinition {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  items: MenuItemDefinition[];
}

interface MenuPanelProps {
  items: MenuItemDefinition[];
  placement: "bottom-start" | "right-start";
  anchorRef: RefObject<HTMLElement | null>;
  onRequestClose: () => void;
}

function focusableIndexes(items: MenuItemDefinition[]): number[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.type !== "separator" && !item.disabled)
    .map(({ index }) => index);
}

interface SubmenuItemProps {
  item: MenuSubmenuItem;
  isActive: boolean;
  open: boolean;
  onHover: () => void;
  onOpen: () => void;
  onRequestClose: () => void;
}

function SubmenuItem({ item, isActive, open, onHover, onOpen, onRequestClose }: SubmenuItemProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="wpn-menu__item-wrap" onPointerEnter={onHover}>
      <button
        ref={triggerRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={item.disabled}
        className={[
          "wpn-menu__item",
          isActive ? "wpn-menu__item--active" : "",
          item.disabled ? "wpn-menu__item--disabled" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onOpen}
      >
        {item.icon ? (
          <Icon name={item.icon} className="wpn-menu__item-icon" />
        ) : (
          <span className="wpn-menu__item-icon" aria-hidden="true" />
        )}
        <span className="wpn-menu__item-label">{item.label}</span>
        <Icon name="chevronRight" className="wpn-menu__item-caret" />
      </button>
      {open ? (
        <MenuPanel
          items={item.items}
          placement="right-start"
          anchorRef={triggerRef}
          onRequestClose={onRequestClose}
        />
      ) : null}
    </div>
  );
}

function MenuPanel({ items, placement, anchorRef, onRequestClose }: MenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(() => focusableIndexes(items)[0] ?? -1);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const position = useFloatingPosition(anchorRef, panelRef, true, placement);

  const enabledIndexes = focusableIndexes(items);

  const moveActive = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) {
      return;
    }
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const nextPosition =
      currentPosition === -1
        ? 0
        : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    const nextIndex = enabledIndexes[nextPosition];
    if (nextIndex !== undefined) {
      setActiveIndex(nextIndex);
    }
  };

  const activateItem = (item: MenuItemDefinition) => {
    if (item.type === "action") {
      item.onSelect();
      onRequestClose();
      return;
    }
    if (item.type === "checkbox") {
      item.onToggle(!item.checked);
      return;
    }
    if (item.type === "submenu") {
      setOpenSubmenuId(item.id);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    const active = items[activeIndex];
    if (event.key === "ArrowRight" && active?.type === "submenu" && !active.disabled) {
      event.preventDefault();
      setOpenSubmenuId(active.id);
      return;
    }
    if (event.key === "ArrowLeft") {
      if (openSubmenuId) {
        event.preventDefault();
        setOpenSubmenuId(null);
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && active) {
      event.preventDefault();
      activateItem(active);
    }
  };

  return (
    <div
      ref={panelRef}
      className="wpn-menu__panel"
      role="menu"
      style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      onKeyDown={handleKeyDown}
    >
      {items.map((item, index) => {
        if (item.type === "separator") {
          return <div key={item.id} role="separator" className="wpn-menu__separator" />;
        }
        const isActive = index === activeIndex;
        if (item.type === "submenu") {
          return (
            <SubmenuItem
              key={item.id}
              item={item}
              isActive={isActive}
              open={openSubmenuId === item.id}
              onHover={() => !item.disabled && setActiveIndex(index)}
              onOpen={() => !item.disabled && setOpenSubmenuId(item.id)}
              onRequestClose={onRequestClose}
            />
          );
        }
        if (item.type === "checkbox") {
          return (
            <button
              key={item.id}
              type="button"
              role="menuitemcheckbox"
              aria-checked={item.checked}
              disabled={item.disabled}
              className={[
                "wpn-menu__item",
                isActive ? "wpn-menu__item--active" : "",
                item.disabled ? "wpn-menu__item--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerEnter={() => !item.disabled && setActiveIndex(index)}
              onClick={() => activateItem(item)}
            >
              <Icon
                name="check"
                className={[
                  "wpn-menu__item-check",
                  item.checked ? "wpn-menu__item-check--visible" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              <span className="wpn-menu__item-label">{item.label}</span>
              {item.shortcut ? (
                <span className="wpn-menu__item-shortcut">{item.shortcut}</span>
              ) : null}
            </button>
          );
        }
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            title={item.disabled ? item.disabledReason : undefined}
            className={[
              "wpn-menu__item",
              isActive ? "wpn-menu__item--active" : "",
              item.disabled ? "wpn-menu__item--disabled" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onPointerEnter={() => !item.disabled && setActiveIndex(index)}
            onClick={() => activateItem(item)}
          >
            {item.icon ? (
              <Icon name={item.icon} className="wpn-menu__item-icon" />
            ) : (
              <span className="wpn-menu__item-icon" aria-hidden="true" />
            )}
            <span className="wpn-menu__item-label">{item.label}</span>
            {item.shortcut ? (
              <span className="wpn-menu__item-shortcut">{item.shortcut}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

interface MenuProps {
  menu: MenuDefinition;
}

export function Menu({ menu }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const buttonId = useId();

  const close = () => setOpen(false);

  useOutsidePointerDown(rootRef, close, open);
  useEscapeKey(() => {
    if (open) {
      close();
    }
  });

  return (
    <div className="wpn-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id={buttonId}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={menu.disabled}
        className={["wpn-menu__trigger", open ? "wpn-menu__trigger--open" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setOpen((current) => !current)}
      >
        {menu.icon ? <Icon name={menu.icon} className="wpn-menu__trigger-icon" /> : null}
        {menu.label}
      </button>
      {open ? (
        <MenuPanel
          items={menu.items}
          placement="bottom-start"
          anchorRef={triggerRef}
          onRequestClose={close}
        />
      ) : null}
    </div>
  );
}

