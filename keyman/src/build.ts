/*
 * build.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:01:14, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Build the two Keyman packages from a dictionary snapshot:
 *             ligurian_keyboard.kmp                       the keyboard
 *             ignatzcastror.lij.ligurian_keyboard.model.kmp  the dictionary
 *           plus packages.json, which tells the site's install page
 *           what was built.
 * Method:   1. Turn the snapshot into the model's word list [wordlist.ts].
 *           2. Copy both Keyman projects into a staging folder, write the
 *              word list there and set the model package's version; the
 *              committed sources are never modified.
 *           3. Compile each project with kmc, Keyman's own compiler,
 *              warnings treated as errors.
 *           4. Copy the two packages and the manifest to the output folder.
 * Contract: Throws BuildError with every reason when the snapshot is bad
 *           or kmc fails; then nothing is written to the output folder.
 *           kmc always runs with --no-error-reporting, so no build ever
 *           sends data to Keyman's error reporting service.
 * Decision: docs/decisions/0022-keyman-keyboard-design.md
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWordlist, type Wordlist, type WordlistResult } from "./wordlist.ts";

export const KEYBOARD_ID: string = "ligurian_keyboard";
export const MODEL_ID: string = "ignatzcastror.lij.ligurian_keyboard";
export const KEYBOARD_PACKAGE: string = `${KEYBOARD_ID}.kmp`;
export const MODEL_PACKAGE: string = `${MODEL_ID}.model.kmp`;
export const MANIFEST: string = "packages.json";

// The placeholder version in the committed .model.kps.
export const MODEL_VERSION_PLACEHOLDER: string = "<Version URL=\"\">0.0.0</Version>";

export const KEYMAN_DIR: string = fileURLToPath(new URL("..", import.meta.url));

// Where the command-line build stages and publishes [both gitignored].
export const DEFAULT_STAGE_DIR: string = join(KEYMAN_DIR, "build", "stage");
export const DEFAULT_OUT_DIR: string = join(KEYMAN_DIR, "dist");

export class BuildError extends Error {
  public readonly problems: string[];

  public constructor(problems: string[]) {
    super(problems.join("\n"));
    this.name = "BuildError";
    this.problems = problems;
  }
}

export interface Manifest {
  keyboard: { id: string; file: string; version: string };
  model: { id: string; file: string; version: string; words: number; snapshot: string | null };
}

export interface BuildOptions {
  outDir: string;     // receives the two packages and packages.json
  stageDir: string;   // emptied, then holds the staged projects; kept
                      // after the build for inspection and tests
  now: Date;          // dates the model when the snapshot is unstamped
  compile?: (projectFile: string) => void;
                      // compiles one staged project; kmc by default.
                      // Tests replace it to simulate a failing kmc.
}

// The keyboard's version, read from its source: &KEYBOARDVERSION.
export function keyboardVersion(): string {
  const kmn: string = readFileSync(join(KEYMAN_DIR, KEYBOARD_ID, "source", `${KEYBOARD_ID}.kmn`), "utf8");
  const match: RegExpMatchArray | null = kmn.match(/^store\(&KEYBOARDVERSION\) '([^']+)'/m);
  if (match === null || match[1] === undefined) {
    throw new BuildError([`${KEYBOARD_ID}.kmn has no store(&KEYBOARDVERSION)`]);
  }
  return match[1];
}

// Copy a Keyman project without any earlier build output inside it.
function stageProject(id: string, stageDir: string): string {
  const target: string = join(stageDir, id);
  cpSync(join(KEYMAN_DIR, id), target, {
    recursive: true,
    filter: (src: string): boolean => !/[\\/]build([\\/]|$)/.test(src.slice(KEYMAN_DIR.length)),
  });
  return target;
}

// kmc's own entry point. The path inside the package is safe only
// because package.json pins kmc exactly; check it when upgrading kmc.
function kmcEntry(): string {
  const require: NodeJS.Require = createRequire(import.meta.url);
  return join(dirname(require.resolve("@keymanapp/kmc/package.json")), "build", "src", "kmc.js");
}

// The kmc command line for one project. --no-error-reporting keeps every
// build from sending data to Keyman's error reporting service; warnings
// fail the build. A test checks both flags.
export function kmcArguments(projectFile: string): string[] {
  return ["build", "--no-error-reporting", "--compiler-warnings-as-errors", "--no-color", projectFile];
}

// Run kmc on one project file; every line it printed is kept for errors.
export function compileWithKmc(projectFile: string): void {
  const run: SpawnSyncReturns<string> = spawnSync(
    process.execPath,
    [kmcEntry(), ...kmcArguments(projectFile)],
    { encoding: "utf8" },
  );
  if (run.error !== undefined || run.status !== 0) {
    const output: string = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim();
    throw new BuildError([
      `kmc failed on ${projectFile} [exit ${run.status ?? "none"}]`,
      ...(run.error !== undefined ? [run.error.message] : []),
      ...output.split(/\r?\n/),
    ]);
  }
}

export function buildPackages(snapshotText: string, options: BuildOptions): Manifest {
  const { outDir, stageDir, now } = options;
  const compile: (projectFile: string) => void = options.compile ?? compileWithKmc;
  const result: WordlistResult = buildWordlist(snapshotText, now);
  if (!result.ok) {
    throw new BuildError(result.problems);
  }
  const wordlist: Wordlist = result.wordlist;

  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });

  const keyboardDir: string = stageProject(KEYBOARD_ID, stageDir);
  const modelDir: string = stageProject(MODEL_ID, stageDir);

  writeFileSync(join(modelDir, "source", "wordlist.tsv"), wordlist.tsv, "utf8");
  const kpsPath: string = join(modelDir, "source", `${MODEL_ID}.model.kps`);
  const kps: string = readFileSync(kpsPath, "utf8");
  if (!kps.includes(MODEL_VERSION_PLACEHOLDER)) {
    throw new BuildError([`${MODEL_ID}.model.kps lost its version placeholder ${MODEL_VERSION_PLACEHOLDER}`]);
  }
  writeFileSync(kpsPath, kps.replace(MODEL_VERSION_PLACEHOLDER, `<Version URL="">${wordlist.version}</Version>`), "utf8");

  compile(join(keyboardDir, `${KEYBOARD_ID}.kpj`));
  compile(join(modelDir, `${MODEL_ID}.kpj`));

  const builtKeyboard: string = join(keyboardDir, "build", KEYBOARD_PACKAGE);
  const builtModel: string = join(modelDir, "build", MODEL_PACKAGE);
  const missing: string[] = [builtKeyboard, builtModel].filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new BuildError(missing.map((file) => `kmc reported success but did not write ${file}`));
  }

  const manifest: Manifest = {
    keyboard: { id: KEYBOARD_ID, file: KEYBOARD_PACKAGE, version: keyboardVersion() },
    model: {
      id: MODEL_ID,
      file: MODEL_PACKAGE,
      version: wordlist.version,
      words: wordlist.words,
      snapshot: wordlist.takenAt,
    },
  };

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyFileSync(builtKeyboard, join(outDir, KEYBOARD_PACKAGE));
  copyFileSync(builtModel, join(outDir, MODEL_PACKAGE));
  writeFileSync(join(outDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return manifest;
}
