import { useEffect, useMemo } from "react";
import { useAnnotationData } from "../../../context/AnnotationContext";
import { useReferenceCandidates } from "../../../hooks/useReferenceCandidates";
import type { AiActionTarget } from "../../../types/ai.types";
import { annotationLabel } from "../../../utils/annotation/annotationLabel";

export interface TemplateTarget {
  kind: AiActionTarget["kind"];
  id: string;
  label: string;
}

export function useTemplateTargets(): TemplateTarget[] {
  const { allAnnotations, config } = useAnnotationData();
  const references = useReferenceCandidates();
  const request = references.request;
  useEffect(() => {
    request();
  }, [request]);
  return useMemo(() => {
    const list: TemplateTarget[] = [
      { kind: "workspace", id: config.projectId, label: "This project's workspace" },
    ];
    for (const reference of references.references) {
      if (reference.kind === "dataModel") {
        list.push({ kind: "data_model", id: reference.id, label: reference.name });
      } else if (reference.kind === "flow") {
        list.push({ kind: "flow", id: reference.id, label: reference.name });
      }
    }
    for (const annotation of allAnnotations) {
      list.push({
        kind: "annotation",
        id: annotation.id,
        label: `#${annotation.number} · ${annotationLabel(annotation)}`,
      });
    }
    return list;
  }, [allAnnotations, config.projectId, references.references]);
}
