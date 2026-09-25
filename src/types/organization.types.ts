export interface Organization {
  id: string;
  companyName: string;
  slug: string;
  countryCode?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDraft {
  companyName: string;
  slug: string;
  countryCode?: string;
  status: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDraft {
  organizationId: string;
  name: string;
  description?: string;
  status: string;
}
