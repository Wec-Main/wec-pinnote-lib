import { useRef, useState } from "react";
import { useAnnotationContext, type VersionedLayer } from "../../context/AnnotationContext";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useOutsidePointerDown } from "../../hooks/useOutsidePointerDown";
import { useProjectVersionList } from "../../hooks/useProjectVersionList";
import { projectVersionLabel } from "../../utils/projectVersionLabel";
import { Icon, MenuPanel, Tooltip, type MenuItemDefinition } from "../primitives";
import type { IconName } from "../primitives/Icon";

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
      onSelect: () =>
        selectLayerVersion(
          definition.layer,
          version.id === projectVersionId ? undefined : version.id,
        ),
    }));
  };

  const layerItem = (definition: LayerDefinition): MenuItemDefinition => {
    const visibility: MenuItemDefinition = {
      type: "checkbox",
      id: definition.layer,
      label: definition.label,
      icon: definition.icon,
      checked: definition.visible,
      shortcut: String(definition.count),
      onToggle: definition.onToggle,
    };
    if (!definition.versioningEnabled) {
      return visibility;
    }
    return {
      type: "submenu",
      id: `${definition.layer}-menu`,
      label: definition.label,
      icon: definition.icon,
      items: [
        { ...visibility, label: `Show ${definition.label.toLowerCase()}` },
        { type: "separator", id: `${definition.layer}-versions-separator` },
        ...versionItems(definition),
      ],
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
