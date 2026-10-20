/*
 * validate-lexicon.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 03:41:29, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Check one lexicon TSV file and print what is wrong or
 *           suspicious in it, without changing it: the daily dictionary
 *           snapshot, a contributor's file, a file before a bulk import.
 *           The checks live in engine/src/validate.ts.
 * Usage:    node tools/validate-lexicon.ts <file.tsv>
 * Returns:  exit code 0 when the file has no error and no duplicate,
 *           whatever its collisions and warnings; 1 when it has either;
 *           2 when the arguments are wrong or the file cannot be read as
 *           UTF-8 text, in which case only a one line message is printed.
 * Contract: The report goes to standard output; a usage or read problem
 *           goes to standard error. The file is only read.
 */

import { readFileSync } from "node:fs";
import { exitCodeOf, formatReport, validateLexicon, type ValidationReport } from "../engine/src/validate.ts";

const USAGE: string = "Usage: node tools/validate-lexicon.ts <file.tsv>";

type TextRead = { ok: true; text: string } | { ok: false; problem: string };

// The file's text, or why it cannot be had.
function readText(path: string): TextRead {
  let result: TextRead;
  try {
    const bytes: Uint8Array = readFileSync(path);
    result = decodeUtf8(bytes);
  } catch (error: unknown) {
    result = { ok: false, problem: error instanceof Error ? error.message : String(error) };
  }
  return result;
}

// Strict UTF-8: a UTF-16 file or a stray byte is refused, never turned
// into U+FFFD. The byte order mark is kept, because removing it is the
// checker's rule.
function decodeUtf8(bytes: Uint8Array): TextRead {
  let result: TextRead;
  try {
    result = { ok: true, text: new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) };
  } catch {
    result = { ok: false, problem: "not UTF-8 text" };
  }
  return result;
}

function main(): void {
  const args: string[] = process.argv.slice(2);
  const path: string = args[0] ?? "";
  // An argument that starts with "-" is an option this tool does not
  // have, such as --help: it gets the usage line, not "cannot read".
  if (args.length !== 1 || path === "" || path.startsWith("-")) {
    console.error(USAGE);
    process.exitCode = 2;
  } else {
    const read: TextRead = readText(path);
    if (!read.ok) {
      console.error(`Cannot read ${path}: ${read.problem}.`);
      process.exitCode = 2;
    } else {
      const report: ValidationReport = validateLexicon(read.text);
      process.stdout.write(formatReport(report, path));
      process.exitCode = exitCodeOf(report);
    }
  }
}

main();
