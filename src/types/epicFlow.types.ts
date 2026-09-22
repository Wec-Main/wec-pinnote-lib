export type EpicPriority = "low" | "medium" | "high";
export type EpicStatus = "planned" | "in-progress" | "done";

export interface Epic {
  id: string;
  title: string;
  description: string;
  priority?: EpicPriority;
  status?: EpicStatus;
  targetRelease?: string;
  tags?: string[];
}

export type UserStoryStatus = "todo" | "in-progress" | "done";

export interface UserStory {
  id: string;
  epicId: string;
  title: string;
  description?: string;
  status: UserStoryStatus;
  priority?: EpicPriority;
  assignee?: string;
  sprint?: string;
  tags?: string[];
}

export interface EpicNote {
  id: string;
  epicId: string;
  title: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}
