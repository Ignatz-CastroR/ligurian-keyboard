/*
 * repair.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 23:49:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/21, 10:57:43: key 1 sends the definition field 1
 *           shows; a definition shown elsewhere stops it.
 * Updated:  2026/10/21, 09:30:23: definitions that follow their
 *           translations, through a reordering too; a typed definition an
 *           action would not use; the lemma's version in what was seen;
 *           the list of migration 0012 as the queue's rule.
 * Purpose:  Tests of admin/src/repair.ts, the logic of the repair page:
 *           the rows it shows, what it says it saw, its definition
 *           fields, the groups each of its three actions sends, its keys,
 *           and its own copy of the queue's rule. The page's logic then
 *           runs on entries read from the real database, sends its groups
 *           to regroup_senses[] as a reviewer, and gets back the senses a
 *           speaker chose; definitions land on the senses they were
 *           written for, whatever the order; and its rule agrees with
 *           sense_review_queue[] on every entry.
 * Decision: docs/decisions/0038-senses-reviewed-one-by-one.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, actAs, affectedAs, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { sqlStateKind } from "../src/errors.ts";
import { messagesFor } from "../src/messages.ts";
import {
  actionForKey, bareSenses, cleanDefinition, definitionFields, groupMembers, groupNumbers, initialAssignment, isWaiting,
  planFor, queueKey, repairRows, seenOf, tooLongDefinition, type Group,
} from "../src/repair.ts";
import type { Entry, Gloss, Lemma, Sense } from "../src/types.ts";
import { describeChange } from "../../users/src/model.ts";

const reviewer = asUser(USERS.reviewer);

let nextId: number = 100;
const stamp = { created_by: null, created_at: "2026-10-20T00:00:00Z", updated_at: "2026-10-20T00:00:00Z" };

function lemma(fields: Partial<Lemma> = {}): Lemma {
  return {
    id: nextId++, public_id: "LIJ-0000000000", headword: "béllo", headword_key: "bello", variety: "zeneize",
    orthography: "ofiçiâ", part_of_speech: null, note: null, senses_review_needed: true, senses_reviewed_at: null,
    status: "approved", version: 1, deleted_at: null, ...stamp, ...fields,
  };
}

function senseOf(lemmaId: number, n: number, fields: Partial<Sense> = {}): Sense {
  return { id: nextId++, lemma_id: lemmaId, sense_number: n, definition_it: null, status: "approved", version: 1, deleted_at: null, ...stamp, ...fields };
}

function glossOf(senseId: number, text: string, fields: Partial<Gloss> = {}): Gloss {
  return { id: nextId++, sense_id: senseId, language: "it", gloss: text, status: "approved", version: 1, deleted_at: null, ...stamp, ...fields };
}

// An entry with one sense per text, as the SQL loads left them.
function split(texts: string[], fields: Partial<Lemma> = {}): Entry {
  const l: Lemma = lemma(fields);
  return {
    lemma: l,
    wordforms: [],
    senses: texts.map((text, i) => {
      const s: Sense = senseOf(l.id, i + 1);
      return { sense: s, glosses: [glossOf(s.id, text)] };
    }),
  };
}

const texts = (entry: Entry, group: Group): string[] =>
  group.glosses.map((id) => entry.senses.flatMap((s) => s.glosses).find((g) => g.id === id)?.gloss ?? "?");

/* ====================================================================
   Pure logic
   ==================================================================== */

test("the rows: live translations of live senses, by sense number, each with its sense's place; the lemma's version in what was seen", () => {
  const entry: Entry = split(["a", "b", "c"], { version: 7 });
  const [first, second, third] = entry.senses;
  assert.ok(first !== undefined && second !== undefined && third !== undefined);
  // Sense 2 deleted; sense 3 numbered 7 with a deleted translation and a
  // second live one.
  second.sense.deleted_at = "2026-10-20T01:00:00Z";
  third.sense.sense_number = 7;
  third.glosses.push(glossOf(third.sense.id, "c2"), glossOf(third.sense.id, "gone", { deleted_at: "2026-10-20T01:00:00Z" }));
  const rows = repairRows(entry);
  assert.deepEqual(rows.map((r) => [r.gloss, r.senseNumber, r.position]), [["a", 1, 1], ["c", 7, 2], ["c2", 7, 2]]);
  assert.deepEqual(seenOf(entry), {
    lemma: { id: entry.lemma.id, version: 7 },
    senses: [{ id: first.sense.id, version: 1 }, { id: third.sense.id, version: 1 }],
    glosses: rows.map((r) => ({ id: r.glossId, version: 1 })),
  });
  assert.deepEqual(bareSenses(entry), []);
  third.glosses.forEach((g) => { g.deleted_at = "2026-10-20T01:00:00Z"; });
  assert.deepEqual(bareSenses(entry), [7]);
});

