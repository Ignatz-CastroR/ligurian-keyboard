/*
 * batch-review.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 12:58:14, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0007: review_queue carries what the manager
 *           needs to group and label every row; review_batch[] approves
 *           or rejects many rows in one call, row by row, so that a row
 *           changed by someone else, gone, deleted or refused by a rule
 *           is reported and every other row is still changed; only
 *           staff may call it, and a malformed request changes nothing.
 * Contract: Every test builds its own database. A rule is tested from
 *           the side of the person who must NOT be able to break it.
 * Decision: docs/decisions/0033-batch-review.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import {
  USERS, actAs, affectedAs, asUser, createSeededDatabase, migrationNames, rowsAs, runMigration, type Identity,
} from "./harness.ts";

interface IdRow { id: number }
interface StatusRow { id: number; status: string; version: number }
interface Item { kind: string; id: number; version: number }
interface Failure { kind: string; id: number; reason: string; sqlstate: string | null; message: string }
interface BatchResult { updated: number; failed: Failure[] }
interface QueueRow {
  kind: string;
  id: number;
  lemma_id: number;
  version: number;
  lemma_headword: string | null;
  lemma_status: string | null;
  lemma_public_id: string | null;
  sense_id: number | null;
  sense_number: number | null;
  definition_it: string | null;
  language: string | null;
  gloss: string | null;
}

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);
const contributor2 = asUser(USERS.contributor2);
const member = asUser(USERS.member);

interface Proposal { lemma: number; form: number; sense: number; bareSense: number; gloss: number }

/* What Nacho's experiment produced: a contributor's entry, every part
   pending, one sense without a definition. */
async function propose(db: PGlite, who: Identity = contributor, headword: string = "pénna"): Promise<Proposal> {
  const one = async (sql: string, params: unknown[] = []): Promise<number> =>
    (await rowsAs<IdRow>(db, who, sql, params))[0]?.id ?? -1;
  const lemma: number = await one("insert into lemmas (headword, part_of_speech) values ($1, 'noun') returning id", [headword]);
  const form: number = await one("insert into wordforms (lemma_id, form, grammatical_tag) values ($1, $2, 'pl.') returning id",
    [lemma, `${headword.slice(0, -1)}e`]);
  const sense: number = await one("insert into senses (lemma_id, definition_it) values ($1, 'strumento per scrivere') returning id", [lemma]);
  const bareSense: number = await one("insert into senses (lemma_id) values ($1) returning id", [lemma]);
  const gloss: number = await one("insert into glosses (sense_id, language, gloss) values ($1, 'es', 'pluma') returning id", [sense]);
  return { lemma, form, sense, bareSense, gloss };
}

async function queueAs(db: PGlite, who: Identity): Promise<QueueRow[]> {
  return rowsAs<QueueRow>(db, who, "select * from review_queue");
}

function itemKeyOf(row: { kind: string; id: number }): string {
  return `${row.kind}:${row.id}`;
}

function itemsOf(queue: QueueRow[]): Item[] {
  return queue.map((row) => ({ kind: row.kind, id: row.id, version: row.version }));
}

async function batchAs(db: PGlite, who: Identity, items: unknown, status: string): Promise<BatchResult> {
  const rows = await rowsAs<{ result: BatchResult }>(db, who,
    "select public.review_batch($1::jsonb, $2::public.review_status) as result", [JSON.stringify(items), status]);
  const result: BatchResult | undefined = rows[0]?.result;
  assert.ok(result !== undefined);
  return result;
}

async function statusOf(db: PGlite, table: string, id: number): Promise<StatusRow> {
  const row: StatusRow | undefined = (await rowsAs<StatusRow>(db, "trusted",
    `select id, status::text as status, version from ${table} where id = $1`, [id]))[0];
  assert.ok(row !== undefined, `${table} ${id}`);
  return row;
}

async function rejectsWith(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error: unknown) => (error as { code?: string }).code === code);
}

test("migration 0007 exists and runs after 0006", () => {
  const names: string[] = migrationNames();
  assert.equal(names.at(-1), "0007_batch_review.sql");
  assert.equal(names.at(-2), "0006_public_ids_and_backups.sql");
});

