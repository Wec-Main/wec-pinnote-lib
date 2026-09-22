import { useId, useRef } from "react";
import { Icon, Tooltip } from "../primitives";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { useScrimDismiss } from "../../hooks/useScrimDismiss";
import { formatTimestamp } from "../../utils/format";
import { useFocusTrap } from "./useFocusTrap";
import type { ProjectTag } from "../../types/tag.types";

interface TagDetailsModalProps {
  tag: ProjectTag;
  projectName: string;
  onClose: () => void;
}

export function TagDetailsModal({ tag, projectName, onClose }: TagDetailsModalProps) {
  useEscapeKey(onClose);
  const scrimProps = useScrimDismiss(onClose);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, closeButtonRef);

  const rows = [
    { label: "Project", value: projectName },
    { label: "Created by", value: tag.createdByName ?? "—" },
    { label: "Created on", value: formatTimestamp(tag.createdAt) },
    { label: "Updated on", value: formatTimestamp(tag.updatedAt) },
  ];

  return (
    <div className="wpn-epicflow-modal-scrim" {...scrimProps}>
      <div
        ref={dialogRef}
        className="wpn-epicflow-modal wpn-users-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="wpn-epicflow-modal__header">
          <h2 className="wpn-epicflow-modal__title" id={titleId}>
            Tag details
          </h2>
          <Tooltip label="Close" placement="left">
            <button
              ref={closeButtonRef}
              type="button"
              className="wpn-icon-btn wpn-icon-btn--danger"
              aria-label="Close tag details"
              onClick={onClose}
            >
              <Icon name="close" />
            </button>
          </Tooltip>
        </div>

        <div className="wpn-users-modal__body">
          <div className="wpn-tag-details__headline">
            <span className="wpn-tag-chip" style={{ backgroundColor: tag.color }}>
              {tag.name}
            </span>
            <span className={`wpn-users-pill wpn-users-pill--status-${tag.status}`}>
              {tag.status}
            </span>
          </div>

          <dl className="wpn-tag-details">
            {rows.map((row) => (
              <div key={row.label} className="wpn-tag-details__row">
                <dt className="wpn-tag-details__label">{row.label}</dt>
                <dd className="wpn-tag-details__value">{row.value}</dd>
              </div>
            ))}
            <div className="wpn-tag-details__row">
              <dt className="wpn-tag-details__label">Colour</dt>
              <dd className="wpn-tag-details__value">
                <span className="wpn-tag-dot" style={{ backgroundColor: tag.color }} />
                {tag.color}
              </dd>
            </div>
          </dl>
        </div>

        <div className="wpn-epicflow-modal__footer">
          <button type="button" className="wpn-btn wpn-btn--ghost" onClick={onClose}>
            <Icon name="close" className="wpn-btn__icon" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
