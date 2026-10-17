/*
 * messages.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 07:30:36, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the lexicon manager's three languages
 *           [admin/src/messages.ts]. The compiler already refuses a
 *           missing key; these tests catch empty texts, untranslated
 *           copies and broken placeholders.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { isLang, LANGUAGES, messagesFor, type Lang, type Messages } from "../src/messages.ts";

const CODES: Lang[] = LANGUAGES.map((l) => l.code);

// Every message as text, functions called with a sample argument.
function texts(m: Messages): Map<string, string> {
  const result: Map<string, string> = new Map();
  for (const [key, value] of Object.entries(m) as [string, unknown][]) {
    result.set(key, typeof value === "function" ? String((value as (arg: unknown) => string)("§7§")) : String(value));
  }
  return result;
}

test("three interface languages, each named in itself", () => {
  assert.deepEqual(LANGUAGES, [
    { code: "it", name: "Italiano" },
    { code: "en", name: "English" },
    { code: "es", name: "Español" },
  ]);
  for (const code of CODES) {
    assert.ok(isLang(code));
  }
  for (const other of ["fr", "", "IT", null]) {
    assert.equal(isLang(other), false, String(other));
  }
});

test("every text in every language is non-empty and keeps its placeholder", () => {
  for (const code of CODES) {
    for (const [key, text] of texts(messagesFor(code))) {
      assert.ok(text.trim() !== "", `${code}.${key} is empty`);
      const value: unknown = (messagesFor(code) as unknown as Record<string, unknown>)[key];
      if (typeof value === "function") {
        assert.ok(text.includes("§7§"), `${code}.${key} drops its argument`);
      }
    }
  }
});

test("Spanish is really translated, not a copy of Italian or English", () => {
  const es: Map<string, string> = texts(messagesFor("es"));
  const it: Map<string, string> = texts(messagesFor("it"));
  const en: Map<string, string> = texts(messagesFor("en"));
  // Words that are the same in Spanish and in one of the other two.
  const sameByNature: Set<string> = new Set([
    "posVerb", "posNumeral", "fieldForm", "fieldNote", "fieldKind", "kindWordform",
    "entryBase", "errGeneric",
  ]);
  const copies: string[] = [...es].filter(([key, text]) =>
    !sameByNature.has(key) && (text === it.get(key) || text === en.get(key))).map(([key]) => key);
  assert.deepEqual(copies, []);
});

test("the new texts exist in all three languages", () => {
  for (const code of CODES) {
    const m: Messages = messagesFor(code);
    for (const text of [m.exportCsv, m.langLabel, m.latestTitle, m.latestIntro, m.latestEmpty]) {
      assert.ok(text.length > 0);
    }
    assert.match(m.latestIntro, /20/);
  }
});
