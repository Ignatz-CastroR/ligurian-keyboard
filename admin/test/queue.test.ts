/*
 * queue.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 13:41:55, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of admin/src/queue.ts: the queue grouped by entry, the
 *           labels of senses and translations, the selection [one row,
 *           Shift+click ranges, a whole entry, everything], and the
 *           items a batch sends. The last test runs the page's logic on
 *           a real queue read from the database and approves it with
 *           review_batch[].
 * Updated:  2026/10/18, 16:24:30: a statement stopped at the time limit
 *           is reported as a timeout [migration 0008].
 * Decision: docs/decisions/0033-batch-review.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { messagesFor } from "../src/messages.ts";
import {
  BATCH_SIZE, afterBatch, batchItems, chunks, clickGroup, clickRow, coverage, displayOrder, failureKind, groupItems,
  groupQueue, itemContext, itemKey, itemLabel, keepVisible, mergeResults, rangeKeys, selectAll, selectedItems,
  type BatchFailure, type BatchResult, type Selection,
} from "../src/queue.ts";
import type { QueueItem } from "../src/types.ts";

const it = messagesFor("it");

let nextId: number = 1;
function row(kind: QueueItem["kind"], lemmaId: number, fields: Partial<QueueItem> = {}): QueueItem {
  const id: number = fields.id ?? nextId++;
  return {
    kind, id, lemma_id: lemmaId, text: `${kind} ${id}`, created_by: null,
    created_at: "2026-10-18T12:00:00+00:00", version: 1,
    lemma_headword: `lemma${lemmaId}`, lemma_status: "pending", lemma_public_id: null,
    sense_id: null, sense_number: null, definition_it: null, language: null, gloss: null,
    ...fields,
  };
}

/* The queue as the database orders it, oldest first: an entry proposed
   whole [lemma 1], and new parts of an approved lemma [lemma 2]. */
function sampleQueue(): QueueItem[] {
  return [
    row("lemma", 1, { id: 1, text: "pénna", lemma_headword: "pénna", created_at: "2026-10-18T10:00:00+00:00" }),
    row("gloss", 1, { id: 40, sense_id: 30, sense_number: 1, definition_it: "strumento", language: "es", gloss: "pluma",
      created_at: "2026-10-18T10:00:05+00:00" }),
    row("sense", 1, { id: 31, sense_id: 31, sense_number: 2, created_at: "2026-10-18T10:00:03+00:00" }),
    row("sense", 1, { id: 30, sense_id: 30, sense_number: 1, definition_it: "strumento", created_at: "2026-10-18T10:00:02+00:00" }),
    row("wordform", 1, { id: 20, text: "pénne", created_at: "2026-10-18T10:00:01+00:00" }),
    row("wordform", 2, { id: 21, text: "cæ", lemma_headword: "cà", lemma_status: "approved", created_at: "2026-10-18T11:00:00+00:00" }),
    row("gloss", 2, { id: 41, sense_id: 32, sense_number: 1, definition_it: null, language: "en", gloss: "house",
      lemma_headword: "cà", lemma_status: "approved", created_at: "2026-10-18T11:00:01+00:00" }),
  ];
}

test("the queue is grouped by entry: the lemma, its forms, then each sense with its translations", () => {
  const groups = groupQueue(sampleQueue());
  assert.deepEqual(groups.map((g) => [g.lemmaId, g.headword, g.lemmaStatus]), [[1, "pénna", "pending"], [2, "cà", "approved"]]);
  assert.deepEqual(groupItems(groups[0]!).map(itemKey), ["lemma:1", "wordform:20", "sense:30", "gloss:40", "sense:31"]);
  // An approved lemma has no row of its own, but its new parts still form a group.
  assert.equal(groups[1]?.lemma, null);
  assert.deepEqual(groupItems(groups[1]!).map(itemKey), ["wordform:21", "gloss:41"]);
  assert.deepEqual(displayOrder(groups), ["lemma:1", "wordform:20", "sense:30", "gloss:40", "sense:31", "wordform:21", "gloss:41"]);
});

