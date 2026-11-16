/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Build-time override for where manifest.json lives (relative to the page, or absolute). */
  readonly VITE_MANIFEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
