import { useCallback, useMemo, useState } from "react";
import { useAnnotationAuth, useAnnotationData } from "../../../context/AnnotationContext";
import { useEpicFlowApi } from "../../../hooks/useEpicFlowApi";
import { useMentionCandidates } from "../../../hooks/useMentionCandidates";
import { useReferenceCandidates } from "../../../hooks/useReferenceCandidates";
import { useSharedFetch } from "../../../hooks/useSharedFetch";
import { annotationLabel } from "../../../utils/annotation/annotationLabel";
import type { AiMentionCandidate, AiMentionTrigger } from "./AiComposer";

export function useAiMentionCandidates(): {
  candidates: AiMentionCandidate[];
  request: (trigger: AiMentionTrigger) => void;
} {
  const { allAnnotations, config } = useAnnotationData();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const references = useReferenceCandidates();
  const users = useMentionCandidates();
  const epicApi = useEpicFlowApi(config);
  const requestReferences = references.request;
  const [storiesRequested, setStoriesRequested] = useState(false);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const stories = useSharedFetch(
    storiesRequested && sessionKey
      ? `stories-list:${config.apiBaseUrl}:${sessionKey}:${config.projectId}`
      : null,
    (signal) => epicApi.getUserStoriesByProject(config.projectId, signal),
  );
  const epicTitles = useMemo(
    () =>
      new Map(references.references.filter((r) => r.kind === "epic").map((r) => [r.id, r.name])),
    [references.references],
  );

  const candidates = useMemo<AiMentionCandidate[]>(() => {
    const list: AiMentionCandidate[] = [];
    for (const reference of references.references) {
      const kind =
        reference.kind === "dataModel" ? "data_model" : reference.kind === "epic" ? "epic" : "flow";
      list.push({
        trigger: "#",
        mention: { kind, id: reference.id, label: reference.name },
        description:
          kind === "data_model"
            ? "Data model"
            : kind === "epic"
              ? `Epic${reference.description ? ` · ${reference.description}` : ""}`
              : "Flow",
      });
    }
    for (const story of stories.data ?? []) {
      const epicTitle = epicTitles.get(story.epicId);
      list.push({
        trigger: "#",
        mention: { kind: "user_story", id: story.id, label: story.title },
        description: epicTitle ? `User story · ${epicTitle}` : "User story",
      });
    }
    for (const annotation of allAnnotations) {
      list.push({
        trigger: "#",
        mention: { kind: "annotation", id: annotation.id, label: `#${annotation.number}` },
        description: annotationLabel(annotation),
      });
    }
    for (const user of users) {
      list.push({ trigger: "@", mention: { kind: "user", id: user.id, label: user.name } });
    }
    return list;
  }, [allAnnotations, epicTitles, references.references, stories.data, users]);

  const request = useCallback(
    (trigger: AiMentionTrigger) => {
      if (trigger === "#") {
        requestReferences();
        setStoriesRequested(true);
      }
    },
    [requestReferences],
  );

  return { candidates, request };
}
