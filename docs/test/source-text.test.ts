/*
 * source-text.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 11:31:18, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  No invisible character is written literally in the project's
 *           text files: a byte order mark, a zero width space or joiner,
 *           a word joiner or a no-break space must be written as an
 *           escape, where a reader can see it. The rule was broken three
 *           times by hand [admin/src/export.ts in 0.7.0,
 *           engine/src/lexicon.ts and corpus/src/frequency-list.ts in
 *           0.8.0] before this test existed.
 * Contract: Every text file of the repository is read, except generated
 *           and installed folders. The one allowed exception is the byte
 *           order mark at the very start of a Keyman .kmn source, which
 *           is the file's encoding mark, not a character in its text.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT: string = fileURLToPath(new URL("../../", import.meta.url));
const SKIPPED_DIRS: ReadonlySet<string> = new Set([
  ".git", "node_modules", "_site", "dist", "build", "coverage", "HISTORICAL", "INSTRUCTIONS",
]);
const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  ".ts", ".js", ".json", ".md", ".html", ".htm", ".css", ".sql", ".yml", ".yaml",
  ".tsv", ".txt", ".kmn", ".kps", ".kpj", ".keyman-touch-layout", ".example", "",
]);
const INVISIBLE: RegExp = /[\uFEFF\u200B\u200C\u200D\u2060\u00A0]/gu;

function textFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path: string = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        found.push(...textFiles(path));
      }
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
      found.push(path);
    }
  }
  return found;
}

test("no invisible character is written literally in any text file", () => {
  const files: string[] = textFiles(ROOT);
  assert.ok(files.some((f) => f.endsWith("lexicon.ts")), "the scan reaches the sources");
  const offenders: string[] = [];
  for (const file of files) {
    const text: string = readFileSync(file, "utf8");
    const body: string = extname(file) === ".kmn" ? text.replace(/^\uFEFF/u, "") : text;
    for (const match of body.matchAll(INVISIBLE)) {
      const line: number = body.slice(0, match.index).split("\n").length;
      offenders.push(`${relative(ROOT, file)}:${line}: U+${(match[0].codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`);
    }
  }
  assert.deepEqual(offenders, []);
});
