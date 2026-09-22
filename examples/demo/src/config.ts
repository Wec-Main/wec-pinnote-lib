export const DEMO_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_ANNOTATION_API_URL ?? "http://localhost:4000/api/v1/pinnote",
  projectId: import.meta.env.VITE_ANNOTATION_PROJECT_ID ?? "wec-lib",
  useMockApi: import.meta.env.VITE_USE_MOCK_API === "true",
} as const;