test("a sense without a definition is never shown as a bare number, in any language", () => {
  const items: QueueItem[] = sampleQueue();
  const bare: QueueItem = items.find((i) => i.id === 31)!;
  const defined: QueueItem = items.find((i) => i.id === 30)!;
  const gloss: QueueItem = items.find((i) => i.id === 40)!;
  assert.equal(itemLabel(it, bare), "Significato 2, senza definizione");
  assert.equal(itemLabel(it, defined), "Significato 1: strumento");
  assert.equal(itemLabel(it, gloss), "es: pluma");
  assert.equal(itemContext(it, gloss), "del significato 1");
  assert.equal(itemContext(it, defined), "");
  assert.equal(itemLabel(messagesFor("es"), bare), "Acepción 2, sin definición");
  assert.equal(itemLabel(messagesFor("en"), bare), "Sense 2, no definition");
  for (const lang of ["it", "en", "es"] as const) {
    for (const item of items) {
      assert.doesNotMatch(itemLabel(messagesFor(lang), item), /^\s*\d+\.?\s*$/u, `${lang} ${itemKey(item)}`);
    }
  }
  // Without the columns of migration 0007, the queue's own text.
  assert.equal(itemLabel(it, row("sense", 9, { text: "1. " })), "1. ");
  assert.equal(itemLabel(it, row("wordform", 9, { text: "pénne" })), "pénne");
});

test("a Shift+click range runs from the anchor to the clicked row, in either direction", () => {
  const order: string[] = ["a", "b", "c", "d", "e"];
  assert.deepEqual(rangeKeys(order, "b", "d"), ["b", "c", "d"]);
  assert.deepEqual(rangeKeys(order, "d", "b"), ["b", "c", "d"]);
  assert.deepEqual(rangeKeys(order, null, "c"), ["c"]);
  assert.deepEqual(rangeKeys(order, "gone", "c"), ["c"]);
  assert.deepEqual(rangeKeys(order, "a", "gone"), []);
});

test("a click toggles one row; Shift+click gives the whole range the clicked box's new state", () => {
  const groups = groupQueue(sampleQueue());
  const order: string[] = displayOrder(groups);
  let s: Selection = { selected: new Set(), anchor: null };
  s = clickRow(s, order, "wordform:20", true, false);
  assert.deepEqual([...s.selected], ["wordform:20"]);
  s = clickRow(s, order, "wordform:21", true, true);
  assert.deepEqual([...s.selected].sort(), ["gloss:40", "sense:30", "sense:31", "wordform:20", "wordform:21"].sort());
  assert.equal(s.anchor, "wordform:21");
  // Shift+click again, unchecking: the range from the new anchor
  // [wordform:21] back to gloss:40 clears; rows before it stay.
  s = clickRow(s, order, "gloss:40", false, true);
  assert.deepEqual([...s.selected].sort(), ["sense:30", "wordform:20"]);
  // Without Shift, only the clicked row, even with an anchor.
  s = clickRow(s, order, "lemma:1", true, false);
  assert.deepEqual([...s.selected].sort(), ["lemma:1", "sense:30", "wordform:20"]);
});

test("an entry's box selects all its rows; select all selects every row; boxes show all, some or none", () => {
  const groups = groupQueue(sampleQueue());
  let s: Selection = clickGroup({ selected: new Set(), anchor: null }, groups[0]!, true);
  const first: string[] = groupItems(groups[0]!).map(itemKey);
  assert.equal(coverage(s.selected, first), "all");
  assert.equal(coverage(s.selected, displayOrder(groups)), "some");
  s = clickRow(s, displayOrder(groups), "sense:31", false, false);
  assert.equal(coverage(s.selected, first), "some");
  s = clickGroup(s, groups[0]!, false);
  assert.equal(coverage(s.selected, first), "none");
  assert.equal(coverage(selectAll(groups, true).selected, displayOrder(groups)), "all");
  assert.equal(selectAll(groups, false).selected.size, 0);
});

test("after a reload, rows no longer on the page leave the selection, and so does a stale anchor", () => {
  const groups = groupQueue(sampleQueue());
  const s: Selection = { selected: new Set(["lemma:1", "wordform:21", "gloss:999"]), anchor: "gloss:999" };
  const after = groupQueue(sampleQueue().filter((i) => i.lemma_id === 2));
  const kept: Selection = keepVisible(s, after);
  assert.deepEqual([...kept.selected], ["wordform:21"]);
  assert.equal(kept.anchor, null);
  assert.deepEqual(selectedItems(groups, new Set(["gloss:41", "lemma:1"])).map(itemKey), ["lemma:1", "gloss:41"]);
});

