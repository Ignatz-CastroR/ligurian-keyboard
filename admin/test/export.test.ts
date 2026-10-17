/*
 * export.test.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/17, 07:30:01, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the TSV to CSV conversion [admin/src/export.ts]:
 *           RFC 4180 quoting, line endings, the byte order mark, and a
 *           round trip back to the original rows.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CSV_BOM, csvField, tsvToCsv } from "../src/export.ts";

const FIXTURE: string = readFileSync(new URL("../../data/fixtures/test-lexicon.tsv", import.meta.url), "utf8");

// A strict RFC 4180 reader, written independently of the code under test.
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field: string = "";
  let quoted: boolean = false;
  let i: number = 0;
  while (i < csv.length) {
    const ch: string = csv.charAt(i);
    if (quoted) {
      if (ch === "\"" && csv.charAt(i + 1) === "\"") {
        field += "\"";
        i += 2;
      } else if (ch === "\"") {
        quoted = false;
        i += 1;
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === "\"") {
      quoted = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r" && csv.charAt(i + 1) === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 2;
    } else {
      field += ch;
      i += 1;
    }
  }
  assert.equal(field, "", "the last line must end with CRLF");
  assert.equal(row.length, 0, "the last line must end with CRLF");
  return rows;
}

function dataLines(tsv: string): string[][] {
  return tsv.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#")).map((l) => l.split("\t"));
}

test("quotes a field only when RFC 4180 requires it", () => {
  assert.equal(csvField("Zêna"), "Zêna");
  assert.equal(csvField("l'ægua"), "l'ægua", "the apostrophe needs no quotes");
  assert.equal(csvField("canpànn-a"), "canpànn-a");
  assert.equal(csvField("a,b"), "\"a,b\"");
  assert.equal(csvField("say \"hi\""), "\"say \"\"hi\"\"\"");
  assert.equal(csvField("two\nlines"), "\"two\nlines\"");
  assert.equal(csvField(" padded "), "\" padded \"", "surrounding spaces survive spreadsheets");
  assert.equal(csvField(""), "");
});

test("starts with a byte order mark and ends every line with CRLF", () => {
  const csv: string = tsvToCsv("form\tfreq\nZêna\t1\n");
  assert.ok(csv.startsWith(CSV_BOM));
  assert.equal(csv, `${CSV_BOM}form,freq\r\nZêna,1\r\n`);
});

test("drops comment and blank lines, keeps the header and every row in order", () => {
  const tsv: string = "# Exported from the ligurian-keyboard lexicon database.\n"
    + "# License: CC BY-SA 4.0.\n"
    + "form\tfreq\tvariety\torthography\tstatus\n\n"
    + "çitæ\t1\tzeneize\tofiçiâ\tapproved\r\n"
    + "Zêna\t2\tzeneize\tofiçiâ\tapproved\n";
  assert.deepEqual(parseCsv(tsvToCsv(tsv).slice(CSV_BOM.length)), [
    ["form", "freq", "variety", "orthography", "status"],
    ["çitæ", "1", "zeneize", "ofiçiâ", "approved"],
    ["Zêna", "2", "zeneize", "ofiçiâ", "approved"],
  ]);
});

test("a byte order mark in the TSV is not carried into the first field", () => {
  const csv: string = tsvToCsv("﻿form\tfreq\nanâ\t1\n");
  assert.equal(csv.indexOf("﻿", 1), -1, "only the CSV's own mark, at the start");
  assert.deepEqual(parseCsv(csv.slice(CSV_BOM.length))[0], ["form", "freq"]);
});

test("round trip: the CSV of the 93 test forms reads back to exactly the TSV rows", () => {
  const rows: string[][] = parseCsv(tsvToCsv(FIXTURE).slice(CSV_BOM.length));
  assert.deepEqual(rows, dataLines(FIXTURE));
  assert.equal(rows.length, 94, "the header and 93 forms");
});

test("hard fields survive the round trip", () => {
  const fields: string[] = ["a,b", "say \"hi\"", " x ", "l'ægua", "Ç,Æ\""];
  const rows: string[][] = parseCsv(tsvToCsv(`h1\th2\th3\th4\th5\n${fields.join("\t")}\n`).slice(CSV_BOM.length));
  assert.deepEqual(rows[1], fields);
});
