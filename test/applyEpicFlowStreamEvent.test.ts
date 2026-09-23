import { describe, expect, it } from "vitest";
import { applyEpicFlowStreamEvent } from "../src/utils/applyEpicFlowStreamEvent";
import type { Epic, UserStory } from "../src/types/epicFlow.types";
import type { StreamEvent, StreamEventType } from "../src/types/stream.types";

function epic(id: string, updatedAt: string, title = "Epic"): Epic {
  return {
    id,
    organizationId: "org-1",
    projectId: "project-1",
    title,
    description: "",
    status: "backlog",
    position: 0,
    createdByUser: "Priya",
    createdById: "user-1",
    updatedByUser: "Priya",
    updatedById: "user-1",
    createdAt: updatedAt,
    updatedAt,
  };
}

function story(id: string, epicId: string, updatedAt: string, title = "Story"): UserStory {
  return {
    id,
    organizationId: "org-1",
    projectId: "project-1",
    epicId,
    title,
    description: "",
    status: "backlog",
    position: 0,
    createdByUser: "Priya",
    createdById: "user-1",
    updatedByUser: "Priya",
    updatedById: "user-1",
    createdAt: updatedAt,
    updatedAt,
  };
}

function event(eventType: StreamEventType, payload: unknown, eventId = "1"): StreamEvent {
  return {
    eventId,
    projectId: "project-1",
    pageKey: "__epicflow__",
    eventType,
    annotationId: null,
    commentId: null,
    actorUserId: "user-2",
    payload,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("applyEpicFlowStreamEvent", () => {
  it("appends a new epic", () => {
    const incoming = epic("e-1", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent([], [], event("epic.created", { epic: incoming }));

    expect(result.epics.map((item) => item.id)).toEqual(["e-1"]);
  });

  it("does not duplicate an epic the client already has", () => {
    const existing = epic("e-1", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent(
      [existing],
      [],
      event("epic.created", { epic: epic("e-1", "2026-01-01T00:00:00.000Z", "Replayed") }),
    );

    expect(result.epics).toHaveLength(1);
  });

  it("replaces an epic by id on update", () => {
    const existing = epic("e-1", "2026-01-01T00:00:00.000Z", "Old title");
    const incoming = epic("e-1", "2026-01-01T00:00:05.000Z", "New title");

    const result = applyEpicFlowStreamEvent(
      [existing],
      [],
      event("epic.updated", { epic: incoming }),
    );

    expect(result.epics[0]?.title).toBe("New title");
  });

  it("ignores an epic update older than local state", () => {
    const existing = epic("e-1", "2026-01-01T00:00:10.000Z", "Current title");
    const stale = epic("e-1", "2026-01-01T00:00:00.000Z", "Stale title");

    const result = applyEpicFlowStreamEvent([existing], [], event("epic.updated", { epic: stale }));

    expect(result.epics[0]?.title).toBe("Current title");
  });

  it("removes an epic by id on delete", () => {
    const existing = epic("e-1", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent(
      [existing],
      [],
      event("epic.deleted", { epicId: "e-1" }),
    );

    expect(result.epics).toHaveLength(0);
  });

  it("cascades an epic delete to its user stories", () => {
    const existingEpic = epic("e-1", "2026-01-01T00:00:00.000Z");
    const ownStory = story("s-1", "e-1", "2026-01-01T00:00:00.000Z");
    const otherStory = story("s-2", "e-2", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent(
      [existingEpic],
      [ownStory, otherStory],
      event("epic.deleted", { epicId: "e-1" }),
    );

    expect(result.userStories.map((item) => item.id)).toEqual(["s-2"]);
  });

  it("appends a new user story", () => {
    const incoming = story("s-1", "e-1", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent(
      [],
      [],
      event("user_story.created", { userStory: incoming }),
    );

    expect(result.userStories.map((item) => item.id)).toEqual(["s-1"]);
  });

  it("does not duplicate a user story the client already has", () => {
    const existing = story("s-1", "e-1", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent(
      [],
      [existing],
      event("user_story.created", {
        userStory: story("s-1", "e-1", "2026-01-01T00:00:00.000Z", "Replayed"),
      }),
    );

    expect(result.userStories).toHaveLength(1);
  });

  it("replaces a user story by id on update", () => {
    const existing = story("s-1", "e-1", "2026-01-01T00:00:00.000Z", "Old title");
    const incoming = story("s-1", "e-1", "2026-01-01T00:00:05.000Z", "New title");

    const result = applyEpicFlowStreamEvent(
      [],
      [existing],
      event("user_story.updated", { userStory: incoming }),
    );

    expect(result.userStories[0]?.title).toBe("New title");
  });

  it("ignores a user story update older than local state", () => {
    const existing = story("s-1", "e-1", "2026-01-01T00:00:10.000Z", "Current title");
    const stale = story("s-1", "e-1", "2026-01-01T00:00:00.000Z", "Stale title");

    const result = applyEpicFlowStreamEvent(
      [],
      [existing],
      event("user_story.updated", { userStory: stale }),
    );

    expect(result.userStories[0]?.title).toBe("Current title");
  });

  it("removes a user story by id on delete", () => {
    const existing = story("s-1", "e-1", "2026-01-01T00:00:00.000Z");

    const result = applyEpicFlowStreamEvent(
      [],
      [existing],
      event("user_story.deleted", { userStoryId: "s-1" }),
    );

    expect(result.userStories).toHaveLength(0);
  });

  it("leaves state untouched for a malformed payload", () => {
    const epics = [epic("e-1", "2026-01-01T00:00:00.000Z")];
    const userStories = [story("s-1", "e-1", "2026-01-01T00:00:00.000Z")];

    const result = applyEpicFlowStreamEvent(epics, userStories, event("epic.updated", null));

    expect(result.epics).toBe(epics);
    expect(result.userStories).toBe(userStories);
  });

  it("leaves state untouched for an unrelated event type", () => {
    const epics = [epic("e-1", "2026-01-01T00:00:00.000Z")];
    const userStories = [story("s-1", "e-1", "2026-01-01T00:00:00.000Z")];

    const result = applyEpicFlowStreamEvent(
      epics,
      userStories,
      event("annotation.created", { annotation: {} }),
    );

    expect(result.epics).toBe(epics);
    expect(result.userStories).toBe(userStories);
  });
});
