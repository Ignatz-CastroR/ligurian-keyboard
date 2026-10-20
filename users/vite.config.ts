/*
 * vite.config.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:11:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the Users section into static files [users/dist],
 *           published under /utenti/ by tools/assemble-site.ts.
 * Contract: As for the lexicon manager: the .env file is read from the
 *           repository root, and only variables starting with VITE_
 *           reach the browser; the secret key must never be given such
 *           a name.
 */

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here: string = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: here,
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
