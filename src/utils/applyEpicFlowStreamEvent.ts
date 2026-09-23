import type { Epic, UserStory } from "../types/epicFlow.types";
import type { StreamEvent } from "../types/stream.types";

function isNewer(incoming: string, existing: string): boolean {
  return new Date(incoming).getTime() >= new Date(existing).getTime();
}

function upsertById<T extends { id: string; updatedAt: string }>(items: T[], incoming: T): T[] {
  const existing = items.find((item) => item.id === incoming.id);
  if (!existing) {
    return [...items, incoming];
  }
  if (!isNewer(incoming.updatedAt, existing.updatedAt)) {
    return items;
  }
  return items.map((item) => (item.id === incoming.id ? incoming : item));
}

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
      const { epic } = payload as { epic: Epic };
      if (!epic) {
        return unchanged;
      }
      if (event.eventType === "epic.created") {
        const existing = epics.find((item) => item.id === epic.id);
        if (!existing) {
          return { epics: [...epics, epic], userStories };
        }
      }
      return { epics: upsertById(epics, epic), userStories };
    }

    case "epic.deleted": {
      const { epicId } = payload as { epicId: string };
      if (!epicId) {
        return unchanged;
      }
      return {
        epics: epics.filter((item) => item.id !== epicId),
        userStories: userStories.filter((item) => item.epicId !== epicId),
      };
    }

    case "user_story.created":
    case "user_story.updated": {
      const { userStory } = payload as { userStory: UserStory };
      if (!userStory) {
        return unchanged;
      }
      if (event.eventType === "user_story.created") {
        const existing = userStories.find((item) => item.id === userStory.id);
        if (!existing) {
          return { epics, userStories: [...userStories, userStory] };
        }
      }
      return { epics, userStories: upsertById(userStories, userStory) };
    }

    case "user_story.deleted": {
      const { userStoryId } = payload as { userStoryId: string };
      if (!userStoryId) {
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
