/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

interface ImportMetaEnv {
  readonly VITE_ANALYZE_ENDPOINT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
