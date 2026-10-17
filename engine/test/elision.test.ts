/*
 * elision.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 12:08:31, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of elided words: the split after an inner apostrophe
 *           [elision.ts] and the conversion part by part [convert.ts].
 * Method:   A small dictionary written for these tests. Its particles
 *           and words illustrate the mechanism; whether each is the
 *           right Ligurian spelling is for native contributors to say,
 *           and nothing here enters the real dictionary.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { Lexicon } from "../src/lexicon.ts";
import { convertToken, MAX_COMBINATIONS, renderChoice } from "../src/convert.ts";
import { splitElision } from "../src/elision.ts";

const TSV: string = [
  "form\tfreq\tvariety\torthography\tstatus",
  "d'\t500\tzeneize\tofiçiâ\tapproved",
  "l'\t900\tzeneize\tofiçiâ\tapproved",
  "quell'\t40\tzeneize\tofiçiâ\tapproved",
  "ægua\t150\tzeneize\tofiçiâ\tapproved",
  "avéi\t300\tzeneize\tofiçiâ\tapproved",
  "pénna\t10\tzeneize\tofiçiâ\tapproved",
  "pénn-a\t15\tzeneize\tofiçiâ\tapproved",
  "òmmo\t80\tzeneize\tofiçiâ\tapproved",
  "l'ægua\t1\tsavoneize\tofiçiâ\tapproved",
].join("\n");

const lexicon: Lexicon = Lexicon.fromTsv(TSV);
const zeneize = { variety: "zeneize" };

test("a word splits after each inner apostrophe, and the parts join back to it", () => {
  assert.deepEqual(splitElision("d'ægua"), ["d'", "ægua"]);
  assert.deepEqual(splitElision("quell'òmmo"), ["quell'", "òmmo"]);
  assert.deepEqual(splitElision("l'ægua"), ["l'", "ægua"]);
  assert.deepEqual(splitElision("d’avéi"), ["d’", "avéi"], "a typographic apostrophe splits too");
  assert.deepEqual(splitElision("'na"), ["'na"], "an apostrophe at the start never splits");
  assert.deepEqual(splitElision("pe'"), ["pe'"], "nor one at the end");
  assert.deepEqual(splitElision("canpànn-a"), ["canpànn-a"], "a hyphen never splits");
  assert.deepEqual(splitElision("d''ægua"), ["d''ægua"], "two apostrophes in a row are not an elision");
  assert.deepEqual(splitElision("d'ʼægua"), ["d'ʼægua"], "an apostrophe is never taken for a letter");
  assert.deepEqual(splitElision(""), [""]);
  for (const word of ["d'ægua", "quell'òmmo", "a'b'c", "'na", "x'"]) {
    assert.equal(splitElision(word).join(""), word);
  }
});

test("an elided word is converted part by part from the particle and the word", () => {
  const c = convertToken(lexicon, "d'aegua", zeneize);
  assert.equal(c.kind, "replace");
  assert.deepEqual(c.candidates, ["d'ægua"]);
  assert.equal(convertToken(lexicon, "quell'ommo", zeneize).candidates[0], "quell'òmmo");
  assert.equal(convertToken(lexicon, "d'avei", zeneize).candidates[0], "d'avéi");
});

test("each part keeps the casing it was typed in, and punctuation stays outside", () => {
  assert.deepEqual(convertToken(lexicon, "D'aegua", zeneize).candidates, ["D'ægua"]);
  assert.deepEqual(convertToken(lexicon, "D'AEGUA", zeneize).candidates, ["D'ÆGUA"]);
  const c = convertToken(lexicon, "«l'aegua»,", zeneize);
  assert.equal(renderChoice(c, 0), "«l'ægua»,");
});

test("an ambiguous word after a particle opens the menu, best spelling first", () => {
  const c = convertToken(lexicon, "d'penna", zeneize);
  assert.equal(c.kind, "choose");
  assert.deepEqual(c.candidates, ["d'pénn-a", "d'pénna"]);
});

test("an unknown part stays as typed; nothing known means nothing changes", () => {
  assert.deepEqual(convertToken(lexicon, "d'xyz", zeneize).candidates, ["d'xyz"]);
  assert.deepEqual(convertToken(lexicon, "xyz'aegua", zeneize).candidates, ["xyz'ægua"]);
  const unknown = convertToken(lexicon, "xyz'qwe", zeneize);
  assert.equal(unknown.kind, "unknown");
  assert.deepEqual(unknown.candidates, []);
});

test("a whole word in the dictionary wins over its parts", () => {
  const whole = convertToken(lexicon, "l'aegua", { variety: "savoneize" });
  assert.deepEqual(whole.candidates, ["l'ægua"]);
  assert.equal(whole.kind, "replace");
  // In zeneize there is no whole entry, so the parts are used.
  assert.deepEqual(convertToken(lexicon, "l'aegua", zeneize).candidates, ["l'ægua"]);
});

test("the menu never offers more than MAX_COMBINATIONS spellings", () => {
  const rows: string[] = ["form\tfreq\tvariety\torthography\tstatus"];
  for (const word of ["à", "á", "â", "ä", "a"]) {
    rows.push(`${word}'\t1\tzeneize\tofiçiâ\tapproved`);
    rows.push(`${word}\t1\tzeneize\tofiçiâ\tapproved`);
  }
  const many: Lexicon = Lexicon.fromTsv(rows.join("\n"));
  const c = convertToken(many, "a'a'a", zeneize);
  assert.equal(c.kind, "choose");
  assert.equal(c.candidates.length, MAX_COMBINATIONS);
  assert.equal(new Set(c.candidates).size, c.candidates.length);
});
