import { describe, expect, it } from "vitest";
import { buildEpicExport, epicExportFilename } from "../src/utils/epicFlow/exportEpic";
import type { Epic, UserStory } from "../src/types/epicFlow.types";

const base = {
  organizationId: "o1",
  projectId: "p1",
  description: "d",
  status: "backlog" as const,
  createdByUser: "Ada",
  createdById: "u1",
  updatedByUser: null,
  updatedById: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const epic = (id: string, title = "Login Flow!"): Epic => ({ ...base, id, title, position: 0 });
const story = (id: string, epicId: string, position: number): UserStory => ({
  ...base,
  id,
  epicId,
  title: id,
  position,
});

describe("buildEpicExport", () => {
  it("includes only the epic's stories with all fields, ordered by position", () => {
    const stories = [story("s2", "e1", 2), story("x", "e2", 0), story("s1", "e1", 1)];
    const out = buildEpicExport(epic("e1"), stories);
    expect(out.id).toBe("e1");
    expect(out.userStories.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(out.userStories[0]).toEqual(stories[2]);
  });
  it("returns empty userStories when none", () => {
    expect(buildEpicExport(epic("e1"), []).userStories).toEqual([]);
  });
});

describe("epicExportFilename", () => {
  it("slugs the title", () => expect(epicExportFilename(epic("e1"))).toBe("epic-login-flow.json"));
  it("falls back to id", () => expect(epicExportFilename(epic("e1", "!!!"))).toBe("epic-e1.json"));
});