test("a batch sends kind, id and the version the reviewer saw, in calls of at most BATCH_SIZE rows", () => {
  const items: QueueItem[] = [row("lemma", 1, { id: 5, version: 3 }), row("gloss", 1, { id: 6, version: 1 })];
  assert.deepEqual(batchItems(items), [{ kind: "lemma", id: 5, version: 3 }, { kind: "gloss", id: 6, version: 1 }]);
  assert.equal(BATCH_SIZE, 200);
  assert.deepEqual(chunks([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunks([], 2), []);
  assert.equal(chunks(Array.from({ length: 401 }, (_v, i) => i), BATCH_SIZE).length, 3);
  const f: BatchFailure = { kind: "gloss", id: 6, reason: "conflict", sqlstate: null, message: "m" };
  const merged: BatchResult = mergeResults({ updated: 2, failed: [] }, { updated: 1, failed: [f] });
  assert.deepEqual(merged, { updated: 3, failed: [f] });
});

test("each failure reason becomes the kind of message a person reads", () => {
  const base: BatchFailure = { kind: "lemma", id: 1, reason: "error", sqlstate: null, message: "" };
  assert.equal(failureKind({ ...base, reason: "conflict" }), "conflict");
  assert.equal(failureKind({ ...base, reason: "notfound" }), "notfound");
  assert.equal(failureKind({ ...base, sqlstate: "42501" }), "permission");
  assert.equal(failureKind({ ...base, sqlstate: "23505" }), "duplicate");
  assert.equal(failureKind({ ...base, sqlstate: "99999" }), "generic");
  assert.equal(failureKind({ ...base, sqlstate: "57014" }), "timeout");
});

test("on a real queue, selecting a whole entry and approving it approves every part in one call", async () => {
  const db = await createSeededDatabase();
  const contributor = asUser(USERS.contributor);
  const reviewer = asUser(USERS.reviewer);
  const lemma: number = (await rowsAs<{ id: number }>(db, contributor,
    "insert into lemmas (headword) values ('pénna') returning id"))[0]?.id ?? -1;
  await rowsAs(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'pénne')", [lemma]);
  const sense: number = (await rowsAs<{ id: number }>(db, contributor,
    "insert into senses (lemma_id) values ($1) returning id", [lemma]))[0]?.id ?? -1;
  await rowsAs(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'es', 'pluma')", [sense]);

  const groups = groupQueue(await rowsAs<QueueItem>(db, reviewer, "select * from review_queue"));
  assert.equal(groups.length, 1);
  assert.deepEqual(groupItems(groups[0]!).map((i) => i.kind), ["lemma", "wordform", "sense", "gloss"]);
  assert.deepEqual(groupItems(groups[0]!).map((i) => itemLabel(it, i)),
    ["pénna", "pénne", "Significato 1, senza definizione", "es: pluma"]);

  const chosen: QueueItem[] = selectedItems(groups, clickGroup({ selected: new Set(), anchor: null }, groups[0]!, true).selected);
  const rows = await rowsAs<{ result: BatchResult }>(db, reviewer,
    "select public.review_batch($1::jsonb, 'approved') as result", [JSON.stringify(batchItems(chosen))]);
  assert.deepEqual(rows[0]?.result, { updated: 4, failed: [] });
  assert.deepEqual(await rowsAs(db, reviewer, "select * from review_queue"), []);
});

test("after a batch no row of it stays selected, so a changed row is never approved by a second click", () => {
  const groups = groupQueue(sampleQueue());
  const before: Selection = { selected: new Set(["lemma:1", "wordform:20", "gloss:41"]), anchor: "wordform:20" };
  const sent: QueueItem[] = selectedItems(groups, new Set(["lemma:1", "wordform:20"]));
  const after: Selection = afterBatch(before, sent);
  assert.deepEqual([...after.selected], ["gloss:41"]);
  assert.equal(after.anchor, null);
  assert.equal(afterBatch(before, []).anchor, "wordform:20");
});
