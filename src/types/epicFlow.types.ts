export interface Epic {
  id: string;
  title: string;
  description: string;
  createdByUser: string;
  createdById: string;
  createdAt: string;
}

export interface UserStory {
  id: string;
  epicId: string;
  title: string;
  description: string;
  createdByUser: string;
  createdById: string;
  createdAt: string;
}

export interface EpicFlowFormInput {
  title: string;
  description: string;
}
