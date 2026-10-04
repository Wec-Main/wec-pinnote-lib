import { useState } from "react";
import { createPortal } from "react-dom";
import { useAnnotationContext } from "../../../../context/AnnotationContext";
import { canExportData } from "../../../../utils/auth/permissions";
import { Icon } from "../../../../components/primitives/Icon";
import { Tooltip } from "../../../../components/primitives/Tooltip";
import { ExportDialog } from "./ExportDialog";

export function ExportDialogButton() {
  const { config, project, activeAccount } = useAnnotationContext();
  const [open, setOpen] = useState(false);

  if (!project || !activeAccount?.roleId || !canExportData(activeAccount.roleId)) {
    return null;
  }

  return (
    <>
      <Tooltip label="Export comments, flows, draft board and data models" placement="bottom">
        <button
          type="button"
          className="wpn-toolbar__publish"
          aria-label="Export"
          onClick={() => setOpen(true)}
        >
          <Icon name="download" className="wpn-toolbar__publish-icon" />
          Export
        </button>
      </Tooltip>
      {open
        ? createPortal(
            <div className="wpn-root wpn-login-portal" style={{ zIndex: config.zIndex }}>
              <ExportDialog
                currentVersionId={project.currentProjectVersionId}
                onClose={() => setOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
