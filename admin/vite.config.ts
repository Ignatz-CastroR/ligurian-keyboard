/*
 * vite.config.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:19:45, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the lexicon manager into static files [admin/dist]
 *           that any static host serves, GitHub Pages included.
 * Contract: The .env file is read from the repository root, the same
 *           one every part of the project uses. Only variables starting
 *           with VITE_ reach the browser; the secret key must never be
 *           given such a name.
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
