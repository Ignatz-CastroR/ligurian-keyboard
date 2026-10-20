/*
 * env.d.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 18:12:58, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The two build settings Vite gives the page, the same as the
 *           lexicon manager's: the Supabase address and its publishable
 *           key, which is public by design.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
