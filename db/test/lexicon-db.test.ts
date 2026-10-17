/*
 * lexicon-db.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/11, 18:39:15, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove the database rules: roles, review workflow, automatic
 *           base forms, senses and their translations, soft deletion,
 *           optimistic locking, history, and that the export is read
 *           correctly by the engine.
 * Contract: Every test builds its own database; no test depends on
 *           another. A rule is tested from the side of the person who
 *           must NOT be able to break it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { Lexicon } from "../../engine/src/lexicon.ts";
import { USERS, affectedAs, asUser, createDatabase, createSeededDatabase, rowsAs } from "./harness.ts";

interface IdRow { id: number }
interface LemmaRow { id: number; status: string; created_by: string | null; version: number }
interface WordformRow { form: string; is_base: boolean; status: string; created_by: string | null }
interface AuditRow { action: string; actor: string | null }
interface DictionaryRow { sense_number: number; definition_it: string | null; language: string | null; gloss: string | null }
interface QueueRow { kind: string; text: string }

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);
const contributor2 = asUser(USERS.contributor2);
const member = asUser(USERS.member);

/* Insert a lemma as the trusted backend. Its base form is created by
   the database; extraForms are the additional [inflected] spellings. */
async function seedEntry(db: PGlite, headword: string, status: string, extraForms: string[]): Promise<number> {
  const lemma = await db.query<IdRow>(
    "insert into lemmas (headword, status) values ($1, $2::review_status) returning id",
    [headword, status],
  );
  const lemmaId: number = lemma.rows[0]?.id ?? -1;
  for (const form of extraForms) {
    await db.query(
      "insert into wordforms (lemma_id, form, status) values ($1, $2, $3::review_status)",
      [lemmaId, form, status],
    );
  }
  return lemmaId;
}

/* Insert a sense as the trusted backend and return its id. */
async function seedSense(db: PGlite, lemmaId: number, status: string, definitionIt: string | null): Promise<number> {
  const sense = await db.query<IdRow>(
    "insert into senses (lemma_id, status, definition_it) values ($1, $2::review_status, $3) returning id",
    [lemmaId, status, definitionIt],
  );
  return sense.rows[0]?.id ?? -1;
}

async function publishedForms(db: PGlite): Promise<string[]> {
  const rows = await rowsAs<{ form: string }>(db, "anon", "select form from published_wordforms order by form");
  return rows.map((r) => r.form);
}

/* ====================================================================
   Accounts and roles
   ==================================================================== */

test("a new Supabase user gets a member profile", async () => {
  const db = await createDatabase();
  await db.query("insert into auth.users (id, raw_user_meta_data) values ($1, $2)", [
    USERS.member,
    JSON.stringify({ display_name: "Marco" }),
  ]);
  const rows = (await db.query<{ role: string; display_name: string }>("select role, display_name from profiles")).rows;
  assert.deepEqual(rows, [{ role: "member", display_name: "Marco" }]);
});

test("roles: no self promotion, admins promote, the last admin stays", async () => {
  const db = await createSeededDatabase();
  const promote: string = "update profiles set role = 'admin' where user_id = $1";
  await assert.rejects(affectedAs(db, member, promote, [USERS.member]), /only admins/);
  assert.equal(await affectedAs(db, admin, "update profiles set role = 'contributor' where user_id = $1", [USERS.member]), 1);
  await assert.rejects(
    affectedAs(db, admin, "update profiles set role = 'member' where user_id = $1", [USERS.admin]),
    /last admin/,
  );
});

/* ====================================================================
   Review workflow
   ==================================================================== */

test("members and anonymous visitors cannot propose entries", async () => {
  const db = await createSeededDatabase();
  await assert.rejects(rowsAs(db, member, "insert into lemmas (headword) values ('cà')"));
  await assert.rejects(rowsAs(db, "anon", "insert into lemmas (headword) values ('cà')"));
});

test("a contributor's entry is forced to pending and stamped with its author", async () => {
  const db = await createSeededDatabase();
  const rows = await rowsAs<LemmaRow>(
    db,
    contributor,
    "insert into lemmas (headword, status, created_by) values ('cà', 'approved', $1) returning id, status, created_by, version",
    [USERS.admin],
  );
  assert.equal(rows[0]?.status, "pending");
  assert.equal(rows[0]?.created_by, USERS.contributor);
  assert.equal(rows[0]?.version, 1);
});

test("pending entries are visible only to their author and to staff", async () => {
  const db = await createSeededDatabase();
  await rowsAs(db, contributor, "insert into lemmas (headword) values ('cà')");
  assert.equal((await rowsAs(db, contributor, "select id from lemmas")).length, 1);
  assert.equal((await rowsAs(db, reviewer, "select id from lemmas")).length, 1);
  assert.equal((await rowsAs(db, contributor2, "select id from lemmas")).length, 0);
  assert.equal((await rowsAs(db, member, "select id from lemmas")).length, 0);
  assert.equal((await rowsAs(db, "anon", "select id from lemmas")).length, 0);
});