test("the three actions send one sense, the senses as they are, or the chosen groups in order", () => {
  const entry: Entry = split(["razzia", "scorreria", "saccheggio", "sacco"]);
  const rows = repairRows(entry);
  const assignment: Map<number, number> = initialAssignment(rows);
  const none: Map<number, string> = new Map();

  const one = planFor("one", entry, rows, assignment, none);
  assert.deepEqual(one.groups.map((g) => texts(entry, g)), [["razzia", "scorreria", "saccheggio", "sacco"]]);
  assert.deepEqual(one.groups.map((g) => g.definition_it), [null], "field 1 shows nothing: no definition");

  const keep = planFor("keep", entry, rows, assignment, none);
  assert.deepEqual(keep.groups.map((g) => texts(entry, g)), [["razzia"], ["scorreria"], ["saccheggio"], ["sacco"]]);

  // [razzia, scorreria] [saccheggio] [sacco], chosen as 2, 2, 5, 9:
  // numbers in use, in order, give senses 1, 2, 3.
  const ids: number[] = rows.map((r) => r.glossId);
  [2, 2, 5, 9].forEach((n, i) => assignment.set(ids[i] ?? -1, n));
  assert.deepEqual(groupNumbers(assignment), [2, 5, 9]);
  assert.deepEqual([...groupMembers(rows, assignment).values()], [[ids[0], ids[1]], [ids[2]], [ids[3]]]);
  const typed: Map<number, string> = new Map([[5, "  cinque  "]]);
  const grouped = planFor("group", entry, rows, assignment, typed);
  assert.deepEqual(grouped.groups.map((g) => [texts(entry, g), g.definition_it]),
    [[["razzia", "scorreria"], null], [["saccheggio"], "cinque"], [["sacco"], null]]);
  assert.deepEqual(grouped.unused, []);
  // The fields carry the numbers the senses will have.
  assert.deepEqual(definitionFields(entry, rows, assignment, typed).map((f) => [f.group, f.rank, f.value]),
    [[2, 1, ""], [5, 2, "  cinque  "], [9, 3, ""]]);
});

test("a field shows the definition of the sense holding exactly its translations, and keeps what is typed while menus change", () => {
  const entry: Entry = split(["penna", "piuma"]);
  const [s1, s2] = entry.senses;
  assert.ok(s1 !== undefined && s2 !== undefined);
  s1.sense.definition_it = "strumento per scrivere";
  s2.sense.definition_it = "piuma di uccello";
  const rows = repairRows(entry);
  const assignment: Map<number, number> = initialAssignment(rows);
  const typed: Map<number, string> = new Map();
  assert.deepEqual(definitionFields(entry, rows, assignment, typed).map((f) => f.value),
    ["strumento per scrivere", "piuma di uccello"]);
  // Swapped: each field still shows its own translation's definition.
  assignment.set(rows[0]?.glossId ?? -1, 2);
  assignment.set(rows[1]?.glossId ?? -1, 1);
  assert.deepEqual(definitionFields(entry, rows, assignment, typed).map((f) => f.value),
    ["piuma di uccello", "strumento per scrivere"]);
  // Merged: no sense holds both, so the field starts empty.
  assignment.set(rows[0]?.glossId ?? -1, 1);
  assert.deepEqual(definitionFields(entry, rows, assignment, typed).map((f) => f.value), [""]);
  typed.set(1, "scritto");
  assignment.set(rows[1]?.glossId ?? -1, 2);
  assignment.set(rows[1]?.glossId ?? -1, 1);
  assert.deepEqual(definitionFields(entry, rows, assignment, typed).map((f) => f.value), ["scritto"]);
});

