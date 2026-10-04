import { useEffect, useRef, useState } from "react";
import { useAnnotationContext, type VersionedLayer } from "../../../../context/AnnotationContext";
import { useEscapeKey } from "../../../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../../../hooks/useOutsidePointerDown";
import { useProjectVersionList } from "../../../../hooks/useProjectVersionList";
import { projectVersionLabel } from "../../../../utils/projectVersionLabel";
import { Icon } from "../../../../components/primitives/Icon";
import { MenuPanel, type MenuItemDefinition } from "../../../../components/primitives/Menu";
import { Tooltip } from "../../../../components/primitives/Tooltip";
import type { IconName } from "../../../../components/primitives/Icon";

interface LayerDefinition {
  layer: VersionedLayer;
  label: string;
  icon: IconName;
  count: number;
  visible: boolean;
  onToggle: (visible: boolean) => void;
  versioningEnabled: boolean;
  selectedVersionId: string | undefined;
}

export function AnnotationVisibilityToggle() {
  const {
    activeAccount,
    project,
    projectVersionId,
    commentsVersionId,
    flowsVersionId,
    selectLayerVersion,
    annotations,
    flowPins,
    pinsVisible,
    setPinsVisible,
    tagsVisible,
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

  useEffect(() => {
    if (loggedOut) {
      setOpen(false);
    }
  }, [loggedOut]);
  const anyLayerVersioned =
    project?.annotationVersioningEnabled !== false || project?.flowVersioningEnabled !== false;
  const { versions, error: versionsError } = useProjectVersionList(open && anyLayerVersioned);

  const someVisible = pinsVisible || tagsVisible || flowPinsVisible;
  const label = loggedOut ? "Log in first" : someVisible ? "Layer visibility" : "All layers hidden";

  const versionItems = (definition: LayerDefinition): MenuItemDefinition[] => {
    if (versionsError) {
      return [
        {
          type: "action",
          id: `${definition.layer}-versions-error`,
          label: "Versions unavailable",
          disabled: true,
          onSelect: () => undefined,
        },
      ];
    }
    if (!versions) {
      return [
        {
          type: "action",
          id: `${definition.layer}-versions-loading`,
          label: "Loading versions…",
          disabled: true,
          onSelect: () => undefined,
        },
      ];
    }
    return versions.map((version) => ({
      type: "radio",
      id: `${definition.layer}-version-${version.id}`,
      label: projectVersionLabel(version),
      shortcut: version.id === project?.currentProjectVersionId ? "Current" : version.status,
      checked: version.id === definition.selectedVersionId,
      disabled: loggedOut,
      onSelect: () =>
        selectLayerVersion(
          definition.layer,
          version.id === projectVersionId ? undefined : version.id,
        ),
    }));
  };

  const layerItem = (definition: LayerDefinition): MenuItemDefinition => {
    const toggleLabel = `Show ${definition.label.toLowerCase()}`;
    if (!definition.versioningEnabled) {
      return {
        type: "checkbox",
        id: definition.layer,
        label: definition.label,
        icon: definition.icon,
        checked: definition.visible,
        shortcut: String(definition.count),
        variant: "switch",
        disabled: loggedOut,
        onToggle: definition.onToggle,
      };
    }
    return {
      type: "submenu",
      id: `${definition.layer}-menu`,
      label: definition.label,
      icon: definition.icon,
      disabled: loggedOut,
      toggle: { label: toggleLabel, checked: definition.visible, onToggle: definition.onToggle },
      items: versionItems(definition),
    };
  };

  const items: MenuItemDefinition[] = [
    layerItem({
      layer: "comments",
      label: "Comments",
      icon: "comment",
      count: annotations.length,
      visible: pinsVisible,
      onToggle: setPinsVisible,
      versioningEnabled: project?.annotationVersioningEnabled !== false,
      selectedVersionId: commentsVersionId,
    }),
    layerItem({
      layer: "flows",
      label: "Flows",
      icon: "flow",
      count: flowPins.length,
      visible: flowPinsVisible,
      onToggle: setFlowPinsVisible,
      versioningEnabled: project?.flowVersioningEnabled !== false,
      selectedVersionId: flowsVersionId,
    }),
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
      {open && !loggedOut ? (
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
