import { useId, useState, type ReactNode } from "react";
import { Icon } from "../../../../components/primitives/Icon";

interface PromptSectionProps {
  title: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function PromptSection({
  title,
  actions,
  defaultOpen = false,
  children,
}: PromptSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="wpn-pw-section" data-open={open || undefined}>
      <div className="wpn-pw-section__head">
        <h4 className="wpn-pw-section__title">{title}</h4>
        <div className="wpn-pw-section__actions">
          {actions}
          <button
            type="button"
            className="wpn-pw-toggle"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? "eyeOff" : "eye"} className="wpn-pw-toggle__icon" />
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <div id={bodyId} className="wpn-pw-section__body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
