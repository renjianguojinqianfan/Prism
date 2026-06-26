/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ANALYZE_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