test("a contributor cannot approve, and cannot edit once approved", async () => {
  const db = await createSeededDatabase();
  await rowsAs(db, contributor, "insert into lemmas (headword) values ('ca')");
  await assert.rejects(affectedAs(db, contributor, "update lemmas set status = 'approved'"), /review status/);

  assert.equal(await affectedAs(db, contributor, "update lemmas set headword = 'cà'"), 1);
  assert.equal(await affectedAs(db, reviewer, "update lemmas set status = 'approved'"), 1);
  assert.equal(await affectedAs(db, contributor, "update lemmas set headword = 'ca'"), 0);
});

test("a contributor cannot edit another contributor's pending entry", async () => {
  const db = await createSeededDatabase();
  await rowsAs(db, contributor, "insert into lemmas (headword) values ('cà')");
  assert.equal(await affectedAs(db, contributor2, "update lemmas set headword = 'ca'"), 0);
});

test("the review queue lists lemmas, extra forms, senses and glosses, not base forms", async () => {
  const db = await createSeededDatabase();
  const lemma = await rowsAs<IdRow>(db, contributor, "insert into lemmas (headword) values ('pénna') returning id");
  const lemmaId: number = lemma[0]?.id ?? -1;
  await rowsAs(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'pénne')", [lemmaId]);
  const sense = await rowsAs<IdRow>(
    db,
    contributor,
    "insert into senses (lemma_id, definition_it) values ($1, 'strumento per scrivere') returning id",
    [lemmaId],
  );
  await rowsAs(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'es', 'pluma')", [sense[0]?.id]);

  const queue = await rowsAs<QueueRow>(db, reviewer, "select kind, text from review_queue order by kind");
  assert.deepEqual(queue, [
    { kind: "gloss", text: "es: pluma" },
    { kind: "lemma", text: "pénna" },
    { kind: "sense", text: "1. strumento per scrivere" },
    { kind: "wordform", text: "pénne" },
  ]);
});

/* ====================================================================
   Automatic base form
   ==================================================================== */

test("creating a lemma creates its base form, which follows the lemma", async () => {
  const db = await createSeededDatabase();
  await rowsAs(db, contributor, "insert into lemmas (headword) values ('Zêna')");

  const base = (await db.query<WordformRow>("select form, is_base, status, created_by from wordforms")).rows;
  assert.deepEqual(base, [{ form: "Zêna", is_base: true, status: "pending", created_by: USERS.contributor }]);
  assert.deepEqual(await publishedForms(db), []);

  /* One approval publishes the lemma AND its own spelling. */
  await affectedAs(db, reviewer, "update lemmas set status = 'approved'");
  assert.deepEqual(await publishedForms(db), ["Zêna"]);

  /* Correcting the headword corrects the base form. */
  await affectedAs(db, reviewer, "update lemmas set headword = 'Zena'");
  assert.deepEqual(await publishedForms(db), ["Zena"]);

  /* Rejecting the lemma withdraws the base form too. */
  await affectedAs(db, reviewer, "update lemmas set status = 'rejected'");
  const after = (await db.query<WordformRow>("select form, is_base, status, created_by from wordforms")).rows;
  assert.equal(after[0]?.status, "rejected");
});

test("the base form cannot be edited, forged or duplicated directly", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "pénna", "approved", ["pénne"]);

  await assert.rejects(affectedAs(db, admin, "update wordforms set form = 'penna' where is_base"), /follows its lemma/);
  await assert.rejects(affectedAs(db, admin, "update wordforms set status = 'rejected' where is_base"), /follows its lemma/);
  await assert.rejects(db.query("update wordforms set deleted_at = now() where is_base"), /follows its lemma/);

  /* Frequency and grammatical tag stay editable. */
  assert.equal(await affectedAs(db, reviewer, "update wordforms set freq = 9 where is_base"), 1);

  /* A client cannot mark its own row as the base form. */
  await rowsAs(db, admin, "insert into wordforms (lemma_id, form, is_base) values ($1, 'pénni', true)", [lemmaId]);
  const bases = (await db.query<{ n: number }>("select count(*)::int as n from wordforms where is_base")).rows;
  assert.equal(bases[0]?.n, 1);

  /* Renaming the headword onto an existing extra form is refused clearly. */
  await assert.rejects(affectedAs(db, reviewer, "update lemmas set headword = 'pénne'"), /already has a wordform/);
});

