/*
 * build-keyman.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:01:24, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the Keyman keyboard and dictionary packages from the
 *           dictionary snapshot the web editor uses.
 * Usage:    npm run keyman:build, after npm run lexicon:snapshot [the real
 *           dictionary] or npm run lexicon:fixture [the test words].
 * Returns:  exit code 0 with keyman/dist/ holding ligurian_keyboard.kmp,
 *           ignatzcastror.lij.ligurian_keyboard.model.kmp and
 *           packages.json; exit code 1, with every reason printed and
 *           keyman/dist/ untouched, when the snapshot is missing or bad
 *           or kmc fails.
 * Contract: The snapshot is read from editor/public/lexicon.tsv, so the
 *           keyboard and the editor always offer the same words.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BuildError, buildPackages, DEFAULT_OUT_DIR, DEFAULT_STAGE_DIR, type Manifest } from "../keyman/src/build.ts";

const SNAPSHOT: string = fileURLToPath(new URL("../editor/public/lexicon.tsv", import.meta.url));

function main(): void {
  if (!existsSync(SNAPSHOT)) {
    console.error(`No dictionary snapshot at ${SNAPSHOT}.`);
    console.error("Run npm run lexicon:snapshot [or lexicon:fixture] first.");
    process.exitCode = 1;
  } else {
    try {
      const manifest: Manifest = buildPackages(readFileSync(SNAPSHOT, "utf8"), {
        outDir: DEFAULT_OUT_DIR,
        stageDir: DEFAULT_STAGE_DIR,
        now: new Date(),
      });
      console.log(`Keyman packages written to ${DEFAULT_OUT_DIR}:`);
      console.log(`  ${manifest.keyboard.file}  version ${manifest.keyboard.version}`);
      console.log(`  ${manifest.model.file}  version ${manifest.model.version}, ${manifest.model.words} words`);
    } catch (error: unknown) {
      if (error instanceof BuildError) {
        console.error("The Keyman build failed; nothing was written:");
        for (const problem of error.problems) {
          console.error(`  ${problem}`);
        }
        process.exitCode = 1;
      } else {
        throw error;
      }
    }
  }
}

main();
