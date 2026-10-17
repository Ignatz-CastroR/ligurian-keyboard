/*
 * assemble-site.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 02:12:33, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Join the two builds into the one site GitHub Pages serves:
 *             _site/          the web editor     [from editor/dist]
 *             _site/admin/    the lexicon manager [from admin/dist]
 * Usage:    npm run site:build [which builds both first]
 * Returns:  exit code 1, and no _site folder, when either build or the
 *           dictionary snapshot is missing.
 */

import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const path = (relative: string): string => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const SITE: string = path("_site");
const REQUIRED: readonly string[] = [
  "editor/dist/index.html",
  "editor/dist/lexicon.tsv",
  "admin/dist/index.html",
];

const missing: string[] = REQUIRED.filter((file) => !existsSync(path(file)));

rmSync(SITE, { recursive: true, force: true });
if (missing.length > 0) {
  console.error(`Cannot assemble the site; missing: ${missing.join(", ")}`);
  console.error("Run npm run lexicon:snapshot [or lexicon:fixture] before npm run site:build.");
  process.exitCode = 1;
} else {
  cpSync(path("editor/dist"), SITE, { recursive: true });
  cpSync(path("admin/dist"), path("_site/admin"), { recursive: true });
  console.log(`Site assembled in ${SITE}`);
}