test("the queue carries each row's version, its lemma, and its sense, so nothing is labelled by guesswork", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const queue: QueueRow[] = await queueAs(db, reviewer);
  assert.deepEqual(queue.map((r) => r.kind).sort(), ["gloss", "lemma", "sense", "sense", "wordform"]);

  const code: string = (await rowsAs<{ public_id: string }>(db, "trusted",
    "select public_id from lemmas where id = $1", [p.lemma]))[0]?.public_id ?? "";
  for (const row of queue) {
    assert.equal(row.version, 1, row.kind);
    assert.equal(row.lemma_id, p.lemma);
    assert.equal(row.lemma_headword, "pénna");
    assert.equal(row.lemma_status, "pending");
    assert.equal(row.lemma_public_id, code);
  }
  const bare: QueueRow | undefined = queue.find((r) => r.kind === "sense" && r.id === p.bareSense);
  assert.equal(bare?.sense_number, 2);
  assert.equal(bare?.definition_it, null);
  assert.equal(bare?.sense_id, p.bareSense);
  const gloss: QueueRow | undefined = queue.find((r) => r.kind === "gloss");
  assert.deepEqual([gloss?.sense_id, gloss?.sense_number, gloss?.definition_it, gloss?.language, gloss?.gloss],
    [p.sense, 1, "strumento per scrivere", "es", "pluma"]);
  const lemma: QueueRow | undefined = queue.find((r) => r.kind === "lemma");
  assert.deepEqual([lemma?.sense_id, lemma?.language, lemma?.gloss], [null, null, null]);

  // A contributor still sees only their own proposals, and a member none.
  await propose(db, contributor2, "ciöso");
  assert.equal((await queueAs(db, contributor)).length, 5);
  assert.equal((await queueAs(db, contributor2)).length, 5);
  assert.equal((await queueAs(db, reviewer)).length, 10);
  assert.equal((await queueAs(db, member)).length, 0);
});

test("a reviewer approves a whole entry in one call: every part, the base form, and one line of history each", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const result: BatchResult = await batchAs(db, reviewer, itemsOf(await queueAs(db, reviewer)), "approved");
  assert.deepEqual(result, { updated: 5, failed: [] });

  for (const [table, id] of [["lemmas", p.lemma], ["wordforms", p.form], ["senses", p.sense],
    ["senses", p.bareSense], ["glosses", p.gloss]] as const) {
    assert.deepEqual([(await statusOf(db, table, id)).status, (await statusOf(db, table, id)).version], ["approved", 2], `${table} ${id}`);
  }
  const base = await rowsAs<{ status: string }>(db, "trusted",
    "select status::text as status from wordforms where lemma_id = $1 and is_base", [p.lemma]);
  assert.deepEqual(base, [{ status: "approved" }]);
  assert.equal((await queueAs(db, reviewer)).length, 0);

  // Five rows approved, plus the base form, which follows its lemma.
  const history = await rowsAs<{ table_name: string; actor: string; base: boolean }>(db, "trusted",
    `select table_name, actor::text as actor, coalesce((new_row ->> 'is_base')::boolean, false) as base
       from audit_log where action = 'update' and new_row ->> 'status' = 'approved'`);
  assert.equal(history.length, 6);
  assert.equal(history.filter((h) => h.base).length, 1);
  assert.ok(history.every((h) => h.actor === USERS.reviewer));

  const published = await rowsAs<{ form: string }>(db, "anon", "select form from published_wordforms order by form");
  assert.deepEqual(published.map((r) => r.form), ["pénna", "pénne"]);
});

test("a part rejected first stays rejected when the entry is approved afterwards", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const queue: QueueRow[] = await queueAs(db, reviewer);
  const bare: Item[] = itemsOf(queue.filter((r) => r.id === p.bareSense && r.kind === "sense"));
  assert.deepEqual(await batchAs(db, reviewer, bare, "rejected"), { updated: 1, failed: [] });

  const rest: Item[] = itemsOf(await queueAs(db, reviewer));
  assert.equal(rest.length, 4);
  assert.deepEqual(await batchAs(db, reviewer, rest, "approved"), { updated: 4, failed: [] });
  assert.equal((await statusOf(db, "senses", p.bareSense)).status, "rejected");
  assert.equal((await statusOf(db, "senses", p.sense)).status, "approved");
});

test("rows changed, missing or deleted since the queue was read are reported; every other row is changed", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const items: Item[] = itemsOf(await queueAs(db, reviewer));

  // After the queue was read: the contributor edits the form, an admin
  // deletes the bare sense.
  await affectedAs(db, contributor, "update wordforms set grammatical_tag = 'pl. m.' where id = $1", [p.form]);
  await affectedAs(db, admin, "update senses set deleted_at = now() where id = $1", [p.bareSense]);
  const all: Item[] = [...items, { kind: "gloss", id: 999999, version: 1 }];

  const result: BatchResult = await batchAs(db, reviewer, all, "approved");
  assert.equal(result.updated, 3);
  const reasons: string[] = result.failed.map((f) => `${f.kind} ${f.id} ${f.reason}`).sort();
  assert.deepEqual(reasons, [`gloss 999999 notfound`, `sense ${p.bareSense} notfound`, `wordform ${p.form} conflict`].sort());
  const conflict: Failure | undefined = result.failed.find((f) => f.reason === "conflict");
  assert.match(conflict?.message ?? "", /version 2, not 1/u);

  assert.equal((await statusOf(db, "lemmas", p.lemma)).status, "approved");
  assert.equal((await statusOf(db, "glosses", p.gloss)).status, "approved");
  assert.equal((await statusOf(db, "wordforms", p.form)).status, "pending");
  assert.equal((await statusOf(db, "senses", p.bareSense)).status, "pending");
});

