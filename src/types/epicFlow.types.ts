export type EpicFlowStatus = "backlog" | "in_progress" | "done" | "archived";

export interface Epic {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string;
  status: EpicFlowStatus;
  position: number;
  createdByUser: string;
  createdById: string | null;
  updatedByUser: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserStory {
  id: string;
  organizationId: string;
  projectId: string;
  epicId: string;
  title: string;
  description: string;
  status: EpicFlowStatus;
  position: number;
  createdByUser: string;
  createdById: string | null;
  updatedByUser: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EpicFlowFormInput {
  title: string;
  description: string;
}
