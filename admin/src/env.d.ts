/*
 * env.d.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:19:45, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tell TypeScript about Vite's import.meta.env and the two
 *           settings the lexicon manager reads from the root .env file.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