test("a typed definition an action would not use is reported, never lost", () => {
  const entry: Entry = split(["a", "b"]);
  const rows = repairRows(entry);
  const assignment: Map<number, number> = initialAssignment(rows);
  const typed: Map<number, string> = new Map([[2, "solo il secondo"]]);
  assert.deepEqual(planFor("one", entry, rows, assignment, typed).unused, [2]);
  assert.deepEqual(planFor("keep", entry, rows, assignment, typed).unused, []);
  assert.deepEqual(planFor("group", entry, rows, assignment, typed).unused, []);
  // Merged on the page, then "keep": the merged group is no sense of today.
  assignment.set(rows[1]?.glossId ?? -1, 1);
  typed.set(1, "tutti e due");
  assert.deepEqual(planFor("keep", entry, rows, assignment, typed).unused, [1]);
  // A field typed back to the sense's own text is not an edit.
  const own: Entry = split(["x", "y"]);
  const ownSense = own.senses[0];
  assert.ok(ownSense !== undefined);
  ownSense.sense.definition_it = "già";
  const ownRows = repairRows(own);
  assert.deepEqual(planFor("one", own, ownRows, initialAssignment(ownRows), new Map([[1, "già"], [2, ""]])).unused, []);
});

test("key 1 sends the definition field 1 shows, and a definition shown in another field stops it", () => {
  const entry: Entry = split(["penna", "piuma"]);
  const [s1, s2] = entry.senses;
  assert.ok(s1 !== undefined && s2 !== undefined);
  s1.sense.definition_it = "strumento per scrivere";
  const rows = repairRows(entry);
  const assignment: Map<number, number> = initialAssignment(rows);
  const one = planFor("one", entry, rows, assignment, new Map());
  assert.deepEqual(one.groups.map((g) => g.definition_it), ["strumento per scrivere"]);
  assert.deepEqual(one.unused, []);
  // A definition shown in field 2 as well: key 1 would lose it.
  s2.sense.definition_it = "piuma di uccello";
  assert.deepEqual(planFor("one", entry, rows, assignment, new Map()).unused, [2]);
  // Cleared first, it no longer stops anything.
  assert.deepEqual(planFor("one", entry, rows, assignment, new Map([[2, "  "]])).unused, []);
  // "Keep" and "Group" send every field's text, untyped ones included.
  assert.deepEqual(planFor("keep", entry, rows, assignment, new Map()).groups.map((g) => g.definition_it),
    ["strumento per scrivere", "piuma di uccello"]);
});

test("definitions are trimmed and normalized, and refused beyond 1000 characters as the database counts them", () => {
  assert.equal(cleanDefinition("   "), null);
  assert.equal(cleanDefinition(undefined), null);
  assert.equal(cleanDefinition(" è "), "è");
  const long: Map<number, string> = new Map([[1, "x".repeat(1000)], [2, ` ${"\u{1F600}".repeat(1000)} `], [3, "z".repeat(1001)]]);
  assert.equal(tooLongDefinition(long, [1, 2]), null, "spaces around do not count; a character outside the BMP counts once");
  assert.equal(tooLongDefinition(long, [1, 2, 3]), 3);
});

test("the keys 1, 2 and 3 act, except while typing or with a modifier", () => {
  assert.equal(actionForKey("1", false, false), "one");
  assert.equal(actionForKey("2", false, false), "keep");
  assert.equal(actionForKey("3", false, false), "group");
  assert.equal(actionForKey("4", false, false), null);
  assert.equal(actionForKey("1", true, false), null);
  assert.equal(actionForKey("1", false, true), null);
});

test("an entry waits in the queue when it is on the list, not reviewed and not deleted, whatever its shape", () => {
  assert.equal(isWaiting(split(["a", "b"])), true);
  assert.equal(isWaiting(split(["a"])), true, "one sense, still on the list");
  assert.equal(isWaiting(split(["a", "b"], { senses_review_needed: false })), false, "not on the list");
  assert.equal(isWaiting(split(["a", "b"], { senses_reviewed_at: "2026-10-20T00:00:00Z" })), false, "reviewed");
  assert.equal(isWaiting(split(["a", "b"], { deleted_at: "2026-10-20T00:00:00Z" })), false, "deleted");
  assert.deepEqual(queueKey(split(["a", "b", "c"], { headword_key: "abaco", id: 42 })), { senses: 3, key: "abaco", id: 42 });
});

