function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const DEMO_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_ANNOTATION_API_URL ?? "http://localhost:4000/api/v1/pinnote",
  projectId: requireEnv("VITE_ANNOTATION_PROJECT_ID", import.meta.env.VITE_ANNOTATION_PROJECT_ID),
  useMockApi: import.meta.env.VITE_USE_MOCK_API === "true",
} as const;
