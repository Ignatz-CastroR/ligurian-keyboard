/*
 * forms.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 20:20:45, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 07:50:33: the letters are compared with a real
 *           database built from every migration, not with file 0001.
 * Updated:  2026/10/17, 11:00:43: the warning before ñ is saved under
 *           the grafîa ofiçiâ [decision 0028].
 * Purpose:  The checks the lexicon manager runs before sending anything,
 *           and their agreement with the database's own rules.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createDatabase, domainLetters, rowsAs } from "../../db/test/harness.ts";
import {
  LIGURIAN_LETTERS, OFICIA, SPECIAL_LETTERS, changedFields, checkForm, checkFreq,
  cleanForm, cleanOptionalText, enyeUnderOficia, formatDateTime, searchKeyFilter,
} from "../src/forms.ts";

test("the letters accepted here are exactly the database domain's", async () => {
  assert.equal(LIGURIAN_LETTERS, await domainLetters(await createDatabase()));
});

test("the palette offers ñ, last, and every letter only once", () => {
  assert.equal(SPECIAL_LETTERS.at(-1), "ñ");
  assert.equal(new Set(SPECIAL_LETTERS).size, SPECIAL_LETTERS.length);
  assert.deepEqual(checkForm("Ñ"), { ok: true, value: "Ñ" });
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
  assert.deepEqual(checkForm("ãoão 1"), { ok: false, reason: "invalid_chars", bad: ["ã", " ", "1"] });
  assert.deepEqual(checkForm("ñoño"), { ok: true, value: "ñoño" }, "ñ is accepted since decision 0024");
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

test("ñ under the grafîa ofiçiâ is found, in either case, and only there", () => {
  assert.deepEqual(enyeUnderOficia(["Españ", "pénna"], "ofiçiâ"), ["Españ"]);
  assert.deepEqual(enyeUnderOficia(["ÑAÑA", " ñaña "], "ofiçiâ"), ["ÑAÑA", "ñaña"], "cleaned as when saved");
  assert.deepEqual(enyeUnderOficia(["ñaña", "ñaña"], "ofiçiâ"), ["ñaña"], "each form named once");
  assert.deepEqual(enyeUnderOficia(["ñaña"], "unitäia"), [], "other spelling systems may write ñ");
  assert.deepEqual(enyeUnderOficia(["ñaña"], "ofic\u0327i\u00e2"), ["ñaña"], "a decomposed name is still ofiçiâ");
  assert.deepEqual(enyeUnderOficia(["pénna", "Zêna"], "ofiçiâ"), []);
  assert.deepEqual(enyeUnderOficia([], "ofiçiâ"), []);
});

test("the spelling system warned about is the database's own ofiçiâ", async () => {
  const codes: { code: string }[] = await rowsAs(await createDatabase(), "anon", "select code from public.orthographies");
  assert.ok(codes.some((row) => row.code === OFICIA), JSON.stringify(codes));
});
