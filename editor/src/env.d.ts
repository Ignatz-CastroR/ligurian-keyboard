/*
 * env.d.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:54, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/20, 02:13:10: the two settings of the site's bar,
 *           which asks the database for the dictionary's size.
 * Purpose:  Tell TypeScript about Vite's import.meta.env. The editor
 *           itself never talks to the database; only the bar at the
 *           top of the page does, for the dictionary's size.
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
