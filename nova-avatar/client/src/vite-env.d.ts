/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_MODEL_URL?: string;
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
