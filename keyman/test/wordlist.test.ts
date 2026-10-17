/*
 * wordlist.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 04:03:24, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the snapshot to Keyman word list conversion
 *           [keyman/src/wordlist.ts], on small TSV texts built here.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { stampSnapshot } from "../../editor/src/snapshot.ts";
import { buildWordlist, keymanCount, modelVersion, type WordlistResult } from "../src/wordlist.ts";

const HEADER: string = "form\tfreq\tvariety\torthography\tstatus";
const NOW: Date = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));

function snapshot(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

function words(result: WordlistResult): string[] {
  assert.equal(result.ok, true, result.ok ? "" : result.problems.join("; "));
  return result.ok
    ? result.wordlist.tsv.split("\n").filter((line) => line !== "" && !line.startsWith("#"))
    : [];
}

test("only approved zeneize ofiçiâ forms enter the word list", () => {
  const result: WordlistResult = buildWordlist(snapshot(
    "zenéize\t3\tzeneize\tofiçiâ\tapproved",
    "pénna\t1\tzeneize\tofiçiâ\tpending",
    "savonn-a\t1\tsavoneize\tofiçiâ\tapproved",
    "zeneise\t1\tzeneize\tunitäia\tapproved",
    "anâ\t1\tzeneize\tofiçiâ\trejected",
  ), NOW);
  assert.deepEqual(words(result), ["zenéize\t3"]);
});

test("most frequent first, ties in alphabetical order", () => {
  const result: WordlistResult = buildWordlist(snapshot(
    "çitæ\t2\tzeneize\tofiçiâ\tapproved",
    "anâ\t2\tzeneize\tofiçiâ\tapproved",
    "Zêna\t9\tzeneize\tofiçiâ\tapproved",
    "dî\t1\tzeneize\tofiçiâ\tapproved",
  ), NOW);
  assert.deepEqual(words(result), ["Zêna\t9", "anâ\t2", "çitæ\t2", "dî\t1"]);
});

test("counts are whole numbers of at least 1, so every approved word is reachable", () => {
  assert.equal(keymanCount(0), 1);
  assert.equal(keymanCount(0.4), 1);
  assert.equal(keymanCount(2.5), 3);
  assert.equal(keymanCount(41), 41);
  const result: WordlistResult = buildWordlist(snapshot("anâ\t0\tzeneize\tofiçiâ\tapproved"), NOW);
  assert.deepEqual(words(result), ["anâ\t1"]);
});

test("the version is the snapshot's date, without leading zeros", () => {
  assert.equal(modelVersion("2026/10/07 21:17:03 UTC", NOW), "2026.10.7");
  assert.equal(modelVersion("2027/01/31 00:00:00 UTC", NOW), "2027.1.31");
  assert.equal(modelVersion(null, NOW), "2026.1.2", "unstamped: the build date");
  assert.equal(modelVersion("not a stamp", NOW), "2026.1.2");
  const stamped: string = stampSnapshot(snapshot("anâ\t1\tzeneize\tofiçiâ\tapproved"), new Date(Date.UTC(2026, 9, 17, 3, 17, 0)));
  const result: WordlistResult = buildWordlist(stamped, NOW);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.wordlist.version, "2026.10.17");
    assert.equal(result.wordlist.takenAt, "2026/10/17 03:17:00 UTC");
    assert.equal(result.wordlist.words, 1);
  }
});

test("the header is made of comment lines Keyman skips, and the file ends with a newline", () => {
  const result: WordlistResult = buildWordlist(snapshot("anâ\t1\tzeneize\tofiçiâ\tapproved"), NOW);
  assert.ok(result.ok);
  if (result.ok) {
    const lines: string[] = result.wordlist.tsv.split("\n");
    assert.ok(result.wordlist.tsv.endsWith("\n"));
    assert.ok(lines.slice(0, 5).every((line) => line.startsWith("#")));
    assert.match(result.wordlist.tsv, /CC BY-SA 4\.0/);
    assert.match(result.wordlist.tsv, /unstamped/);
  }
});

test("a snapshot with errors gives the editor's problems and no word list", () => {
  const result: WordlistResult = buildWordlist(snapshot("zen@\t1\tzeneize\tofiçiâ\tapproved"), NOW);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.problems.some((p) => p.includes("invalid form")), result.problems.join("; "));
  }
});

test("a snapshot without one zeneize ofiçiâ form is refused, never packaged empty", () => {
  const result: WordlistResult = buildWordlist(snapshot("savonn-a\t1\tsavoneize\tofiçiâ\tapproved"), NOW);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.problems, ["no approved zeneize ofiçiâ forms: refusing to package an empty dictionary"]);
  }
});
