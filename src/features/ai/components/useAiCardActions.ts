import { useCallback, useMemo } from "react";
import { useAiRuntime } from "../AiRuntimeContext";
import { useAnnotationData, useAnnotationUi } from "../../../context/AnnotationContext";
import { updateAiCommentDraft, updateAiOpBatch } from "../../../services/aiService";
import type { AiCommentDraft, AiMention, AiOpBatch } from "../../../types/ai.types";
import { aiEditorRequests } from "./aiEditorRequests";
import { useAiUi } from "./AiUiContext";

const POSTED_COMMENTS_LIMIT = 200;
const postedComments = new Map<string, string>();

const postedKey = (draft: Pick<AiCommentDraft, "aiCommentDraftId"> & { aiSessionId?: string }) =>
  `${draft.aiSessionId ?? ""}:${draft.aiCommentDraftId}`;

function rememberPosted(key: string, commentId: string): void {
  postedComments.delete(key);
  postedComments.set(key, commentId);
  while (postedComments.size > POSTED_COMMENTS_LIMIT) {
    const oldest = postedComments.keys().next();
    if (oldest.done) break;
    postedComments.delete(oldest.value);
  }
}

export function postedDraftCount(): number {
  return postedComments.size;
}

export function resetPostedDrafts(): void {
  postedComments.clear();
}

export async function postDraftOnce(
  draft: Pick<AiCommentDraft, "aiCommentDraftId" | "postedCommentId"> & { aiSessionId?: string },
  createComment: () => Promise<{ id: string }>,
  markPosted: (commentId: string) => Promise<unknown>,
  onCreated?: () => void,
): Promise<string> {
  const key = postedKey(draft);
  let commentId = postedComments.get(key) ?? draft.postedCommentId ?? null;
  if (!commentId) {
    const comment = await createComment();
    commentId = comment.id;
    rememberPosted(key, commentId);
    onCreated?.();
  }
  await markPosted(commentId);
  return commentId;
}

export function useAiCardActions() {
  const { apiBaseUrl, getToken } = useAiRuntime();
  const { api, reloadAllAnnotations } = useAnnotationData();
  const { revealAnnotationAndHideList, openReference } = useAnnotationUi();
  const ai = useAiUi();

  const previewBatch = useCallback(
    (batch: AiOpBatch) => {
      aiEditorRequests.requestPreview(batch);
      ai?.openInEditor(batch.targetKind, batch.targetId);
    },
    [ai],
  );

  const openBatch = useCallback(
    (batch: AiOpBatch) => ai?.openInEditor(batch.targetKind, batch.targetId),
    [ai],
  );

  const rejectBatch = useCallback(
    async (batch: AiOpBatch) => {
      await updateAiOpBatch(apiBaseUrl, await getToken(), batch.aiOpBatchId, {
        status: "rejected",
      });
    },
    [apiBaseUrl, getToken],
  );

  const postDraft = useCallback(
    async (draft: AiCommentDraft, message: string) => {
      await postDraftOnce(
        draft,
        () =>
          api.createComment(draft.annotationId, {
            message,
            replyToId: draft.replyToCommentId ?? undefined,
          }),
        async (postedCommentId) =>
          updateAiCommentDraft(apiBaseUrl, await getToken(), draft.aiCommentDraftId, {
            status: "posted",
            postedCommentId,
          }),
        reloadAllAnnotations,
      );
    },
    [api, apiBaseUrl, getToken, reloadAllAnnotations],
  );

  const discardDraft = useCallback(
    async (draft: AiCommentDraft) => {
      await updateAiCommentDraft(apiBaseUrl, await getToken(), draft.aiCommentDraftId, {
        status: "discarded",
      });
    },
    [apiBaseUrl, getToken],
  );

  const openAnnotation = useCallback(
    (annotationId: string) => {
      ai?.closePanel();
      revealAnnotationAndHideList(annotationId);
    },
    [ai, revealAnnotationAndHideList],
  );

  const openMention = useCallback(
    (mention: AiMention) => {
      if (mention.kind === "flow" || mention.kind === "data_model") {
        ai?.openInEditor(mention.kind, mention.id);
      } else if (mention.kind === "epic") {
        ai?.closePanel();
        openReference({ kind: "epic", id: mention.id });
      } else if (mention.kind === "annotation") {
        openAnnotation(mention.id);
      }
    },
    [ai, openAnnotation, openReference],
  );

  return useMemo(
    () => ({
      openMention,
      previewBatch,
      openBatch,
      rejectBatch,
      postDraft,
      discardDraft,
      openAnnotation,
    }),
    [openMention, previewBatch, openBatch, rejectBatch, postDraft, discardDraft, openAnnotation],
  );
}
