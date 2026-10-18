/*
 * file-names.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 12:36:18, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of admin/src/file-names.ts: the TSV, CSV and backup
 *           downloads are named by the local date and time of the
 *           click, padded, digits only, sorting in time order.
 * Decision: docs/decisions/0025-csv-semicolon.md [updated in 0.11.0]
 *           and docs/decisions/0031-backups.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backupFileName } from "../src/backup.ts";
import { lexiconFileName, localStamp, stampedFileName } from "../src/file-names.ts";

test("the TSV and CSV downloads carry the local date and time, every field padded to its width", () => {
  const when: Date = new Date(2026, 9, 18, 12, 31, 7);
  assert.equal(lexiconFileName("tsv", when), "ligurian-lexicon-20261018-123107.tsv");
  assert.equal(lexiconFileName("csv", when), "ligurian-lexicon-20261018-123107.csv");
  assert.equal(lexiconFileName("csv", new Date(2027, 0, 2, 3, 4, 5)), "ligurian-lexicon-20270102-030405.csv");
  assert.equal(localStamp(new Date(2026, 11, 31, 23, 59, 59)), "20261231-235959");
  assert.equal(localStamp(new Date(2027, 0, 1, 0, 0, 0)), "20270101-000000");
});

test("names sort in the order the files were made, across days, months and years", () => {
  const moments: Date[] = [
    new Date(2026, 8, 30, 23, 59, 59), new Date(2026, 9, 1, 0, 0, 0), new Date(2026, 9, 1, 9, 0, 0),
    new Date(2026, 9, 10, 0, 0, 0), new Date(2026, 11, 31, 23, 59, 59), new Date(2027, 0, 1, 0, 0, 0),
  ];
  const names: string[] = moments.map((when) => lexiconFileName("tsv", when));
  assert.deepEqual([...names].sort(), names);
});

test("a stamped name holds no character a file system forbids, and the backup shares the stamp", () => {
  const when: Date = new Date(2026, 9, 18, 8, 5, 3);
  for (const name of [lexiconFileName("tsv", when), lexiconFileName("csv", when), backupFileName(when)]) {
    assert.match(name, /^[a-z-]+-\d{8}-\d{6}\.[a-z]+$/u, name);
  }
  assert.equal(backupFileName(when), stampedFileName("ligurian-backup", "json", when));
  assert.equal(backupFileName(when), "ligurian-backup-20261018-080503.json");
});

test("the manager no longer offers a download under a fixed name", () => {
  const main: string = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
  assert.doesNotMatch(main, /"ligurian-lexicon\.(tsv|csv)"/u);
  assert.match(main, /lexiconFileName\("tsv", new Date\(\)\)/u);
  assert.match(main, /lexiconFileName\("csv", new Date\(\)\)/u);
});
