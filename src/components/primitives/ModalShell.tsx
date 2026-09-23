import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";

export interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  hostRootSelector?: string;
  closeLabel?: string;
  role?: "dialog" | "alertdialog";
  describedById?: string;
}

export function ModalShell({
  title,
  subtitle,
  onClose,
  footer,
  children,
  className,
  initialFocusRef,
  hostRootSelector,
  closeLabel = "Close",
  role = "dialog",
  describedById,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const scrimHandlers = useScrimDismiss(onClose);

  useEscapeKey(onClose);
  useFocusTrap(dialogRef, initialFocusRef);

  useEffect(() => {
    if (!hostRootSelector) {
      return;
    }
    const host = document.querySelector(hostRootSelector);
    if (!host) {
      return;
    }
    host.setAttribute("inert", "");
    host.setAttribute("aria-hidden", "true");
    return () => {
      host.removeAttribute("inert");
      host.removeAttribute("aria-hidden");
    };
  }, [hostRootSelector]);

  return (
    <div className="wpn-modal-scrim" {...scrimHandlers}>
      <div
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        tabIndex={-1}
        className={["wpn-modal-shell", className].filter(Boolean).join(" ")}
      >
        <header className="wpn-modal-shell__header">
          <div className="wpn-modal-shell__heading">
            <h2 id={titleId} className="wpn-modal-shell__title">
              {title}
            </h2>
            {subtitle ? <p className="wpn-modal-shell__subtitle">{subtitle}</p> : null}
          </div>
          <Tooltip label={closeLabel}>
            <button
              type="button"
              className="wpn-modal-shell__close"
              aria-label={closeLabel}
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </header>
        <div className="wpn-modal-shell__body">{children}</div>
        {footer ? <footer className="wpn-modal-shell__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
