/*
 * vite.config.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 18:28:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the dictionary for readers into static files
 *           [dictionary/dist], published under /dizionario/.
 * Contract: The .env file is read from the repository root, the same
 *           one every part of the project uses; only the publishable
 *           key is read, never the secret one.
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
