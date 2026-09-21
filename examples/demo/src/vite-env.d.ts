/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANNOTATION_API_URL?: string;
  readonly VITE_ANNOTATION_PROJECT_ID?: string;
  readonly VITE_USE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
