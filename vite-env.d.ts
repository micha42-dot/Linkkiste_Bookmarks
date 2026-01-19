// Reference to vite/client removed to prevent "Cannot find type definition" error
// /// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
