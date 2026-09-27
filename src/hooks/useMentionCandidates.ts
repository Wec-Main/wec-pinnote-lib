import { useMemo } from "react";
import { useAnnotationAuth } from "../context/AnnotationContext";
import type { MentionCandidate } from "../utils/mentions";

export function useMentionCandidates(): MentionCandidate[] {
  const { loginOptions } = useAnnotationAuth();

  return useMemo(
    () =>
      loginOptions.map((option) => ({
        id: option.id,
        name: option.name,
        email: option.email,
        avatarUrl: option.avatarUrl,
      })),
    [loginOptions],
  );
}
