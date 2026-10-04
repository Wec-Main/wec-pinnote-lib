import { useRef, useState, type ReactNode } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../hooks/useOutsidePointerDown";
import { Icon } from "./Icon";
import { MenuPanel, type MenuItemDefinition } from "./Menu";

export interface ExportMenuButtonProps {
  items: MenuItemDefinition[];
  ariaLabel: string;
  label?: ReactNode;
  triggerClassName?: string;
}

export function ExportMenuButton({
  items,
  ariaLabel,
  label,
  triggerClassName,
}: ExportMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useOutsidePointerDown(rootRef, close, open);
  useEscapeKey(close, open);

  return (
    <div className="wpn-export-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="download" />
        <span>{label ?? "Export"}</span>
        <Icon name="chevronDown" className="wpn-export-menu__caret" />
      </button>
      {open ? (
        <MenuPanel
          items={items}
          placement="bottom-start"
          anchorRef={triggerRef}
          onRequestClose={close}
        />
      ) : null}
    </div>
  );
}