test("extra forms need their own approval", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "pénna", "approved", []);
  await rowsAs(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'pénne')", [lemmaId]);
  assert.deepEqual(await publishedForms(db), ["pénna"]);
  await affectedAs(db, reviewer, "update wordforms set status = 'approved' where form = 'pénne'");
  assert.deepEqual(await publishedForms(db), ["pénna", "pénne"]);
});

/* ====================================================================
   Senses and translations
   ==================================================================== */

test("senses are numbered per lemma and carry optional translations", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "pénna", "approved", []);
  const writing: number = await seedSense(db, lemmaId, "approved", "strumento per scrivere");
  const feather: number = await seedSense(db, lemmaId, "approved", "piuma di uccello");
  const bare: number = await seedSense(db, lemmaId, "approved", null);
  await seedSense(db, lemmaId, "pending", "senso ancora da rivedere");

  const numbers = (await db.query<{ sense_number: number }>("select sense_number from senses order by id")).rows;
  assert.deepEqual(numbers.map((r) => r.sense_number), [1, 2, 3, 4]);
  assert.ok(bare > 0);

  const add: string = "insert into glosses (sense_id, language, gloss, status) values ($1, $2, $3, 'approved')";
  await db.query(add, [writing, "it", "penna"]);
  await db.query(add, [writing, "it", "stilografica"]);
  await db.query(add, [writing, "es", "pluma"]);
  await db.query(add, [writing, "en", "pen"]);
  await db.query(add, [feather, "it", "piuma"]);
  await db.query(add, [feather, "es", "pluma"]);
  await db.query(add, [feather, "en", "feather"]);
  await assert.rejects(db.query(add, [writing, "fr", "plume"]));

  const dictionary = await rowsAs<DictionaryRow>(
    db,
    "anon",
    "select sense_number, definition_it, language, gloss from published_dictionary order by sense_number, language, gloss",
  );
  assert.deepEqual(dictionary, [
    { sense_number: 1, definition_it: "strumento per scrivere", language: "en", gloss: "pen" },
    { sense_number: 1, definition_it: "strumento per scrivere", language: "es", gloss: "pluma" },
    { sense_number: 1, definition_it: "strumento per scrivere", language: "it", gloss: "penna" },
    { sense_number: 1, definition_it: "strumento per scrivere", language: "it", gloss: "stilografica" },
    { sense_number: 2, definition_it: "piuma di uccello", language: "en", gloss: "feather" },
    { sense_number: 2, definition_it: "piuma di uccello", language: "es", gloss: "pluma" },
    { sense_number: 2, definition_it: "piuma di uccello", language: "it", gloss: "piuma" },
    { sense_number: 3, definition_it: null, language: null, gloss: null },
  ]);
});

test("translations of an unpublished sense stay hidden", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "pénna", "approved", []);
  const sense: number = await seedSense(db, lemmaId, "pending", null);
  await db.query("insert into glosses (sense_id, language, gloss, status) values ($1, 'en', 'pen', 'approved')", [sense]);
  assert.equal((await rowsAs(db, "anon", "select id from glosses")).length, 0);
  assert.equal((await rowsAs(db, "anon", "select gloss from published_dictionary")).length, 0);

  await db.query("update senses set status = 'approved'");
  assert.equal((await rowsAs(db, "anon", "select id from glosses")).length, 1);
});

test("a lemma without senses is still a published spelling", async () => {
  const db = await createSeededDatabase();
  await seedEntry(db, "cà", "approved", []);
  assert.deepEqual(await publishedForms(db), ["cà"]);
  assert.equal((await rowsAs(db, "anon", "select headword from published_dictionary")).length, 0);
});

test("nothing can be attached to a deleted lemma or sense, or moved to another", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "cà", "approved", []);
  const otherId: number = await seedEntry(db, "pénna", "approved", []);
  const sense: number = await seedSense(db, lemmaId, "approved", null);

  /* Moving a sense to another lemma is silently ignored. */
  await db.query("update senses set lemma_id = $1", [otherId]);
  const moved = (await db.query<{ lemma_id: number }>("select lemma_id from senses")).rows;
  assert.equal(moved[0]?.lemma_id, lemmaId);

  await db.query("update senses set deleted_at = now()");
  await assert.rejects(
    rowsAs(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'en', 'house')", [sense]),
    /deleted/,
  );

  await db.query("update lemmas set deleted_at = now() where id = $1", [lemmaId]);
  await assert.rejects(
    rowsAs(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'càe')", [lemmaId]),
    /deleted/,
  );
  await assert.rejects(rowsAs(db, contributor, "insert into senses (lemma_id) values ($1)", [lemmaId]), /deleted/);
});

/* ====================================================================
   Integrity: versions, deletion, history, spelling
   ==================================================================== */

