/*
 * file-names.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 12:31:07, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The names of the files the lexicon manager offers for
 *           download, each stamped with the local date and time of the
 *           click: ligurian-lexicon-20261018-123107.tsv and .csv, and
 *           ligurian-backup-20261018-123107.json.
 * Contract: Pure functions, no browser objects. Digits only in the
 *           stamp, local time, no zone: the names sort by name in the
 *           order they were made, contain no character any file system
 *           forbids, and match what the person's own clock showed.
 * Decision: docs/decisions/0025-csv-semicolon.md [updated in 0.11.0]
 *           and docs/decisions/0031-backups.md
 */

export const LEXICON_FILE_STEM: string = "ligurian-lexicon";
export const BACKUP_FILE_STEM: string = "ligurian-backup";

const two = (n: number): string => String(n).padStart(2, "0");

// 20261018-123107: the local date and time, digits only.
export function localStamp(when: Date): string {
  const date: string = `${when.getFullYear()}${two(when.getMonth() + 1)}${two(when.getDate())}`;
  const time: string = `${two(when.getHours())}${two(when.getMinutes())}${two(when.getSeconds())}`;
  return `${date}-${time}`;
}

// stampedFileName["ligurian-lexicon", "csv", when] gives
// ligurian-lexicon-20261018-123107.csv.
export function stampedFileName(stem: string, extension: string, when: Date): string {
  return `${stem}-${localStamp(when)}.${extension}`;
}

// The published lexicon, as TSV for programs or CSV for spreadsheets.
export function lexiconFileName(extension: "tsv" | "csv", when: Date): string {
  return stampedFileName(LEXICON_FILE_STEM, extension, when);
}
