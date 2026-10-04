import {
  useEffect,
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
import { Switch } from "./Switch";

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
  variant?: "switch";
  onToggle: (checked: boolean) => void;
}

export interface MenuRadioItem {
  type: "radio";
  id: string;
  label: string;
  checked: boolean;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
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
  toggle?: { label: string; checked: boolean; onToggle: (checked: boolean) => void };
  items: MenuItemDefinition[];
}

export type MenuItemDefinition =
  MenuActionItem | MenuCheckboxItem | MenuRadioItem | MenuSeparatorItem | MenuSubmenuItem;

export interface MenuDefinition {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  items: MenuItemDefinition[];
}

export interface MenuPanelProps {
  items: MenuItemDefinition[];
  placement: "bottom-start" | "top-start" | "right-start";
  anchorRef: RefObject<HTMLElement | null>;
  onRequestClose: () => void;
  className?: string;

  onInteract?: () => void;
  onBack?: () => void;
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
  registerRef: (element: HTMLButtonElement | null) => void;
  onHover: () => void;
  onOpen: () => void;
  onClose: () => void;
  onRequestClose: () => void;
}

function SubmenuItem({
  item,
  isActive,
  open,
  registerRef,
  onHover,
  onOpen,
  onClose,
  onRequestClose,
}: SubmenuItemProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const setTriggerRef = (element: HTMLButtonElement | null) => {
    triggerRef.current = element;
    registerRef(element);
  };
  const closeAndRefocus = () => {
    onClose();
    triggerRef.current?.focus();
  };

  return (
    <div
      ref={wrapRef}
      className={["wpn-menu__item-wrap", item.toggle ? "wpn-menu__item-wrap--toggle" : ""]
        .filter(Boolean)
        .join(" ")}
      onPointerEnter={onHover}
    >
      <button
        ref={setTriggerRef}
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
        {item.toggle ? null : <Icon name="chevronRight" className="wpn-menu__item-caret" />}
      </button>
      {item.toggle ? (
        <>
          <span className="wpn-menu__item-switch">
            <Switch
              checked={item.toggle.checked}
              onChange={item.toggle.onToggle}
              label={item.toggle.label}
              disabled={item.disabled}
            />
          </span>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled={item.disabled}
            className="wpn-menu__item-expand"
            onClick={onOpen}
          >
            <Icon name="chevronRight" className="wpn-menu__item-caret" />
          </button>
        </>
      ) : null}
      {open ? (
        <MenuPanel
          items={item.items}
          placement="right-start"
          anchorRef={wrapRef}
          onRequestClose={onRequestClose}
          onBack={closeAndRefocus}
        />
      ) : null}
    </div>
  );
}

export function MenuPanel({
  items,
  placement,
  anchorRef,
  onRequestClose,
  className,
  onInteract,
  onBack,
}: MenuPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<number, HTMLButtonElement>());
  const [activeIndex, setActiveIndex] = useState(() => focusableIndexes(items)[0] ?? -1);
  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const position = useFloatingPosition(anchorRef, panelRef, true, placement);

  const enabledIndexes = focusableIndexes(items);

  useEffect(() => {
    itemRefs.current.get(activeIndex)?.focus();
  }, [activeIndex]);

  const registerItemRef = (index: number) => (element: HTMLButtonElement | null) => {
    if (element) {
      itemRefs.current.set(index, element);
    } else {
      itemRefs.current.delete(index);
    }
  };

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
    if (item.type === "radio") {
      item.onSelect();
      return;
    }
    if (item.type === "submenu") {
      setOpenSubmenuId(item.id);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onInteract?.();
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
    if (event.key === " " && active?.type === "submenu" && active.toggle && !active.disabled) {
      event.preventDefault();
      active.toggle.onToggle(!active.toggle.checked);
      return;
    }
    if (event.key === "ArrowLeft") {
      if (openSubmenuId) {
        event.preventDefault();
        setOpenSubmenuId(null);
      } else if (onBack) {
        event.preventDefault();
        onBack();
      }
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      moveActive(event.shiftKey ? -1 : 1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && active) {
      event.preventDefault();
      activateItem(active);
    }
  };

  const panelContent = (
    <div
      ref={panelRef}
      className={["wpn-menu__panel", className ?? ""].filter(Boolean).join(" ")}
      role="menu"
      style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      onKeyDown={handleKeyDown}
      onPointerDown={onInteract}
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
              registerRef={registerItemRef(index)}
              onHover={() => !item.disabled && setActiveIndex(index)}
              onOpen={() => !item.disabled && setOpenSubmenuId(item.id)}
              onClose={() => setOpenSubmenuId(null)}
              onRequestClose={onRequestClose}
            />
          );
        }
        if (item.type === "checkbox" || item.type === "radio") {
          const icon = item.type === "checkbox" ? item.icon : undefined;
          return (
            <button
              key={item.id}
              ref={registerItemRef(index)}
              type="button"
              role={item.type === "radio" ? "menuitemradio" : "menuitemcheckbox"}
              aria-checked={item.checked}
              disabled={item.disabled}
              className={[
                "wpn-menu__item",
                isActive ? "wpn-menu__item--active" : "",
                item.checked ? "wpn-menu__item--checked" : "",
                item.disabled ? "wpn-menu__item--disabled" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerEnter={() => !item.disabled && setActiveIndex(index)}
              onClick={() => activateItem(item)}
            >
              {icon ? (
                <Icon name={icon} className="wpn-menu__item-icon" />
              ) : item.type === "checkbox" && item.variant === "switch" ? null : (
                <Icon
                  name="check"
                  className={[
                    "wpn-menu__item-check",
                    item.checked ? "wpn-menu__item-check--visible" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                />
              )}
              <span className="wpn-menu__item-label">{item.label}</span>
              {item.type === "checkbox" && item.variant === "switch" ? (
                <span
                  className={["wpn-switch", item.checked ? "wpn-switch--on" : ""]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden="true"
                >
                  <span className="wpn-switch__track">
                    <span className="wpn-switch__knob" />
                  </span>
                </span>
              ) : icon && item.checked ? (
                <Icon name="check" className="wpn-menu__item-check wpn-menu__item-check--visible" />
              ) : null}
              {item.shortcut ? (
                <span className="wpn-menu__item-shortcut">{item.shortcut}</span>
              ) : null}
            </button>
          );
        }
        return (
          <button
            key={item.id}
            ref={registerItemRef(index)}
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

  return panelContent;
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
  useEscapeKey(close, open);

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
