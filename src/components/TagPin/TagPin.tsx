import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, Tooltip } from "../primitives";
import { usePointerDrag } from "../../hooks/flowchart/usePointerDrag";
import { useAnnotationContext } from "../../context/AnnotationContext";
import type { ProjectTag } from "../../types/tag.types";
import {
  DEFAULT_TAG_PIN_HEIGHT,
  DEFAULT_TAG_PIN_WIDTH,
  MIN_TAG_PIN_HEIGHT,
  MIN_TAG_PIN_WIDTH,
} from "../../types/annotationTag.types";
import { TagPicker } from "./TagPicker";

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";
const resizeHandles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const west = new Set<ResizeHandle>(["nw", "w", "sw"]);
const east = new Set<ResizeHandle>(["ne", "e", "se"]);
const north = new Set<ResizeHandle>(["nw", "n", "ne"]);
const south = new Set<ResizeHandle>(["sw", "s", "se"]);

interface TagGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TagPinProps {
  name: string;
  color: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  resolvedTarget: boolean;
  onRemove?: () => void;
  onGeometryChange?: (geometry: { x: number; y: number; width: number; height: number }) => void;
  onGeometryCommit?: (geometry: { x: number; y: number; width: number; height: number }) => void;
  onTagChange?: (tag: { id: string; name: string; color: string }) => void;
  canEdit?: boolean;
  tagId?: string;
}

export function TagPin({
  name,
  color,
  x,
  y,
  width,
  height,
  resolvedTarget,
  onRemove,
  onGeometryChange,
  onGeometryCommit,
  onTagChange,
  canEdit = false,
  tagId,
}: TagPinProps) {
  const { config, projectTags } = useAnnotationContext();
  const startDrag = usePointerDrag();
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const resolvedWidth = width ?? DEFAULT_TAG_PIN_WIDTH;
  const resolvedHeight = height ?? DEFAULT_TAG_PIN_HEIGHT;

  const initialTagId =
    tagId ?? projectTags.find((tag) => tag.name === name && tag.color === color)?.id ?? null;

  const handleTagPicked = useCallback(
    (tag: ProjectTag) => {
      if (tag.id !== initialTagId || tag.name !== name || tag.color !== color) {
        onTagChange?.({ id: tag.id, name: tag.name, color: tag.color });
      }
      setEditing(false);
    },
    [name, color, initialTagId, onTagChange],
  );

  const handleBodyPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || editing || !onGeometryChange) {
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest(".wpn-tag-pin__resize, .wpn-tag-pin__remove, .wpn-tag-pin__edit")) {
        return;
      }
      e.stopPropagation();
      const start: TagGeometry = { x, y, width: resolvedWidth, height: resolvedHeight };
      startDrag(e, {
        onStart: () => setDragging(true),
        onMove: (_ev, delta) => {
          const next = { ...start, x: start.x + delta.x, y: start.y + delta.y };
          onGeometryChange(next);
        },
        onEnd: (ev, moved) => {
          setDragging(false);
          if (moved) {
            const delta = { x: ev.clientX - e.clientX, y: ev.clientY - e.clientY };
            onGeometryCommit?.({ ...start, x: start.x + delta.x, y: start.y + delta.y });
          }
        },
      });
    },
    [editing, onGeometryChange, onGeometryCommit, startDrag, x, y, resolvedWidth, resolvedHeight],
  );

  const handleResizePointerDown = useCallback(
    (handle: ResizeHandle) => (e: React.PointerEvent) => {
      if (e.button !== 0 || !onGeometryChange) {
        return;
      }
      e.stopPropagation();
      const start: TagGeometry = { x, y, width: resolvedWidth, height: resolvedHeight };
      const resizesWidth = west.has(handle) || east.has(handle);
      const resizesHeight = north.has(handle) || south.has(handle);
      startDrag(e, {
        onStart: () => setDragging(true),
        onMove: (_ev, delta) => {
          const dx = delta.x;
          const dy = delta.y;
          const width = resizesWidth
            ? Math.max(MIN_TAG_PIN_WIDTH, Math.round(start.width + (west.has(handle) ? -dx : dx)))
            : start.width;
          const height = resizesHeight
            ? Math.max(
                MIN_TAG_PIN_HEIGHT,
                Math.round(start.height + (north.has(handle) ? -dy : dy)),
              )
            : start.height;
          onGeometryChange({ x: start.x, y: start.y, width, height });
        },
        onEnd: (ev, moved) => {
          setDragging(false);
          if (!moved) {
            return;
          }
          const dx = ev.clientX - e.clientX;
          const dy = ev.clientY - e.clientY;
          const width = resizesWidth
            ? Math.max(MIN_TAG_PIN_WIDTH, Math.round(start.width + (west.has(handle) ? -dx : dx)))
            : start.width;
          const height = resizesHeight
            ? Math.max(
                MIN_TAG_PIN_HEIGHT,
                Math.round(start.height + (north.has(handle) ? -dy : dy)),
              )
            : start.height;
          onGeometryCommit?.({ x: start.x, y: start.y, width, height });
        },
      });
    },
    [onGeometryChange, onGeometryCommit, startDrag, x, y, resolvedWidth, resolvedHeight],
  );

  return (
    <span
      className={[
        "wpn-tag-pin",
        resolvedTarget ? "" : "wpn-tag-pin--orphaned",
        dragging ? "wpn-tag-pin--dragging" : "",
        editing ? "wpn-tag-pin--editing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: x,
        top: y,
        width: resolvedWidth,
        height: resolvedHeight,
        backgroundColor: color,
      }}
      onPointerDown={handleBodyPointerDown}
    >
      <Tooltip label={name} placement="bottom">
        <span className="wpn-tag-pin__label">{name}</span>
      </Tooltip>
      {canEdit || onRemove ? (
        <div className="wpn-tag-pin__toolbar" onPointerDown={(event) => event.stopPropagation()}>
          {canEdit ? (
            <button
              type="button"
              className="wpn-tag-pin__edit"
              aria-label={`Edit tag ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                setEditing(true);
              }}
            >
              <Icon name="edit" />
            </button>
          ) : null}
          {onRemove ? (
            <button
              type="button"
              className="wpn-tag-pin__remove"
              aria-label={`Remove tag ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              <Icon name="close" />
            </button>
          ) : null}
        </div>
      ) : null}
      {onGeometryChange
        ? resizeHandles.map((handle) => (
            <div
              key={handle}
              className={`wpn-tag-pin__resize wpn-tag-pin__resize-${handle}`}
              onPointerDown={handleResizePointerDown(handle)}
            />
          ))
        : null}
      {editing
        ? createPortal(
            <div className="wpn-root wpn-tag-picker-portal" style={{ zIndex: config.zIndex }}>
              <TagPicker
                x={x}
                y={y}
                title={`Edit ${name}`}
                initialTagId={initialTagId}
                onSelectTag={handleTagPicked}
                onCancel={() => setEditing(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
