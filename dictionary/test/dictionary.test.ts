/*
 * dictionary.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 18:46:33, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the dictionary for readers apart from the browser:
 *           the order of the index's letters, the addresses of its
 *           views, translations grouped by sense and by language, search
 *           results grouped by entry, codes typed into the search field,
 *           and the three languages of its texts. The last test runs
 *           the page's grouping on rows the real database returns.
 * Decision: docs/decisions/0034-dictionary-for-readers.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { LANGUAGES, messagesFor, partOfSpeech, type Messages } from "../src/messages.ts";
import {
  groupResults, orderLetters, parseRoute, readQuery, routeHash, senses, translationLine,
  type GlossRow, type Route, type SearchRow,
} from "../src/model.ts";

const glosses: GlossRow[] = [
  { sense_number: 2, definition_it: null, language: "it", gloss: "piuma" },
  { sense_number: 1, definition_it: "strumento per scrivere", language: "en", gloss: "pen" },
  { sense_number: 1, definition_it: "strumento per scrivere", language: "es", gloss: "pluma" },
  { sense_number: 1, definition_it: "strumento per scrivere", language: "it", gloss: "penna" },
  { sense_number: 2, definition_it: null, language: "es", gloss: "pluma" },
  { sense_number: 3, definition_it: "senso senza traduzioni", language: null, gloss: null },
];

test("the index orders its letters with æ after a, ç after c, unknown letters after z and # last", () => {
  assert.deepEqual(orderLetters(["z", "#", "ç", "b", "æ", "a", "c", "k", "a"]), ["a", "æ", "b", "c", "ç", "k", "z", "#"]);
  assert.deepEqual(orderLetters(["ß", "#", "z"]), ["z", "ß", "#"]);
  assert.deepEqual(orderLetters([]), []);
});

test("every view has an address, read back exactly, and a broken address falls back to the index", () => {
  const routes: Route[] = [
    { view: "index", letter: "æ" }, { view: "index", letter: "#" }, { view: "index", letter: null },
    { view: "search", language: "es", query: "canción de cuna" }, { view: "search", language: null, query: "pen/ink" },
    { view: "entry", code: "LIJ-7K3Q9MDXK" },
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(routeHash(route)), route, JSON.stringify(route));
  }
  assert.deepEqual(parseRoute(""), { view: "index", letter: null });
  assert.deepEqual(parseRoute("#/nowhere/x"), { view: "index", letter: null });
  assert.deepEqual(parseRoute("#/cerca/fr/chat"), { view: "search", language: null, query: "chat" });
  assert.deepEqual(parseRoute("#/indice/%E0%A4"), { view: "index", letter: "%E0%A4" });
});

test("translations are grouped by sense, then by language in the order it, es, en; a sense without them stays", () => {
  assert.deepEqual(senses(glosses), [
    { number: 1, definition: "strumento per scrivere", translations: [
      { language: "it", glosses: ["penna"] }, { language: "es", glosses: ["pluma"] }, { language: "en", glosses: ["pen"] }] },
    { number: 2, definition: null, translations: [{ language: "it", glosses: ["piuma"] }, { language: "es", glosses: ["pluma"] }] },
    { number: 3, definition: "senso senza traduzioni", translations: [] },
  ]);
  assert.equal(translationLine(glosses), "it: penna, piuma · es: pluma · en: pen");
  assert.equal(translationLine([]), "");
});

test("search results are grouped by entry, in the order of each entry's best match", () => {
  const row = (id: number, headword: string, gloss: string, rank: number, sense: number = 1): SearchRow => ({
    id, public_id: `LIJ-${id}`, headword, headword_key: headword, part_of_speech: null,
    sense_number: sense, definition_it: null, language: "en", gloss, rank,
  });
  const found = groupResults([row(2, "b", "pen", 0), row(1, "a", "penna", 1), row(2, "b", "pen", 1, 2), row(3, "c", "fountain pen", 2)]);
  assert.deepEqual(found.map((f) => [f.headword, f.matches.length]), [["b", 2], ["a", 1], ["c", 1]]);
});

test("the search field opens a code, reports a mistyped one, and otherwise searches the words", () => {
  assert.deepEqual(readQuery("lij 7k3q 9mdx k"), { kind: "code", code: "LIJ-7K3Q9MDXK" });
  assert.deepEqual(readQuery("LIJ-7K3Q9MDXA"), { kind: "typo" });
  assert.deepEqual(readQuery("  fountain   pen "), { kind: "words", query: "fountain pen" });
  assert.deepEqual(readQuery(""), { kind: "words", query: "" });
});

test("every text exists in the three languages, keeps its placeholder, and Spanish is really translated", () => {
  const sameByNature: Set<string> = new Set(["senseNumber", "entryBase"]);
  const texts = (m: Messages): Map<string, string> => new Map(Object.entries(m).map(([k, v]) =>
    [k, typeof v === "function" ? String((v as (x: unknown) => string)("§7§")) : String(v)]));
  const it = texts(messagesFor("it"));
  const en = texts(messagesFor("en"));
  for (const { code } of LANGUAGES) {
    for (const [key, text] of texts(messagesFor(code))) {
      assert.ok(text.trim() !== "", `${code}.${key}`);
      if (typeof (messagesFor(code) as unknown as Record<string, unknown>)[key] === "function") {
        assert.ok(text.includes("§7§"), `${code}.${key} drops its argument`);
      }
    }
  }
  const copies: string[] = [...texts(messagesFor("es"))].filter(([key, text]) =>
    !sameByNature.has(key) && (text === it.get(key) || text === en.get(key))).map(([key]) => key);
  assert.deepEqual(copies, []);
  assert.equal(partOfSpeech("es", "noun"), "sustantivo");
  assert.equal(partOfSpeech("it", null), "");
  assert.equal(partOfSpeech("en", "unknown_pos"), "unknown_pos");
});

test("on rows from the real database, an entry's translations and a search are grouped as the page shows them", async () => {
  const db = await createSeededDatabase();
  const admin = asUser(USERS.admin);
  const lemma: number = (await rowsAs<{ id: number }>(db, admin,
    "insert into lemmas (headword, status) values ('pénna', 'approved') returning id"))[0]?.id ?? -1;
  for (const [definition, pairs] of [["strumento per scrivere", [["it", "penna"], ["es", "pluma"]]], [null, [["es", "pluma"]]]] as const) {
    const sense: number = (await rowsAs<{ id: number }>(db, admin,
      "insert into senses (lemma_id, definition_it, status) values ($1, $2, 'approved') returning id", [lemma, definition]))[0]?.id ?? -1;
    for (const [language, gloss] of pairs) {
      await rowsAs(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, $2, $3, 'approved')", [sense, language, gloss]);
    }
  }
  const index = await rowsAs<{ glosses: GlossRow[] }>(db, "anon", "select glosses from public.dictionary_index('p')");
  assert.equal(translationLine(index[0]?.glosses ?? []), "it: penna · es: pluma");
  const found = groupResults(await rowsAs<SearchRow>(db, "anon", "select * from public.dictionary_search('pluma')"));
  assert.deepEqual(found.map((f) => [f.headword, f.matches.map((m) => m.sense_number)]), [["pénna", [1, 2]]]);
});
