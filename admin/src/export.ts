/*
 * export.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 07:27:39, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Turn the published lexicon, exported by the database as TSV,
 *           into CSV for spreadsheets.
 * Format:   RFC 4180: comma separated; a field is quoted when it holds a
 *           comma, a double quote, a line break or surrounding spaces,
 *           and a double quote inside it is written twice; every line,
 *           the last one included, ends with CRLF. The file starts with
 *           a UTF-8 byte order mark, so that Excel reads the Ligurian
 *           letters correctly.
 * Contract: Pure functions, no browser objects. The TSV's "#" comment
 *           lines are dropped, since CSV has no comments; the header row
 *           and every data row are kept, in order and unchanged.
 * Decision: docs/decisions/0023-lexicon-manager-spanish-history-csv.md
 */

export const CSV_BOM: string = "﻿";
const CRLF: string = "\r\n";

// One CSV field, quoted only when RFC 4180 requires it.
export function csvField(value: string): string {
  const needsQuotes: boolean = /[",\r\n]/.test(value) || value !== value.trim();
  return needsQuotes ? `"${value.replace(/"/g, "\"\"")}"` : value;
}

export function tsvToCsv(tsv: string): string {
  const rows: string[] = tsv
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.startsWith("#"))
    .map((line) => line.split("\t").map(csvField).join(","));
  return CSV_BOM + rows.map((row) => row + CRLF).join("");
}