test("optimistic locking: a stale version updates nothing", async () => {
  const db = await createSeededDatabase();
  await seedEntry(db, "ca", "pending", []);
  const sql: string = "update lemmas set headword = $1 where version = $2";
  assert.equal(await affectedAs(db, reviewer, sql, ["cà", 1]), 1);
  assert.equal(await affectedAs(db, admin, sql, ["càa", 1]), 0);
  const rows = (await db.query<LemmaRow>("select version from lemmas")).rows;
  assert.equal(rows[0]?.version, 2);
});

test("only admins soft delete and restore, and history records it all", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "cà", "approved", []);

  await assert.rejects(affectedAs(db, reviewer, "update lemmas set deleted_at = now()"), /only admins/);
  assert.equal(await affectedAs(db, admin, "update lemmas set deleted_at = now()"), 1);
  assert.deepEqual(await publishedForms(db), []);
  assert.equal(await affectedAs(db, admin, "update lemmas set deleted_at = null"), 1);
  assert.deepEqual(await publishedForms(db), ["cà"]);

  const history = await rowsAs<AuditRow>(
    db,
    reviewer,
    "select action, actor from audit_log where table_name = 'lemmas' and row_id = $1 order by id",
    [lemmaId],
  );
  assert.deepEqual(history, [
    { action: "insert", actor: null },
    { action: "soft_delete", actor: USERS.admin },
    { action: "restore", actor: USERS.admin },
  ]);
});

test("hard deletes are refused, even for the trusted backend", async () => {
  const db = await createSeededDatabase();
  await seedEntry(db, "cà", "approved", []);
  await assert.rejects(rowsAs(db, admin, "delete from wordforms"));
  await assert.rejects(db.query("delete from wordforms"), /hard deletes are disabled/);
  await assert.rejects(db.query("delete from lemmas"), /hard deletes are disabled/);
});

test("the history is append only and hidden from non staff", async () => {
  const db = await createSeededDatabase();
  await seedEntry(db, "cà", "approved", []);
  assert.equal((await rowsAs(db, contributor, "select id from audit_log")).length, 0);
  const tables = await rowsAs<{ table_name: string }>(db, reviewer, "select table_name from audit_log order by id");
  assert.deepEqual(tables.map((r) => r.table_name), ["lemmas", "wordforms"]);
  await assert.rejects(db.query("update audit_log set actor = null"), /append only/);
  await assert.rejects(db.query("delete from audit_log"), /append only/);
});

test("forms must be valid NFC Ligurian spellings, unique per lemma", async () => {
  const db = await createSeededDatabase();
  const lemmaId: number = await seedEntry(db, "cà", "approved", ["càe"]);
  await assert.rejects(db.query("insert into wordforms (lemma_id, form) values ($1, 'ca2')", [lemmaId]));
  await assert.rejects(db.query("insert into wordforms (lemma_id, form) values ($1, $2)", [lemmaId, "càe"]));
  await assert.rejects(db.query("insert into wordforms (lemma_id, form) values ($1, 'càe')", [lemmaId]));
  await assert.rejects(db.query("insert into wordforms (lemma_id, form) values ($1, 'cà')", [lemmaId]));

  /* After a soft delete the same spelling may be entered again. */
  await db.query("update wordforms set deleted_at = now() where form = 'càe'");
  await db.query("insert into wordforms (lemma_id, form) values ($1, 'càe')", [lemmaId]);
});

/* ====================================================================
   Export
   ==================================================================== */

test("the export is read by the engine: published forms only, homographs once", async () => {
  const db = await createSeededDatabase();
  await seedEntry(db, "Zêna", "approved", []);
  await seedEntry(db, "pénna", "approved", ["pénne"]);
  await seedEntry(db, "pénn-a", "approved", []);
  await db.query("insert into lemmas (headword, part_of_speech, status) values ('pénna', 'verb', 'approved')");
  await db.query("update wordforms set freq = 7 where is_base and lemma_id = (select id from lemmas where part_of_speech = 'verb')");
  await seedEntry(db, "cà", "pending", []);
  await seedEntry(db, "lalla", "rejected", []);
  const deletedId: number = await seedEntry(db, "méiga", "approved", []);
  await db.query("update lemmas set deleted_at = now() where id = $1", [deletedId]);

  const rows = await rowsAs<{ tsv: string }>(db, "anon", "select export_lexicon_tsv() as tsv");
  const lexicon: Lexicon = Lexicon.fromTsv(rows[0]?.tsv ?? "");

  assert.deepEqual(lexicon.errors, []);
  assert.equal(lexicon.size, 4);
  assert.deepEqual(lexicon.lookup("penna").map((e) => [e.form, e.freq]), [["pénna", 7], ["pénn-a", 1]]);
  assert.equal(lexicon.lookup("zena")[0]?.form, "Zêna");
  assert.equal(lexicon.lookup("ca").length, 0);
  assert.equal(lexicon.lookup("meiga").length, 0);
});
