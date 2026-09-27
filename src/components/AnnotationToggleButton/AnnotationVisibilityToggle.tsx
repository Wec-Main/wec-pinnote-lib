import { useRef, useState } from "react";
import { useAnnotationContext } from "../../context/AnnotationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../hooks/useOutsidePointerDown";
import { Icon, MenuPanel, Tooltip, type MenuItemDefinition } from "../primitives";

export function AnnotationVisibilityToggle() {
  const {
    activeAccount,
    annotations,
    annotationTags,
    flowPins,
    pinsVisible,
    setPinsVisible,
    tagsVisible,
    setTagsVisible,
    flowPinsVisible,
    setFlowPinsVisible,
  } = useAnnotationContext();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => setOpen(false);
  useOutsidePointerDown(rootRef, close, open);
  useEscapeKey(close, open);

  const loggedOut = !activeAccount;
  const someVisible = pinsVisible || tagsVisible || flowPinsVisible;
  const label = loggedOut
    ? "Log in first"
    : someVisible
      ? "Layer visibility"
      : "All layers hidden";

  const items: MenuItemDefinition[] = [
    {
      type: "checkbox",
      id: "pins",
      label: "Comments",
      icon: "comment",
      checked: pinsVisible,
      shortcut: String(annotations.length),
      onToggle: setPinsVisible,
    },
    {
      type: "checkbox",
      id: "tags",
      label: "Tags",
      icon: "tag",
      checked: tagsVisible,
      shortcut: String(annotationTags.length),
      onToggle: setTagsVisible,
    },
    {
      type: "checkbox",
      id: "flows",
      label: "Flows",
      icon: "flow",
      checked: flowPinsVisible,
      shortcut: String(flowPins.length),
      onToggle: setFlowPinsVisible,
    },
  ];

  return (
    <div className="wpn-menu" ref={rootRef}>
      <Tooltip label={label} placement="bottom">
        <button
          ref={triggerRef}
          type="button"
          className={["wpn-toolbar__eye", loggedOut ? "wpn-toolbar__eye--blocked" : ""]
            .filter(Boolean)
            .join(" ")}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-disabled={loggedOut}
          aria-label={label}
          onClick={() => {
            if (loggedOut) {
              return;
            }
            setOpen((current) => !current);
          }}
        >
          <Icon name="layers" className="wpn-toggle__icon" />
        </button>
      </Tooltip>
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
