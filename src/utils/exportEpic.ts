import type { Epic, UserStory } from "../types/epicFlow.types";

export interface EpicExport extends Epic {
  userStories: UserStory[];
}

export function buildEpicExport(epic: Epic, allUserStories: UserStory[]): EpicExport {
  const userStories = allUserStories
    .filter((story) => story.epicId === epic.id)
    .sort((a, b) => a.position - b.position)
    .map((story) => ({ ...story }));
  return { ...epic, userStories };
}

export function epicExportFilename(epic: Pick<Epic, "id" | "title">): string {
  const slug = epic.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `epic-${slug || epic.id}.json`;
}