test("a change made meanwhile reads as a conflict, a lemma gone as not found; the history names a review of senses", () => {
  assert.equal(sqlStateKind("40001"), "conflict");
  assert.equal(sqlStateKind("P0002"), "notfound");
  assert.deepEqual(describeChange({ action: "update", status: "approved", changed: ["senses_reviewed_at"] }),
    { verb: "review_senses", fields: [] });
  assert.deepEqual(describeChange({ action: "update", status: "approved", changed: ["senses_review_needed"] }),
    { verb: "list_senses", fields: [] });
  for (const lang of ["it", "en", "es"] as const) {
    assert.ok(!messagesFor(lang).reviewRange(1, 50, 120).includes("–"), "no dash in the queue's range");
    assert.ok(!messagesFor(lang).noDefinition.includes("—"));
  }
  assert.equal(messagesFor("it").reviewRange(1, 50, 120), "Voci da 1 a 50 di 120");
  assert.equal(messagesFor("it").noDefinition, "[senza definizione]");
});

/* ====================================================================
   The page's logic on the real database
   ==================================================================== */

async function loaded(db: PGlite, headword: string, translations: string[], definitions: (string | null)[] = []): Promise<number> {
  await actAs(db, "trusted");
  const id: number = (await db.query<{ id: number }>(
    "insert into lemmas (headword, status) values ($1, 'approved') returning id", [headword])).rows[0]?.id ?? -1;
  for (const [i, text] of translations.entries()) {
    const sense: number = (await db.query<{ id: number }>(
      "insert into senses (lemma_id, status, definition_it) values ($1, 'approved', $2) returning id",
      [id, definitions[i] ?? null])).rows[0]?.id ?? -1;
    await db.query("insert into glosses (sense_id, language, gloss, status) values ($1, 'it', $2, 'approved')", [sense, text]);
  }
  return id;
}

const markSplit = async (db: PGlite): Promise<void> => {
  await actAs(db, "trusted");
  await db.query("select private.mark_split_lemmas()");
};

// The entry as loadEntry[] reads it, through the same columns.
async function entryOf(db: PGlite, id: number): Promise<Entry> {
  await actAs(db, "trusted");
  const l = (await db.query<Lemma>("select * from lemmas where id = $1", [id])).rows[0];
  assert.ok(l !== undefined);
  const senses = (await db.query<Sense>("select * from senses where lemma_id = $1 order by sense_number", [id])).rows;
  const glosses = (await db.query<Gloss>(
    "select g.* from glosses as g join senses as s on s.id = g.sense_id where s.lemma_id = $1", [id])).rows;
  const iso = (v: unknown): string | null => (v === null || v === undefined ? null : new Date(String(v)).toISOString());
  return {
    lemma: { ...l, senses_reviewed_at: iso(l.senses_reviewed_at), deleted_at: iso(l.deleted_at) },
    wordforms: [],
    senses: senses.map((s) => ({
      sense: { ...s, deleted_at: iso(s.deleted_at) },
      glosses: glosses.filter((g) => g.sense_id === s.id).map((g) => ({ ...g, deleted_at: iso(g.deleted_at) })),
    })),
  };
}

async function shapeOf(db: PGlite, id: number): Promise<[string | null, string[]][]> {
  const entry: Entry = await entryOf(db, id);
  return entry.senses.filter((s) => s.sense.deleted_at === null)
    .map((s) => [s.sense.definition_it, s.glosses.filter((g) => g.deleted_at === null).sort((a, b) => a.id - b.id).map((g) => g.gloss)]);
}

/* The page, as a reviewer uses it: choices and definitions typed by
   translation text. */
async function choose(db: PGlite, id: number, chosen: Record<string, number> | "one" | "keep",
  typedByGroup: Record<number, string> = {}): Promise<void> {
  const entry: Entry = await entryOf(db, id);
  const rows = repairRows(entry);
  const assignment: Map<number, number> = initialAssignment(rows);
  if (typeof chosen === "object") {
    for (const row of rows) {
      assignment.set(row.glossId, chosen[row.gloss] ?? row.position);
    }
  }
  const action = typeof chosen === "object" ? "group" : chosen;
  const plan = planFor(action, entry, rows, assignment, new Map(Object.entries(typedByGroup).map(([k, v]) => [Number(k), v])));
  assert.deepEqual(plan.unused, []);
  await rowsAs(db, reviewer, "select public.regroup_senses($1, $2::jsonb, $3::jsonb)",
    [id, JSON.stringify(seenOf(entry)), JSON.stringify(plan.groups)]);
}

