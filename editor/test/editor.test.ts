/*
 * editor.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/17, 02:15:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/17, 08:23:03: Spanish; the same languages as the manager.
 * Updated:  2026/10/17, 12:15:40: an elided word typed in the editor.
 * Purpose:  Tests of the web editor's decisions [ime.ts] and of the
 *           dictionary snapshot [snapshot.ts], on the test fixture,
 *           whose spellings are copied from the Académia's alphabet page.
 * Method:   Every typing test simulates the browser: the text as it is
 *           right after the user typed a key, and the caret after it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Lexicon } from "../../engine/src/lexicon.ts";
import {
  applyEdit, choose, menuLength, moveHighlight, planConversion, planRevert,
  wordBeforeSeparator, type Applied, type Edit, type Plan,
} from "../src/ime.ts";
import { isLang, LANGUAGES, messagesFor, type Messages } from "../src/messages.ts";
import { LANGUAGES as MANAGER_LANGUAGES } from "../../admin/src/messages.ts";
import { checkSnapshot, formatUtc, readSnapshot, stampSnapshot, type Snapshot } from "../src/snapshot.ts";

const FIXTURE: string = readFileSync(new URL("../../data/fixtures/test-lexicon.tsv", import.meta.url), "utf8");
const lexicon: Lexicon = Lexicon.fromTsv(FIXTURE);

// Type `text` and put the caret at its end, as after the last key.
function typed(lex: Lexicon, text: string): Plan {
  return planConversion(lex, text, text.length);
}

test("finds the word just finished by a space or a new line", () => {
  assert.deepEqual(wordBeforeSeparator("a zena ", 7), { start: 2, end: 6 });
  assert.deepEqual(wordBeforeSeparator("a\nzena\n", 7), { start: 2, end: 6 });
  assert.equal(wordBeforeSeparator("a zena", 6), null, "no separator before the caret");
  assert.equal(wordBeforeSeparator("a  ", 3), null, "two spaces: no word before the second");
  assert.equal(wordBeforeSeparator("", 0), null);
});

test("a single candidate replaces the word and moves the caret", () => {
  const plan: Plan = typed(lexicon, "a zena ");
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    assert.equal(applyEdit("a zena ", plan.edit), "a Zêna ", "a proper noun keeps its capital");
    assert.equal(plan.edit.caret, 7, "same length: the caret stays after the space");
  }
});

test("an elided word is converted part by part, as the engine decides", () => {
  const small: Lexicon = Lexicon.fromTsv([
    "form\tfreq\tvariety\torthography\tstatus",
    "d'\t500\tzeneize\tofiçiâ\tapproved",
    "ægua\t150\tzeneize\tofiçiâ\tapproved",
  ].join("\n"));
  const before: string = "un gotto d'aegua ";
  const plan: Plan = typed(small, before);
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    const after: string = applyEdit(before, plan.edit);
    assert.equal(after, "un gotto d'ægua ");
    assert.equal(plan.edit.caret, after.length);
  }
});

test("the casing and the punctuation of the typed word are kept", () => {
  const plan: Plan = typed(lexicon, "\"Zena,\" ");
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    assert.equal(applyEdit("\"Zena,\" ", plan.edit), "\"Zêna,\" ");
  }
});

test("a longer replacement shifts the caret by the difference", () => {
  const before: string = "aenna ";
  const plan: Plan = typed(lexicon, before);
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    const after: string = applyEdit(before, plan.edit);
    assert.equal(after, "ænn-a ");
    assert.equal(plan.edit.caret, after.length);
  }
});

test("a word already written correctly is left alone", () => {
  assert.equal(typed(lexicon, "Zêna ").kind, "none");
});

test("unknown words and pasted gaps are left alone", () => {
  assert.equal(typed(lexicon, "computer ").kind, "none");
  assert.equal(typed(lexicon, "zena").kind, "none", "no separator typed yet");
});

test("several candidates open the menu, with a last entry to keep the word", () => {
  const plan: Plan = typed(lexicon, "a penna ");
  assert.equal(plan.kind, "choose");
  if (plan.kind === "choose") {
    assert.deepEqual(plan.pending.conversion.candidates, ["pénn-a", "pénna"]);
    assert.equal(menuLength(plan.pending), 3);
    assert.equal(plan.pending.typed, "penna");
  }
});

test("choosing a candidate replaces the word; a stale menu does nothing", () => {
  const text: string = "a penna e";
  const plan: Plan = typed(lexicon, "a penna ");
  assert.equal(plan.kind, "choose");
  if (plan.kind === "choose") {
    const result: { edit: Edit; applied: Applied } | null = choose(plan.pending, 1, text, text.length);
    assert.notEqual(result, null);
    if (result !== null) {
      assert.equal(applyEdit(text, result.edit), "a pénna e");
      assert.equal(result.edit.caret, "a pénna e".length);
    }
    assert.equal(choose(plan.pending, 1, "a pinna e", 9), null, "the word changed meanwhile");
    assert.equal(choose(plan.pending, 2, text, 9), null, "the keep entry is not a candidate");
  }
});

test("the highlight wraps around in both directions", () => {
  const plan: Plan = typed(lexicon, "penna ");
  assert.equal(plan.kind, "choose");
  if (plan.kind === "choose") {
    assert.equal(moveHighlight(plan.pending, -1).highlighted, 2, "up from the first goes to keep");
    assert.equal(moveHighlight(moveHighlight(plan.pending, 1), 1).highlighted, 2);
    assert.equal(moveHighlight(plan.pending, 3).highlighted, 0);
  }
});

test("Backspace right after a conversion restores what was typed", () => {
  const plan: Plan = typed(lexicon, "a zena ");
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    // The browser deleted the space after "Zêna"; the caret sits after it.
    const afterBackspace: string = "a Zêna";
    const revert: Edit | null = planRevert(plan.applied, afterBackspace, 6);
    assert.notEqual(revert, null);
    if (revert !== null) {
      assert.equal(applyEdit(afterBackspace, revert), "a zena ");
      assert.equal(revert.caret, 7);
    }
  }
});

test("Backspace elsewhere is an ordinary deletion", () => {
  const plan: Plan = typed(lexicon, "a zena ");
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    assert.equal(planRevert(plan.applied, "a Zên ", 5), null, "a letter of the word was deleted");
    assert.equal(planRevert(plan.applied, "a Zêna x", 8), null, "the caret moved on");
  }
});

test("the variety filter limits the candidates", () => {
  // Test only: one fixture row relabelled with another variety, to
  // check the filter; the label says nothing about real usage.
  const relabelled: string = FIXTURE.replace("pénna\t1\tzeneize", "pénna\t1\tsavoneize");
  const lex: Lexicon = Lexicon.fromTsv(relabelled);
  const plan: Plan = planConversion(lex, "penna ", 6, { variety: "zeneize" });
  assert.equal(plan.kind, "replace");
  if (plan.kind === "replace") {
    assert.equal(applyEdit("penna ", plan.edit), "pénn-a ");
  }
});

test("a snapshot carries its time stamp, varieties and spelling systems", () => {
  const stamped: string = stampSnapshot(FIXTURE, new Date(Date.UTC(2026, 9, 17, 8, 5, 9)));
  const snapshot: Snapshot = readSnapshot(stamped);
  assert.equal(snapshot.takenAt, "2026/10/17 08:05:09 UTC");
  assert.equal(snapshot.lexicon.size, lexicon.size);
  assert.deepEqual(snapshot.varieties, ["zeneize"]);
  assert.deepEqual(snapshot.orthographies, ["ofiçiâ"]);
  assert.equal(formatUtc(new Date(Date.UTC(2026, 0, 2, 3, 4, 5))), "2026/01/02 03:04:05 UTC");
});

test("a broken or empty snapshot is refused", () => {
  assert.deepEqual(checkSnapshot(FIXTURE), []);
  const header: string = "form\tfreq\tvariety\torthography\tstatus\n";
  assert.deepEqual(checkSnapshot(header), ["no approved wordforms: refusing to publish an empty dictionary"]);
  const problems: string[] = checkSnapshot(`${header}Zêna\tmany\tzeneize\tofiçiâ\tapproved\n`);
  assert.equal(problems.length, 2);
  assert.match(problems[0] ?? "", /^line 2: invalid freq/);
  assert.equal(checkSnapshot("nonsense").length, 2, "missing columns, and nothing approved");
});

test("the dictionary status agrees in number in every language", () => {
  assert.equal(messagesFor("it").ready(1, null), "Dizionario: 1 forma.");
  assert.equal(messagesFor("it").ready(2, null), "Dizionario: 2 forme.");
  assert.equal(messagesFor("en").ready(1, "2026/10/17 08:05:09 UTC"), "Dictionary: 1 form, updated 2026/10/17 08:05:09 UTC.");
  assert.equal(messagesFor("en").ready(0, null), "Dictionary: 0 forms.");
  assert.equal(messagesFor("es").ready(1, null), "Diccionario: 1 forma.");
  assert.equal(messagesFor("es").ready(2, "2026/10/17 08:05:09 UTC"), "Diccionario: 2 formas, actualizado el 2026/10/17 08:05:09 UTC.");
});

test("the editor offers exactly the lexicon manager's languages, in the same order", () => {
  assert.deepEqual(LANGUAGES, MANAGER_LANGUAGES);
  for (const { code } of LANGUAGES) {
    assert.ok(isLang(code));
  }
  for (const other of ["fr", "", "ES", null]) {
    assert.equal(isLang(other), false, String(other));
  }
});

// Every message as text, the status called with sample arguments.
function texts(m: Messages): Map<string, string> {
  const result: Map<string, string> = new Map();
  for (const [key, value] of Object.entries(m) as [string, unknown][]) {
    result.set(key, typeof value === "function" ? String((value as (n: number, s: string) => string)(7, "§T§")) : String(value));
  }
  return result;
}

test("Spanish is complete and really translated", () => {
  const es: Map<string, string> = texts(messagesFor("es"));
  const it: Map<string, string> = texts(messagesFor("it"));
  const en: Map<string, string> = texts(messagesFor("en"));
  for (const [key, text] of es) {
    assert.ok(text.trim() !== "", `es.${key} is empty`);
  }
  assert.ok(es.get("ready")?.includes("7") && es.get("ready")?.includes("§T§"), "the status keeps both arguments");
  const copies: string[] = [...es].filter(([key, text]) => text === it.get(key) || text === en.get(key)).map(([key]) => key);
  assert.deepEqual(copies, []);
});
