import type { Epic, UserStory } from "../types/epicFlow.types";
import type { StreamEvent } from "../types/stream.types";
import { isEpic, isUserStory, upsertById } from "./streamPayloadGuards";

export interface EpicFlowStreamApplication {
  epics: Epic[];
  userStories: UserStory[];
}

export function applyEpicFlowStreamEvent(
  epics: Epic[],
  userStories: UserStory[],
  event: StreamEvent,
): EpicFlowStreamApplication {
  const unchanged: EpicFlowStreamApplication = { epics, userStories };
  const payload = event.payload;
  if (!payload || typeof payload !== "object") {
    return unchanged;
  }

  switch (event.eventType) {
    case "epic.created":
    case "epic.updated": {
      const { epic } = payload as { epic: unknown };
      if (!isEpic(epic)) {
        return unchanged;
      }
      return { epics: upsertById(epics, epic), userStories };
    }

    case "epic.deleted": {
      const { epicId } = payload as { epicId: string };
      if (!epicId || !epics.some((item) => item.id === epicId)) {
        return unchanged;
      }
      return {
        epics: epics.filter((item) => item.id !== epicId),
        userStories: userStories.filter((item) => item.epicId !== epicId),
      };
    }

    case "user_story.created":
    case "user_story.updated": {
      const { userStory } = payload as { userStory: unknown };
      if (!isUserStory(userStory)) {
        return unchanged;
      }
      return { epics, userStories: upsertById(userStories, userStory) };
    }

    case "user_story.deleted": {
      const { userStoryId } = payload as { userStoryId: string };
      if (!userStoryId || !userStories.some((item) => item.id === userStoryId)) {
        return unchanged;
      }
      return {
        epics,
        userStories: userStories.filter((item) => item.id !== userStoryId),
      };
    }

    default:
      return unchanged;
  }
}
