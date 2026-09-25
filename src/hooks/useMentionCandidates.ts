import { useMemo } from "react";
import { useAnnotationAuth, useAnnotationData } from "../context/AnnotationContext";
import type { MentionCandidate } from "../utils/mentions";

export function useMentionCandidates(): MentionCandidate[] {
  const { loginOptions } = useAnnotationAuth();
  const { config } = useAnnotationData();
  const currentUserId = config.currentUser.id;

  return useMemo(
    () =>
      loginOptions
        .filter((option) => option.id !== currentUserId)
        .map((option) => ({
          id: option.id,
          name: option.name,
          email: option.email,
          avatarUrl: option.avatarUrl,
        })),
    [loginOptions, currentUserId],
  );
}
