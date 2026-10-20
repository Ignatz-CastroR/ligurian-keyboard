/*
 * vite.config.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:54, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the web editor into static files [editor/dist]. The
 *           public/ folder [lexicon.tsv, sw.js] is copied as it is.
 * Contract: base "./" keeps every address relative, so the editor works
 *           at the root of the Pages site and on a local preview alike.
 * Updated:  2026/10/20, 03:08:20: the .env file is read from the
 *           repository root, as by every other section, for the
 *           dictionary's size in the site's bar; only variables
 *           starting with VITE_ reach the browser.
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
