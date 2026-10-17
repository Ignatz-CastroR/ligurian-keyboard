/*
 * vite.config.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:54, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the web editor into static files [editor/dist]. The
 *           public/ folder [lexicon.tsv, sw.js] is copied as it is.
 * Contract: base "./" keeps every address relative, so the editor works
 *           at the root of the Pages site and on a local preview alike.
 */

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here: string = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: here,
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