test("even an admin's batch never changes a deleted row", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const items: Item[] = itemsOf((await queueAs(db, admin)).filter((r) => r.kind === "wordform"));
  await affectedAs(db, admin, "update wordforms set deleted_at = now() where id = $1", [p.form]);
  const version: number = (await statusOf(db, "wordforms", p.form)).version;
  const result: BatchResult = await batchAs(db, admin, [{ ...items[0], version }], "approved");
  assert.equal(result.updated, 0);
  assert.equal(result.failed[0]?.reason, "notfound");
  assert.equal((await statusOf(db, "wordforms", p.form)).status, "pending");
});

test("a row a rule refuses fails alone, with its SQLSTATE, and the rest of the batch goes through", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const base: StatusRow | undefined = (await rowsAs<StatusRow>(db, "trusted",
    "select id, status::text as status, version from wordforms where lemma_id = $1 and is_base", [p.lemma]))[0];
  assert.ok(base !== undefined);

  // The base form follows its lemma and may never be reviewed on its own.
  const items: Item[] = [{ kind: "wordform", id: base.id, version: base.version }, { kind: "wordform", id: p.form, version: 1 }];
  const result: BatchResult = await batchAs(db, reviewer, items, "approved");
  assert.equal(result.updated, 1);
  assert.deepEqual(result.failed.map((f) => [f.id, f.reason, f.sqlstate]), [[base.id, "error", "42501"]]);
  assert.equal((await statusOf(db, "wordforms", p.form)).status, "approved");
  assert.equal((await statusOf(db, "wordforms", base.id)).status, "pending");
});

test("a row named twice is changed once, and failures come back in the order given", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const lemma: Item = { kind: "lemma", id: p.lemma, version: 1 };
  const result: BatchResult = await batchAs(db, reviewer,
    [{ kind: "sense", id: 777, version: 1 }, lemma, lemma, { kind: "gloss", id: 555, version: 1 }], "rejected");
  assert.equal(result.updated, 1);
  assert.deepEqual(result.failed.map((f) => f.id), [777, 555]);
  assert.deepEqual([(await statusOf(db, "lemmas", p.lemma)).status, (await statusOf(db, "lemmas", p.lemma)).version], ["rejected", 2]);
});

test("contributors and members are refused before any row is touched; anonymous visitors cannot call it", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const items: Item[] = itemsOf(await queueAs(db, reviewer));
  for (const who of [contributor, contributor2, member]) {
    await rejectsWith(batchAs(db, who, items, "approved"), "42501");
  }
  await rejectsWith(batchAs(db, "anon", items, "approved"), "42501");
  assert.equal((await statusOf(db, "lemmas", p.lemma)).status, "pending");
  assert.equal((await queueAs(db, reviewer)).length, 5);
});

test("a malformed request is refused whole: pending as the status, an unknown kind, a bad number, too many items", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const good: Item = { kind: "lemma", id: p.lemma, version: 1 };
  await rejectsWith(batchAs(db, reviewer, [good], "pending"), "22023");
  for (const bad of [
    [good, { kind: "headword", id: 1, version: 1 }],
    [good, { kind: "lemma", id: "1", version: 1 }],
    [good, { kind: "lemma", id: 1.5, version: 1 }],
    [good, { kind: "lemma", id: -1, version: 1 }],
    [good, { kind: "lemma", id: 1 }],
    [good, { kind: "lemma", id: 1, version: 1e12 }],
    [good, "lemma 1"],
    { kind: "lemma", id: p.lemma, version: 1 },
  ]) {
    await rejectsWith(batchAs(db, reviewer, bad, "approved"), "22023");
  }
  const tooMany: Item[] = Array.from({ length: 501 }, (_v, i) => ({ kind: "gloss", id: 100000 + i, version: 1 }));
  await rejectsWith(batchAs(db, reviewer, tooMany, "approved"), "22023");
  assert.equal((await statusOf(db, "lemmas", p.lemma)).status, "pending");

  // Exactly 500 is allowed.
  const result: BatchResult = await batchAs(db, reviewer, [good, ...tooMany.slice(0, 499)], "approved");
  assert.equal(result.updated, 1);
  assert.equal(result.failed.length, 499);
});