test("the page, used as a speaker did on five entries, leaves exactly the senses he chose", async () => {
  const db = await createSeededDatabase();
  const stecco: number = await loaded(db, "stécco", ["stecco", "stecchino", "stuzzicadenti"]);
  const sacrifica: number = await loaded(db, "sacrificâ", ["sacrificare", "immolare"]);
  const sacheza: number = await loaded(db, "sachezâ", ["razziare", "saccheggiare"]);
  const sachezzo: number = await loaded(db, "sachézzo", ["razzia", "scorreria", "saccheggio", "sacco"]);
  const gabibbo: number = await loaded(db, "gabìbbo", ["gabibbo", "meridionale", "terrone"]);
  await markSplit(db);

  const queued = await rowsAs<{ lemma_id: number }>(db, reviewer, "select lemma_id from public.sense_review_queue()");
  for (const id of [stecco, sacrifica, sacheza, sachezzo, gabibbo]) {
    assert.equal(isWaiting(await entryOf(db, id)), queued.some((q) => q.lemma_id === id));
  }

  await choose(db, stecco, { stecco: 1, stecchino: 2, stuzzicadenti: 2 });
  await choose(db, sacrifica, "keep", { 1: "rinunciare a qualcosa per un fine" });
  await choose(db, sacheza, "keep");
  await choose(db, sachezzo, { razzia: 1, scorreria: 1, saccheggio: 3, sacco: 4 });
  await choose(db, gabibbo, "one");

  assert.deepEqual((await shapeOf(db, stecco)).map((s) => s[1]), [["stecco"], ["stecchino", "stuzzicadenti"]]);
  assert.deepEqual(await shapeOf(db, sacrifica), [["rinunciare a qualcosa per un fine", ["sacrificare"]], [null, ["immolare"]]]);
  assert.deepEqual((await shapeOf(db, sacheza)).map((s) => s[1]), [["razziare"], ["saccheggiare"]]);
  assert.deepEqual((await shapeOf(db, sachezzo)).map((s) => s[1]), [["razzia", "scorreria"], ["saccheggio"], ["sacco"]]);
  assert.deepEqual((await shapeOf(db, gabibbo)).map((s) => s[1]), [["gabibbo", "meridionale", "terrone"]]);
  for (const id of [stecco, sacrifica, sacheza, sachezzo, gabibbo]) {
    assert.equal(isWaiting(await entryOf(db, id)), false);
  }
  assert.deepEqual(await rowsAs(db, reviewer, "select lemma_id from public.sense_review_queue()"), []);
});

test("reordering senses that have definitions leaves each definition on its own translations", async () => {
  const db = await createSeededDatabase();
  const penna: number = await loaded(db, "pénna", ["penna", "piuma", "stilo"],
    ["strumento per scrivere", "piuma di uccello", null]);
  // Swapped, without typing anything.
  await choose(db, penna, { penna: 2, piuma: 1, stilo: 3 });
  assert.deepEqual(await shapeOf(db, penna), [
    ["piuma di uccello", ["piuma"]], ["strumento per scrivere", ["penna"]], [null, ["stilo"]]]);
  // Swapped back, a new definition typed for the group of "stilo" and
  // one for the group that merges two senses into a new one.
  await choose(db, penna, { penna: 1, piuma: 2, stilo: 1 }, { 1: "per scrivere" });
  assert.deepEqual(await shapeOf(db, penna), [["per scrivere", ["penna", "stilo"]], ["piuma di uccello", ["piuma"]]]);
});

test("the page's rule agrees with the queue on every kind of entry", async () => {
  const db = await createSeededDatabase();
  const ids: number[] = [
    await loaded(db, "béllo", ["bello", "carino"]),
    await loaded(db, "sôlo", ["solo"]),
    await loaded(db, "defî", ["definire", "stabilire"]),
    await loaded(db, "vìsto", ["visto", "veduto"]),
  ];
  await markSplit(db);
  ids.push(await loaded(db, "nêuvo", ["nuovo", "recente"]));
  await actAs(db, "trusted");
  await db.query("update senses set definition_it = 'una' where lemma_id = $1 and sense_number = 1", [ids[2]]);
  await affectedAs(db, reviewer, "update lemmas set senses_reviewed_at = now() where id = $1", [ids[3]]);
  const queued = await rowsAs<{ lemma_id: number }>(db, reviewer, "select lemma_id from public.sense_review_queue()");
  for (const id of ids) {
    assert.equal(isWaiting(await entryOf(db, id)), queued.some((q) => q.lemma_id === id), `lemma ${id}`);
  }
  assert.deepEqual(queued.map((q) => q.lemma_id).sort((a, b) => a - b), [ids[0], ids[2]].sort((a, b) => Number(a) - Number(b)));
});
