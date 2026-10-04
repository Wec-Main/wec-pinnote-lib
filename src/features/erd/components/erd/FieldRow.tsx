import { memo } from "react";
import { useErdEngine, useErdState } from "../../ErdContext";
import type { ErdField } from "../../../../types/dataModel.types";
import { formatFieldType } from "../../../../utils/erd/erdTypes";
import { cx } from "../../../../utils/flowchart/shallow";
import { fieldDiffId } from "../../../ai/ops/diff";
import { aiMarkClass, useAiPreviewMark } from "../../../ai/components/AiPreviewScope";

export const FieldRow = memo(function FieldRow({
  entityId,
  field,
}: {
  entityId: string;
  field: ErdField;
}) {
  const engine = useErdEngine();
  const active = useErdState((s) => s.activeFieldId === field.id);
  const issue = useErdState((s) => s.issueFieldIds.get(field.id));
  const aiMark = useAiPreviewMark("data_model", fieldDiffId(entityId, field.id));
  return (
    <div
      className={cx(
        "wpn-erd-field",
        field.primaryKey && "wpn-erd-field--primary",
        active && "wpn-erd-field--active",
        issue && `wpn-erd-field--issue-${issue}`,
        aiMarkClass(aiMark),
      )}
      onClick={() => engine.focusField(entityId, field.id)}
    >
      <span className="wpn-erd-field__keys">
        {field.primaryKey && <span className="wpn-erd-field__key">PK</span>}
        {field.unique && !field.primaryKey && (
          <span className="wpn-erd-field__key wpn-erd-field__key--unique">UQ</span>
        )}
      </span>
      <span className="wpn-erd-field__name" title={field.name}>
        {field.name}
        {field.nullable && <span className="wpn-erd-field__nullable">?</span>}
      </span>
      <span className="wpn-erd-field__type" title={formatFieldType(field)}>
        {formatFieldType(field)}
      </span>
    </div>
  );
});