test("the trusted backend may run a batch, and the history records no user for it", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const result: BatchResult = await batchAs(db, "trusted", [{ kind: "lemma", id: p.lemma, version: 1 }], "approved");
  assert.deepEqual(result, { updated: 1, failed: [] });
  const actors = await rowsAs<{ actor: string | null }>(db, "trusted",
    "select actor::text as actor from audit_log where table_name = 'lemmas' and row_id = $1 and action = 'update'", [p.lemma]);
  assert.deepEqual(actors, [{ actor: null }]);
});

test("migration 0007 on a database with pending rows keeps the six original columns of the queue, row for row", async () => {
  const db = await createSeededDatabase("0006_public_ids_and_backups.sql");
  await propose(db);
  await propose(db, contributor2, "ciöso");
  const original: string = "select kind, id, lemma_id, text, created_by, created_at from review_queue";
  const before = await rowsAs(db, reviewer, original);
  assert.equal(before.length, 10);
  await runMigration(db, "0007_batch_review.sql");
  assert.deepEqual(await rowsAs(db, reviewer, original), before);
  assert.deepEqual(await rowsAs(db, contributor, original), before.filter((r) => (r as { created_by: string }).created_by === USERS.contributor));
});

test("rows of a deleted lemma or a deleted sense leave the queue, and a batch reports them instead of approving them", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const q: Proposal = await propose(db, contributor, "ciöso");
  const items: Item[] = itemsOf(await queueAs(db, reviewer));
  await affectedAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [p.lemma]);
  await affectedAs(db, admin, "update senses set deleted_at = now() where id = $1", [q.sense]);

  const left: QueueRow[] = await queueAs(db, reviewer);
  assert.deepEqual(left.map((r) => itemKeyOf(r)).sort(),
    [`lemma:${q.lemma}`, `wordform:${q.form}`, `sense:${q.bareSense}`].sort());

  const result: BatchResult = await batchAs(db, admin, items.filter((i) => i.kind !== "lemma" || i.id !== p.lemma), "approved");
  const reasons: Map<string, string> = new Map(result.failed.map((f) => [`${f.kind}:${f.id}`, `${f.reason} ${f.message}`]));
  assert.match(reasons.get(`wordform:${p.form}`) ?? "", /^notfound .*deleted lemma/u);
  assert.match(reasons.get(`gloss:${p.gloss}`) ?? "", /^notfound .*deleted sense or lemma/u);
  assert.match(reasons.get(`gloss:${q.gloss}`) ?? "", /^notfound .*deleted sense or lemma/u);
  assert.match(reasons.get(`sense:${q.sense}`) ?? "", /^notfound .*is deleted/u);
  assert.equal(result.updated, 3);
  for (const [table, id] of [["wordforms", p.form], ["glosses", p.gloss], ["glosses", q.gloss]] as const) {
    assert.equal((await statusOf(db, table, id)).status, "pending", `${table} ${id}`);
  }
});

test("a batch reviews only pending rows: an approved row named at its current version is refused with 22023", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  assert.deepEqual(await batchAs(db, reviewer, [{ kind: "wordform", id: p.form, version: 1 }], "approved"), { updated: 1, failed: [] });
  const result: BatchResult = await batchAs(db, reviewer, [{ kind: "wordform", id: p.form, version: 2 }], "rejected");
  assert.deepEqual(result.failed.map((f) => [f.reason, f.sqlstate]), [["error", "22023"]]);
  assert.equal((await statusOf(db, "wordforms", p.form)).status, "approved");
});

test("a client token without a user is refused, never taken for the trusted backend", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  for (const role of ["authenticated", "anon"]) {
    await actAs(db, "trusted");
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role })]);
    await db.exec(`set role ${role};`);
    try {
      await rejectsWith(db.query("select public.review_batch($1::jsonb, 'approved')",
        [JSON.stringify([{ kind: "lemma", id: p.lemma, version: 1 }])]), "42501");
    } finally {
      await actAs(db, "trusted");
    }
  }
  assert.equal((await statusOf(db, "lemmas", p.lemma)).status, "pending");
});

test("a contributor's translation on another contributor's pending sense is in their queue, under the right lemma", async () => {
  const db = await createSeededDatabase();
  const p: Proposal = await propose(db);
  const gloss: number = (await rowsAs<IdRow>(db, contributor2,
    "insert into glosses (sense_id, language, gloss) values ($1, 'en', 'feather') returning id", [p.sense]))[0]?.id ?? -1;
  const own: QueueRow[] = await queueAs(db, contributor2);
  assert.deepEqual(own.map((r) => [r.kind, r.id, r.lemma_id, r.gloss]), [["gloss", gloss, p.lemma, "feather"]]);
  // The other contributor's pending sense and lemma stay hidden from them.
  assert.deepEqual([own[0]?.lemma_headword, own[0]?.definition_it], [null, null]);
});
