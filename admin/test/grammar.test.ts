/*
 * grammar.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/21, 12:40:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of admin/src/grammar.ts: the fields each part of
 *           speech shows, a value already held shown whatever the part
 *           of speech, what a save sends, a form's readings and a base
 *           form's first, the infinitive given to a new verb and taken
 *           from a lemma that stops being one, the names of every value
 *           of the database's lists in the three languages, and the one
 *           line that sums a row up.
 *           The lists are read from the real database, so a value added
 *           by a migration without a name here fails a test.
 * Decision: docs/decisions/0039-grammar-in-structured-fields.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { messagesFor } from "../src/messages.ts";
import { sqlStateKind } from "../src/errors.ts";
import { PARTS_OF_SPEECH } from "../src/types.ts";
import {
  EMPTY_LISTS, GRAMMAR_NAMES, NO_FORM_GRAMMAR, NO_LEMMA_GRAMMAR, afterPosChange, choices, fieldsDecided, formGrammarOf,
  grammarSummary, lemmaFields, lemmaGrammarOf, lemmaPatch, lemmaReading, readingFields, readingsOf, readingsPatch,
  lemmaQueueSummary, readingsSummary, splitBaseReadings, valueName,
  type GrammarLists, type GrammarValue, type LemmaGrammar, type Reading,
} from "../src/grammar.ts";

const LANGS = ["it", "en", "es"] as const;

async function databaseLists(): Promise<GrammarLists> {
  const db = await createSeededDatabase();
  const list = (table: string): Promise<GrammarValue[]> =>
    rowsAs<GrammarValue>(db, "anon", `select code, name, position from ${table} order by position`);
  return {
    genders: await list("grammar_genders"), numbers: await list("grammar_numbers"), persons: await list("grammar_persons"),
    verbForms: await list("verb_forms"), conjugations: await list("conjugation_classes"), auxiliaries: await list("auxiliaries"),
  };
}

const VERB: LemmaGrammar = {
  ...NO_LEMMA_GRAMMAR, verb_form: "inf", conjugation: "-â", auxiliary: "êse", pronominal: true,
};

const r = (values: Partial<Reading>): Reading => ({ ...NO_FORM_GRAMMAR, ...values });

test("each part of speech shows its own fields, in one order; with none, or 'other', every field of a form", () => {
  assert.deepEqual(lemmaFields("noun"), ["gender", "number", "invariable"]);
  assert.deepEqual(lemmaFields("adjective"), ["gender", "number", "invariable"]);
  assert.deepEqual(lemmaFields("article"), ["gender", "number"]);
  assert.deepEqual(lemmaFields("pronoun"), ["person", "gender", "number"]);
  assert.deepEqual(lemmaFields("determiner"), ["person", "gender", "number"]);
  assert.deepEqual(lemmaFields("verb"), ["verb_form", "conjugation", "auxiliary", "pronominal"]);
  for (const still of ["adverb", "preposition", "conjunction", "interjection"]) {
    assert.deepEqual(lemmaFields(still), [], still);
  }
  for (const open of [null, "other", "a part of speech added later"]) {
    assert.deepEqual(lemmaFields(open), ["verb_form", "person", "gender", "number"], String(open));
    assert.deepEqual(readingFields(open), ["verb_form", "person", "gender", "number"], String(open));
  }
  assert.deepEqual(readingFields("noun"), ["gender", "number"]);
  assert.deepEqual(readingFields("pronoun"), ["person", "gender", "number"]);
  assert.deepEqual(readingFields("verb"), ["verb_form", "person", "gender", "number"]);
  assert.deepEqual(readingFields("adverb"), ["verb_form", "person", "gender", "number"]);
  // Every part of speech the manager offers is decided here, for the
  // lemma and for its forms, not left to the fallback; a part added
  // later is not, until it is.
  for (const pos of PARTS_OF_SPEECH) {
    assert.ok(fieldsDecided(pos), pos);
  }
  assert.equal(fieldsDecided("a part of speech added later"), false);
  assert.equal(fieldsDecided("toString"), false, "nothing inherited counts");
});

test("a value already held is shown whatever the part of speech, but never a verb's own on another word", () => {
  assert.deepEqual(lemmaFields("noun", { person: "3" }), ["person", "gender", "number", "invariable"]);
  assert.deepEqual(lemmaFields("adverb", { invariable: true, gender: null }), ["invariable"]);
  assert.deepEqual(lemmaFields("noun", { conjugation: "-â", auxiliary: "avéi", pronominal: true }),
    ["gender", "number", "invariable"]);
  assert.deepEqual(lemmaFields("adverb", { invariable: false, pronominal: false }), [], "false is no value");
  assert.deepEqual(readingFields("noun", [r({ gender: "f" }), r({ verb_form: "ptcp_past" })]), ["verb_form", "gender", "number"],
    "a value held by any reading shows the field in all");
});

test("a save sends the fields shown, every other emptied: a verb that becomes a noun sheds its verb's properties", () => {
  const values: LemmaGrammar = { ...VERB, gender: "m", person: "3", invariable: true };
  assert.deepEqual(lemmaPatch("verb", values), { ...NO_LEMMA_GRAMMAR, verb_form: "inf", conjugation: "-â", auxiliary: "êse", pronominal: true });
  assert.deepEqual(lemmaPatch("noun", values), { ...NO_LEMMA_GRAMMAR, gender: "m", invariable: true });
  assert.deepEqual(lemmaPatch("adverb", values), NO_LEMMA_GRAMMAR);
  // What the row held stays, though the part of speech would hide it.
  assert.deepEqual(lemmaPatch("noun", values, { person: "3" }), { ...NO_LEMMA_GRAMMAR, gender: "m", person: "3", invariable: true });
  assert.deepEqual(lemmaPatch("noun", values, VERB), { ...NO_LEMMA_GRAMMAR, gender: "m", verb_form: "inf", invariable: true },
    "the verb form held stays; the verb's own three go");
});

test("a form's readings are sent as edited: fields not shown emptied, empty readings dropped, none twice, a base form's first kept", () => {
  const all: Reading = { gender: "f", number: "pl", person: "1", verb_form: "inf" };
  assert.deepEqual(readingsPatch("noun", [all]), [r({ gender: "f", number: "pl" })]);
  assert.deepEqual(readingsPatch("noun", [all], [r({ person: "1" })]), [r({ gender: "f", number: "pl", person: "1" })]);
  assert.deepEqual(readingsPatch("verb", [
    r({ verb_form: "ind_pres", person: "3", number: "sg" }), r({}), r({ verb_form: "imp", person: "2", number: "sg" }),
    r({ verb_form: "ind_pres", person: "3", number: "sg" }),
  ]), [r({ verb_form: "ind_pres", person: "3", number: "sg" }), r({ verb_form: "imp", person: "2", number: "sg" })]);
  assert.deepEqual(readingsPatch("noun", [r({ person: "3" })]), [], "a reading left with no value shown is dropped");
  const head: Reading = r({ gender: "m", number: "sg" });
  assert.deepEqual(readingsPatch("noun", [r({ gender: "m", number: "pl" }), head], [], head),
    [head, r({ gender: "m", number: "pl" })], "the lemma's first, never twice");
  assert.deepEqual(readingsPatch("noun", [], [], head), [head]);
});

test("a base form's readings split into its lemma's and its own; a form's readings read safely from the database", () => {
  const head: Reading = r({ gender: "m", number: "sg" });
  const pl: Reading = r({ gender: "m", number: "pl" });
  assert.deepEqual(lemmaReading({ ...VERB }), r({ verb_form: "inf" }));
  assert.equal(lemmaReading({ invariable: true, conjugation: "-â" }), null, "the verb's own and invariable are no reading");
  assert.deepEqual(splitBaseReadings([head, pl], head), [pl]);
  assert.deepEqual(splitBaseReadings([pl], head), [pl], "a first reading that is not the lemma's is kept");
  assert.deepEqual(splitBaseReadings([head, pl], null), [head, pl]);
  assert.deepEqual(readingsOf([{ gender: "f", number: "pl", person: null, verb_form: null }, null, "x", {}]),
    [r({ gender: "f", number: "pl" })]);
  for (const nothing of [null, undefined, "[]", {}, 3]) {
    assert.deepEqual(readingsOf(nothing), [], String(nothing));
  }
});

test("a lemma that becomes a verb is given the infinitive; one that stops being a verb loses it; nothing else changes", async () => {
  const lists: GrammarLists = await databaseLists();
  assert.equal(afterPosChange("noun", "verb", NO_LEMMA_GRAMMAR, lists).verb_form, "inf");
  assert.equal(afterPosChange(null, "verb", NO_LEMMA_GRAMMAR, lists).verb_form, "inf");
  assert.equal(afterPosChange("noun", "verb", { ...NO_LEMMA_GRAMMAR, verb_form: "ptcp_past" }, lists).verb_form, "ptcp_past");
  assert.equal(afterPosChange("noun", "adjective", NO_LEMMA_GRAMMAR, lists).verb_form, null);
  assert.equal(afterPosChange("noun", "verb", NO_LEMMA_GRAMMAR, EMPTY_LISTS).verb_form, null, "lists not loaded");
  assert.equal(afterPosChange("verb", "noun", VERB, lists).verb_form, null, "the infinitive the page gave goes with the verb");
  assert.equal(afterPosChange("verb", "adjective", { ...VERB, verb_form: "ptcp_past" }, lists).verb_form, "ptcp_past",
    "a participle used as an adjective stays");
  assert.equal(afterPosChange("verb", "verb", { ...VERB, verb_form: null }, lists).verb_form, null, "no change, no default");
  assert.deepEqual(afterPosChange("verb", "noun", { ...VERB, gender: "m" }, lists),
    { ...VERB, gender: "m", verb_form: null }, "only the verb form is touched");
});

test("every value of the database's lists has a name in the three languages, and no name lacks its value", async () => {
  const lists: GrammarLists = await databaseLists();
  const named = { gender: lists.genders, number: lists.numbers, person: lists.persons, verb_form: lists.verbForms } as const;
  for (const lang of LANGS) {
    for (const [feature, values] of Object.entries(named) as [keyof typeof named, GrammarValue[]][]) {
      assert.deepEqual(Object.keys(GRAMMAR_NAMES[lang][feature]).sort(), values.map((v) => v.code).sort(), `${lang} ${feature}`);
      for (const value of values) {
        assert.ok((GRAMMAR_NAMES[lang][feature][value.code] ?? "").trim() !== "", `${lang} ${feature} ${value.code}`);
      }
    }
  }
  // The Italian names are the database's own.
  for (const [feature, values] of Object.entries(named) as [keyof typeof named, GrammarValue[]][]) {
    for (const value of values.filter((v) => feature !== "person")) {
      assert.equal(GRAMMAR_NAMES.it[feature][value.code], value.name, `${feature} ${value.code}`);
    }
  }
  assert.equal(GRAMMAR_NAMES.en.verb_form["ind_past"], "past historic");
  assert.equal(GRAMMAR_NAMES.es.verb_form["ind_past"], "pretérito perfecto simple");
});

test("a menu lists its values in the list's order; a value with no name of its own shows its list's, or its code", async () => {
  const lists: GrammarLists = await databaseLists();
  assert.deepEqual(choices("en", "number", lists), [{ value: "sg", label: "singular" }, { value: "pl", label: "plural" }]);
  assert.deepEqual(choices("es", "conjugation", lists).map((c) => c.label), ["-â", "-ê", "-î", "-éi"]);
  const reversed: GrammarLists = { ...lists, genders: [...lists.genders].reverse() };
  assert.deepEqual(choices("it", "gender", reversed).map((c) => c.value), ["m", "f", "mf"], "by position, not by arrival");
  const added: GrammarLists = { ...lists, genders: [...lists.genders, { code: "n", name: "neutro", position: 4 }] };
  assert.equal(valueName("en", "gender", "n", added), "neutro");
  assert.equal(valueName("en", "gender", "n", lists), "n");
  assert.equal(valueName("es", "auxiliary", "êse", lists), "êse");
  const odd: GrammarLists = { ...lists, genders: [...lists.genders, { code: "constructor", name: "costruttore", position: 9 }] };
  assert.equal(valueName("en", "gender", "constructor", odd), "costruttore", "never a name inherited by every object");
  assert.equal(valueName("en", "gender", "toString", lists), "toString");
});

test("one line sums a row's grammar up, in a fixed order, in the interface's language; nothing given, nothing said", async () => {
  const lists: GrammarLists = await databaseLists();
  const line = (lang: (typeof LANGS)[number], g: Parameters<typeof grammarSummary>[3]): string =>
    grammarSummary(lang, messagesFor(lang), lists, g);
  assert.equal(line("it", VERB), "infinito, coniugazione -â, ausiliare êse, pronominale");
  assert.equal(line("en", VERB), "infinitive, conjugation class -â, auxiliary êse, pronominal");
  assert.equal(line("es", VERB), "infinitivo, conjugación -â, auxiliar êse, pronominal");
  const noun = { ...NO_LEMMA_GRAMMAR, gender: "f", number: "sg", invariable: true };
  assert.equal(line("it", noun), "femminile, singolare, invariabile");
  assert.equal(line("en", { gender: "m", number: "pl", person: "3", verb_form: "ptcp_past" }),
    "past participle, third person, masculine, plural");
  assert.equal(line("es", { person: "1", verb_form: "ind_past", number: "sg" }),
    "pretérito perfecto simple, primera persona, singular");
  assert.equal(readingsSummary("it", messagesFor("it"), lists, [r({ verb_form: "ind_pres", person: "3", number: "sg" }),
    r({ verb_form: "imp", person: "2", number: "sg" })]),
  "indicativo presente, terza persona, singolare; imperativo, seconda persona, singolare");
  assert.equal(readingsSummary("en", messagesFor("en"), lists, []), "");
  // A lemma's line in the review queue adds what its base form holds
  // beyond the lemma's own reading.
  const city = { gender: "f", number: "sg", invariable: true,
    readings: [{ gender: "f", number: "sg", person: null, verb_form: null }, { gender: "f", number: "pl", person: null, verb_form: null }] };
  assert.equal(lemmaQueueSummary("it", messagesFor("it"), lists, city), "femminile, singolare, invariabile; anche: femminile, plurale");
  assert.equal(lemmaQueueSummary("es", messagesFor("es"), lists, { ...city, readings: city.readings.slice(0, 1) }),
    "femenino, singular, invariable");
  assert.equal(lemmaQueueSummary("en", messagesFor("en"), lists, { readings: [{ gender: "f", number: "pl" }] }),
    "also: feminine, plural", "a lemma with no reading: all its base form's are more");
  for (const lang of LANGS) {
    assert.equal(line(lang, NO_LEMMA_GRAMMAR), "");
    assert.equal(line(lang, {}), "");
    assert.equal(line(lang, { gender: null, invariable: null, pronominal: null }), "", "the review queue's nulls");
  }
});

test("a row as the database returns it reads back with its grammar, missing fields empty", () => {
  assert.deepEqual(lemmaGrammarOf({}), NO_LEMMA_GRAMMAR);
  assert.deepEqual(lemmaGrammarOf({ ...VERB, invariable: null }), VERB);
  assert.deepEqual(formGrammarOf({ gender: "f", conjugation: "-â" }), { ...NO_FORM_GRAMMAR, gender: "f" });
});

test("two live senses with one number read as a duplicate, as before the rule became a constraint", () => {
  assert.equal(sqlStateKind("23P01"), "duplicate");
  assert.equal(sqlStateKind("23505"), "duplicate");
});
