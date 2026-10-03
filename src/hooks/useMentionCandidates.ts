import { useMemo } from "react";
import { useAnnotationAuth, useAnnotationData } from "../context/AnnotationContext";
import { fetchMentionCandidates } from "../services/usersApi";
import type { MentionCandidate } from "../utils/mentions";
import { useSharedFetch } from "./useSharedFetch";

export function useMentionCandidates(): MentionCandidate[] {
  const { config } = useAnnotationData();
  const { hostAuthenticated, activeAccount } = useAnnotationAuth();
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const { data } = useSharedFetch(
    sessionKey ? `mention-candidates:${config.apiBaseUrl}:${sessionKey}:${config.projectId}` : null,
    (signal) =>
      fetchMentionCandidates(config.apiBaseUrl, config.getAuthToken, config.projectId, signal),
  );

  return useMemo(
    () =>
      (data ?? []).map((user) => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      })),
    [data],
  );
}
