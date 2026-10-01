/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly WEC_PINNOTE_API_URL?: string;
  readonly WEC_USE_MOCK_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
