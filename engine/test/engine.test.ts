/*
 * engine.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/10, 21:08:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:50:33: the letter ñ [decision 0024].
 * Purpose:  Unit tests for skeleton folding, lexicon loading and token
 *           conversion. Expected spellings come from the Académia
 *           Ligùstica do Brénno alphabet page.
 * Tectonics: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { skeleton, isPlainAscii, Lexicon, convertToken, renderChoice } from "../src/index.ts";

const fixture: Lexicon = Lexicon.fromTsv(readFileSync("data/fixtures/test-lexicon.tsv", "utf8"));

test("skeleton strips every accent and folds æ, ç and ñ", () => {
  assert.equal(skeleton("zenéize"), "zeneize");
  assert.equal(skeleton("tañu"), "tanu");
  assert.equal(skeleton("Ñaro"), "naro");
  assert.equal(skeleton("n\u0303"), "n", "a decomposed ñ is composed first");
  assert.equal(skeleton("çitæ"), "citae");
  assert.equal(skeleton("resciöo"), "rescioo");
  assert.equal(skeleton("crêuzo"), "creuzo");
  assert.equal(skeleton("drûo"), "druo");
});

test("skeleton drops hyphens so nn- needs no special typing", () => {
  assert.equal(skeleton("canpànn-a"), "canpanna");
  assert.equal(skeleton("ænn-a"), "aenna");
});

test("skeleton keeps j, x and apostrophes, which are plain ASCII", () => {
  assert.equal(skeleton("mangjâ"), "mangja");
  assert.equal(skeleton("xàtta"), "xatta");
  assert.equal(skeleton("t’æ"), "t'ae");
});

test("skeleton is idempotent and always yields ASCII for valid forms", () => {
  for (const w of ["zenéize", "çénn-a", "öxélli", "sccéuppo", "Zêna"]) {
    const once: string = skeleton(w);
    assert.equal(skeleton(once), once);
    assert.ok(isPlainAscii(once), `${w} -> ${once}`);
  }
});

test("fixture loads cleanly", () => {
  assert.deepEqual(fixture.errors, []);
  assert.equal(fixture.size, 93);
});

test("a unique match is replaced silently", () => {
  const c = convertToken(fixture, "zeneize");
  assert.equal(c.kind, "replace");
  assert.equal(renderChoice(c, 0), "zenéize");
});

test("pénna and pénn-a collide and open the menu", () => {
  const c = convertToken(fixture, "penna");
  assert.equal(c.kind, "choose");
  assert.deepEqual([...c.candidates].sort(), ["pénn-a", "pénna"]);
});

test("one-letter collisions: e / é and o / ò", () => {
  assert.deepEqual(convertToken(fixture, "e").candidates.sort(), ["e", "é"]);
  assert.deepEqual(convertToken(fixture, "o").candidates.sort(), ["o", "ò"]);
});

test("an exactly typed candidate is offered first", () => {
  const c = convertToken(fixture, "é");
  assert.equal(c.candidates[0], "é");
});

test("unknown words are left as typed", () => {
  const c = convertToken(fixture, "ciao");
  assert.equal(c.kind, "unknown");
  assert.equal(renderChoice(c, 0), "ciao");
});

test("punctuation around the word survives", () => {
  const c = convertToken(fixture, "«zena,");
  assert.equal(renderChoice(c, 0), "«Zêna,");
});

test("casing of the typed word is reapplied", () => {
  assert.equal(renderChoice(convertToken(fixture, "Citae"), 0), "Çitæ");
  assert.equal(renderChoice(convertToken(fixture, "CITAE"), 0), "ÇITÆ");
});

test("proper nouns keep their capital when typed in lowercase", () => {
  assert.equal(renderChoice(convertToken(fixture, "zena"), 0), "Zêna");
});

test("variety filter narrows candidates", () => {
  assert.equal(convertToken(fixture, "zeneize", { variety: "tabarchin" }).kind, "unknown");
});

test("invalid and non approved rows are rejected or skipped", () => {
  const tsv: string = [
    "form\tfreq\tvariety\torthography\tstatus",
    "câza\t5\tzeneize\tofiçiâ\tapproved",
    "ca$a\t1\tzeneize\tofiçiâ\tapproved",
    "câza2\tx\tzeneize\tofiçiâ\tapproved",
    "pàn\t1\tzeneize\tofiçiâ\tpending",
  ].join("\n");
  const lex: Lexicon = Lexicon.fromTsv(tsv);
  assert.equal(lex.size, 1);
  assert.equal(lex.errors.length, 2);
  assert.equal(lex.lookup("pan").length, 0);
});

test("missing columns are reported", () => {
  const lex: Lexicon = Lexicon.fromTsv("form\tfreq\nzena\t1");
  assert.equal(lex.errors.length, 1);
  assert.match(lex.errors[0]!.message, /variety/);
});

test("higher frequency ranks first", () => {
  const lex: Lexicon = Lexicon.fromTsv(
    "form\tfreq\tvariety\torthography\tstatus\npénna\t2\tz\tof\tapproved\npénn-a\t9\tz\tof\tapproved",
  );
  assert.deepEqual(lex.lookup("penna").map((e) => e.form), ["pénn-a", "pénna"]);
});
