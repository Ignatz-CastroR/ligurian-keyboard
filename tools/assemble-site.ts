/*
 * assemble-site.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:12:33, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 04:06:59: the Keyman packages under tastiera/.
 * Updated:  2026/10/18, 18:36:10: the dictionary for readers under
 *           dizionario/ [decision 0034].
 * Updated:  2026/10/20, 02:19:05: the Users section under utenti/, and
 *           the site bar's stylesheet at the root for the install page
 *           [decision 0035].
 * Purpose:  Join the builds into the one site GitHub Pages serves:
 *             _site/            the web editor      [from editor/dist]
 *             _site/admin/      the lexicon manager [from admin/dist]
 *             _site/dizionario/ the dictionary for readers [from
 *                               dictionary/dist]
 *             _site/utenti/     the Users section [from users/dist]
 *             _site/site-bar.css the look of the bar of five sections
 *                               [from site/bar.css], for the static
 *                               install page
 *             _site/tastiera/   the Android install page [from
 *                               editor/dist] and the Keyman packages
 *                               [from keyman/dist]
 * Usage:    npm run site:build [which builds everything first]
 * Returns:  exit code 1, and no _site folder, when a build, the
 *           dictionary snapshot or a Keyman package is missing.
 */

import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KEYBOARD_PACKAGE, MANIFEST, MODEL_PACKAGE } from "../keyman/src/build.ts";

const path = (relative: string): string => fileURLToPath(new URL(`../${relative}`, import.meta.url));

const SITE: string = path("_site");
const KEYMAN_FILES: readonly string[] = [KEYBOARD_PACKAGE, MODEL_PACKAGE, MANIFEST];
const REQUIRED: readonly string[] = [
  "editor/dist/index.html",
  "editor/dist/lexicon.tsv",
  "editor/dist/tastiera/index.html",
  "admin/dist/index.html",
  "dictionary/dist/index.html",
  "users/dist/index.html",
  "site/bar.css",
  ...KEYMAN_FILES.map((file) => `keyman/dist/${file}`),
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
  cpSync(path("dictionary/dist"), path("_site/dizionario"), { recursive: true });
  cpSync(path("users/dist"), path("_site/utenti"), { recursive: true });
  cpSync(path("site/bar.css"), path("_site/site-bar.css"));
  for (const file of KEYMAN_FILES) {
    cpSync(path(`keyman/dist/${file}`), path(`_site/tastiera/${file}`));
  }
  console.log(`Site assembled in ${SITE}`);
}
