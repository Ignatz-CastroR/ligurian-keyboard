/*
 * env.d.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:11:20, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tell TypeScript about Vite's import.meta.env and the two
 *           settings the Users section reads from the root .env file,
 *           the same two as the lexicon manager.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
