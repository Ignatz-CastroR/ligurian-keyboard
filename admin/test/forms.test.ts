/*
 * forms.test.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:20:45, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The checks the lexicon manager runs before sending anything,
 *           and their agreement with the database's own rules.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LIGURIAN_LETTERS, SPECIAL_LETTERS, changedFields, checkForm, checkFreq,
  cleanForm, cleanOptionalText, formatDateTime, searchKeyFilter,
} from "../src/forms.ts";

const SCHEMA: string = join(import.meta.dirname, "..", "..", "db", "migrations", "0001_lexicon_schema.sql");

test("the letters accepted here are exactly the database domain's", () => {
  const sql: string = readFileSync(SCHEMA, "utf8");
  const match: RegExpMatchArray | null = /value ~ '\^\[([^\]]+)\]\+\$'/.exec(sql);
  assert.ok(match !== null, "domain ligurian_form not found in 0001");
  // In SQL the apostrophe is written twice inside a string literal.
  assert.equal(match[1]?.replace(/''/g, "'"), LIGURIAN_LETTERS);
});

test("every palette letter is a valid Ligurian letter in both cases", () => {
  for (const letter of SPECIAL_LETTERS) {
    assert.ok(checkForm(letter).ok, letter);
    assert.ok(checkForm(letter.toUpperCase()).ok, letter.toUpperCase());
  }
});

test("checkForm accepts official spellings and cleans them", () => {
  assert.deepEqual(checkForm("  Zêna "), { ok: true, value: "Zêna" });
  assert.deepEqual(checkForm("canpànn-a"), { ok: true, value: "canpànn-a" });
  assert.deepEqual(checkForm("l’ægua"), { ok: true, value: "l'ægua" });
  assert.deepEqual(checkForm("Zêna"), { ok: true, value: "Zêna" });
});

test("checkForm names the characters it refuses", () => {
  assert.deepEqual(checkForm("ñoño 1"), { ok: false, reason: "invalid_chars", bad: ["ñ", " ", "1"] });
  assert.deepEqual(checkForm("   "), { ok: false, reason: "empty", bad: [] });
  assert.deepEqual(checkForm("a".repeat(65)), { ok: false, reason: "too_long", bad: [] });
  assert.ok(checkForm("æ".repeat(64)).ok, "64 letters is the limit, counted as characters");
});

test("cleanForm only touches spacing, normalization and apostrophes", () => {
  assert.equal(cleanForm(" ‘a’ "), "'a'");
  assert.equal(cleanForm("PÉNNA"), "PÉNNA");
});

test("optional text: blank is null, too long is refused", () => {
  assert.deepEqual(cleanOptionalText("   ", 10), { ok: true, value: null });
  assert.deepEqual(cleanOptionalText(" penna ", 10), { ok: true, value: "penna" });
  assert.deepEqual(cleanOptionalText("x".repeat(11), 10), { ok: false });
});

test("frequency: whole numbers from zero only", () => {
  assert.equal(checkFreq("0"), 0);
  assert.equal(checkFreq(" 42 "), 42);
  assert.equal(checkFreq("-1"), null);
  assert.equal(checkFreq("1.5"), null);
  assert.equal(checkFreq(""), null);
  assert.equal(checkFreq("1e3"), null);
});

test("search keys cannot smuggle wildcards", () => {
  assert.equal(searchKeyFilter("pen%na_*"), "penna");
  assert.equal(searchKeyFilter("l'aegua"), "l'aegua");
});

test("dates are written YYYY/MM/DD HH:MM:SS", () => {
  assert.match(formatDateTime("2026-10-12T01:42:00.897393+00:00"), /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(formatDateTime("not a date"), "not a date");
});

test("changedFields ignores bookkeeping columns", () => {
  const before = { headword: "pena", version: 1, updated_at: "a", headword_key: "pena", note: null };
  const after = { headword: "pénna", version: 2, updated_at: "b", headword_key: "penna", note: null };
  assert.deepEqual(changedFields(before, after), ["headword"]);
  assert.deepEqual(changedFields(null, after), []);
});
