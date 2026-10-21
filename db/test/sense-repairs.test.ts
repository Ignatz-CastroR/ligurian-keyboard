/*
 * sense-repairs.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 23:49:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Updated:  2026/10/21, 10:57:43: a piece repeated across translations
 *           counted once in both runs of the split; every kind of space
 *           trimmed.
 * Updated:  2026/10/21, 09:30:23: the list of lemmas frozen when 0012
 *           runs; the lemma's own version in what was seen; a change made
 *           meanwhile always a conflict; the best reviewed duplicate kept;
 *           temporary numbers above every number in use; a lemma with no
 *           sense left; the split of a lemma on the list; one test for
 *           each rule an independent review found untested.
 * Purpose:  Prove migration 0012: the five entries a speaker grouped by
 *           hand come out exactly as he grouped them; the list holds the
 *           lemmas split when the migration ran, and no later edit adds
 *           or drops one; the queue lists them fewest senses first, in
 *           pages without gap or repeat; a regrouping applies whole or
 *           not at all, refuses a stale view or a grouping that loses or
 *           repeats a translation, keeps every sense it can, numbers the
 *           rest without collision, merges duplicates and writes its
 *           history; only staff may review, and a reviewer still cannot
 *           soft delete outside a regrouping, nor restore inside one;
 *           translations holding ";" split after a dry run; backups keep
 *           the list and the review dates.
 * Contract: Every test builds its own database. A rule is tested from
 *           the side of the person who must NOT be able to break it.
 *           Entries are written as the SQL loads wrote them: by the
 *           trusted backend, approved, one sense per translation; then
 *           put on the list by mark_split_lemmas[], as the migration does.
 * Decision: docs/decisions/0038-senses-reviewed-one-by-one.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import {
  USERS, actAs, affectedAs, asUser, createSeededDatabase, migrationNames, rowsAs, runMigration, type Identity,
} from "./harness.ts";

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);
const member = asUser(USERS.member);

interface Loaded { lemma: number; senses: number[]; glosses: number[] }
interface IdVersion { id: number; version: number }
interface Seen { lemma: IdVersion; senses: IdVersion[]; glosses: IdVersion[] }
interface Group { glosses: number[]; definition_it?: string | null }
interface Report {
  kept: number;
  created: number;
  deleted: number;
  moved: number;
  merged_duplicates: number;
  renumbered: number;
  definitions: number;
  changed: boolean;
  senses_reviewed_at: string;
}
interface SenseShape { n: number; definition: string | null; status: string; glosses: string[] }
interface QueueRow {
  lemma_id: number;
  public_id: string;
  headword: string;
  headword_key: string;
  part_of_speech: string | null;
  status: string;
  senses: number;
  queue_position: number | string;
  total: number | string;
  translations: { sense_number: number; language: string; gloss: string }[];
}

/* An entry as the SQL loads left it: one sense per translation, every
   row approved, no author. A translation is "it:stecco"; the language
   defaults to Italian. */
async function loaded(db: PGlite, headword: string, translations: string[], status: string = "approved"): Promise<Loaded> {
  await actAs(db, "trusted");
  const lemma: number = (await db.query<{ id: number }>(
    "insert into lemmas (headword, status) values ($1, $2) returning id", [headword, status])).rows[0]?.id ?? -1;
  const senses: number[] = [];
  const glosses: number[] = [];
  for (const translation of translations) {
    const [language, text] = translation.includes(":") ? translation.split(":") : ["it", translation];
    const sense: number = (await db.query<{ id: number }>(
      "insert into senses (lemma_id, status) values ($1, $2) returning id", [lemma, status])).rows[0]?.id ?? -1;
    const gloss: number = (await db.query<{ id: number }>(
      "insert into glosses (sense_id, language, gloss, status) values ($1, $2, $3, $4) returning id",
      [sense, language, text, status])).rows[0]?.id ?? -1;
    senses.push(sense);
    glosses.push(gloss);
  }
  return { lemma, senses, glosses };
}

// Put the split lemmas on the list, as migration 0012 does.
async function markSplit(db: PGlite): Promise<number> {
  await actAs(db, "trusted");
  return (await db.query<{ n: number }>("select private.mark_split_lemmas() as n")).rows[0]?.n ?? -1;
}

// The lemma and every live sense and translation at its current version.
async function seenOf(db: PGlite, lemma: number): Promise<Seen> {
  await actAs(db, "trusted");
  const head = (await db.query<IdVersion>("select id, version from lemmas where id = $1", [lemma])).rows[0];
  const senses = (await db.query<IdVersion>(
    "select id, version from senses where lemma_id = $1 and deleted_at is null order by id", [lemma])).rows;
  const glosses = (await db.query<IdVersion>(
    `select g.id, g.version from glosses as g join senses as s on s.id = g.sense_id
      where s.lemma_id = $1 and s.deleted_at is null and g.deleted_at is null order by g.id`, [lemma])).rows;
  return { lemma: head ?? { id: lemma, version: 0 }, senses, glosses };
}

async function regroup(db: PGlite, who: Identity, lemma: number, seen: unknown, groups: unknown): Promise<Report> {
  const rows = await rowsAs<{ report: Report }>(db, who,
    "select public.regroup_senses($1, $2::jsonb, $3::jsonb) as report",
    [lemma, JSON.stringify(seen), JSON.stringify(groups)]);
  const report: Report | undefined = rows[0]?.report;
  assert.ok(report !== undefined);
  return report;
}

// Groups written by translation text, as a reviewer sees them.
async function groupsOf(db: PGlite, lemma: number, byText: string[][], definitions: (string | null)[] = []): Promise<Group[]> {
  await actAs(db, "trusted");
  const rows = (await db.query<{ id: number; gloss: string }>(
    `select g.id, g.gloss from glosses as g join senses as s on s.id = g.sense_id
      where s.lemma_id = $1 and s.deleted_at is null and g.deleted_at is null`, [lemma])).rows;
  return byText.map((texts, i) => {
    const group: Group = {
      glosses: texts.map((text) => {
        const found = rows.filter((r) => r.gloss === text);
        assert.equal(found.length, 1, `one live translation "${text}"`);
        return found[0]?.id ?? -1;
      }),
    };
    if (i < definitions.length) {
      group.definition_it = definitions[i] ?? null;
    }
    return group;
  });
}

// The live senses of a lemma, in order, each with its translations.
async function shapeOf(db: PGlite, lemma: number): Promise<SenseShape[]> {
  await actAs(db, "trusted");
  const rows = (await db.query<{ n: number; definition: string | null; status: string; glosses: string[] }>(
    `select s.sense_number as n, s.definition_it as definition, s.status::text as status,
            coalesce(array_agg(g.language || ':' || g.gloss order by g.id) filter (where g.id is not null), '{}') as glosses
       from senses as s
       left join glosses as g on g.sense_id = s.id and g.deleted_at is null
      where s.lemma_id = $1 and s.deleted_at is null
      group by s.id order by s.sense_number`, [lemma])).rows;
  return rows.map((r) => ({ n: r.n, definition: r.definition, status: r.status, glosses: r.glosses }));
}

async function liveSenseIds(db: PGlite, lemma: number): Promise<number[]> {
  await actAs(db, "trusted");
  return (await db.query<{ id: number }>(
    "select id from senses where lemma_id = $1 and deleted_at is null order by sense_number", [lemma])).rows.map((r) => r.id);
}

async function reviewedAt(db: PGlite, lemma: number): Promise<string | null> {
  await actAs(db, "trusted");
  return (await db.query<{ at: string | null }>(
    "select senses_reviewed_at::text as at from lemmas where id = $1", [lemma])).rows[0]?.at ?? null;
}

async function onList(db: PGlite, lemma: number): Promise<boolean> {
  await actAs(db, "trusted");
  return (await db.query<{ needed: boolean }>(
    "select senses_review_needed as needed from lemmas where id = $1", [lemma])).rows[0]?.needed ?? false;
}

async function queue(db: PGlite, who: Identity, after: QueueRow | null = null, limit: number = 50): Promise<QueueRow[]> {
  return rowsAs<QueueRow>(db, who, "select * from public.sense_review_queue($1, $2, $3, $4)",
    [after?.senses ?? null, after?.headword_key ?? null, after?.lemma_id ?? null, limit]);
}

const queuedIds = async (db: PGlite): Promise<number[]> => (await queue(db, reviewer)).map((r) => r.lemma_id);

// A database error with this SQLSTATE.
const hasCode = (code: string) => (thrown: unknown): boolean => (thrown as { code?: string }).code === code;

/* A session of the database's owner, above row level security, that
   the triggers nevertheless take for this person: it proves a trigger's
   rule on its own, where a policy would otherwise stop the change first. */
async function asOwnerClaiming(db: PGlite, user: string): Promise<void> {
  await actAs(db, "trusted");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: user, role: "authenticated" })]);
}

const sense = (n: number, glosses: string[], status: string = "approved", definition: string | null = null): SenseShape =>
  ({ n, definition, status, glosses });

/* ====================================================================
   The migration and the five entries of the decision
   ==================================================================== */

test("migration 0012 runs after 0011", () => {
  const names: string[] = migrationNames();
  assert.equal(names[names.indexOf("0011_site_sections.sql") + 1], "0012_sense_repairs.sql");
});

test("the migration lists exactly the lemmas split that day, each with a version raised and a line of history", async () => {
  const db = await createSeededDatabase("0011_site_sections.sql");
  const split = await loaded(db, "béllo", ["bello", "carino"]);
  const one = await loaded(db, "sôlo", ["solo"]);
  const defined = await loaded(db, "defî", ["definire", "stabilire"]);
  await affectedAs(db, "trusted", "update senses set definition_it = 'una' where id = $1", [defined.senses[0]]);
  const gone = await loaded(db, "andæto", ["andato", "partito"]);
  await affectedAs(db, "trusted", "update lemmas set deleted_at = now() where id = $1", [gone.lemma]);
  const before = (await rowsAs<{ id: number; version: number }>(db, "trusted", "select id, version from lemmas order by id"));
  const history: number = Number((await rowsAs<{ n: string }>(db, "trusted", "select count(*) as n from audit_log"))[0]?.n);

  await runMigration(db, "0012_sense_repairs.sql");
  for (const entry of [split, one, defined, gone]) {
    assert.equal(await onList(db, entry.lemma), entry === split, `lemma ${entry.lemma}`);
  }
  const after = (await rowsAs<{ id: number; version: number }>(db, "trusted", "select id, version from lemmas order by id"));
  assert.deepEqual(after.map((r) => r.version - (before.find((b) => b.id === r.id)?.version ?? 0)),
    after.map((r) => (r.id === split.lemma ? 1 : 0)));
  const lines = await rowsAs<{ table_name: string; row_id: number; action: string }>(db, "trusted",
    "select table_name, row_id, action from audit_log order by id offset $1", [history]);
  assert.deepEqual(lines, [{ table_name: "lemmas", row_id: split.lemma, action: "update" }]);
  assert.deepEqual(await queuedIds(db), [split.lemma]);
});

test("the five entries a speaker grouped by hand come out exactly as he grouped them", async () => {
  const db = await createSeededDatabase();
  const stecco = await loaded(db, "stécco", ["stecco", "stecchino", "stuzzicadenti"]);
  const sacrifica = await loaded(db, "sacrificâ", ["sacrificare", "immolare"]);
  const sacheza = await loaded(db, "sachezâ", ["razziare", "saccheggiare"]);
  const sachezzo = await loaded(db, "sachézzo", ["razzia", "scorreria", "saccheggio", "sacco"]);
  const gabibbo = await loaded(db, "gabìbbo", ["gabibbo", "meridionale", "terrone"]);
  assert.equal(await markSplit(db), 5);
  assert.equal((await queue(db, reviewer)).length, 5);

  // stécco: [stecco] [stecchino, stuzzicadenti]
  let report: Report = await regroup(db, reviewer, stecco.lemma, await seenOf(db, stecco.lemma),
    await groupsOf(db, stecco.lemma, [["stecco"], ["stecchino", "stuzzicadenti"]]));
  assert.deepEqual(await shapeOf(db, stecco.lemma), [
    sense(1, ["it:stecco"]), sense(2, ["it:stecchino", "it:stuzzicadenti"])]);
  assert.equal((await liveSenseIds(db, stecco.lemma))[0], stecco.senses[0], "sense 1 is kept, not recreated");
  assert.deepEqual([report.kept, report.created, report.deleted, report.moved, report.renumbered, report.changed],
    [1, 1, 2, 2, 0, true]);

  // sacrificâ: two senses as they are, each now with its definition.
  report = await regroup(db, reviewer, sacrifica.lemma, await seenOf(db, sacrifica.lemma),
    await groupsOf(db, sacrifica.lemma, [["sacrificare"], ["immolare"]], ["definizione di prova 1", "definizione di prova 2"]));
  assert.deepEqual(await shapeOf(db, sacrifica.lemma), [
    sense(1, ["it:sacrificare"], "approved", "definizione di prova 1"),
    sense(2, ["it:immolare"], "approved", "definizione di prova 2")]);
  assert.deepEqual(await liveSenseIds(db, sacrifica.lemma), sacrifica.senses);
  assert.deepEqual([report.kept, report.created, report.deleted, report.definitions, report.changed], [2, 0, 0, 2, true]);

  // sachezâ: right as it is; reviewed, nothing changed.
  report = await regroup(db, reviewer, sacheza.lemma, await seenOf(db, sacheza.lemma),
    await groupsOf(db, sacheza.lemma, [["razziare"], ["saccheggiare"]]));
  assert.deepEqual(await liveSenseIds(db, sacheza.lemma), sacheza.senses);
  assert.deepEqual([report.kept, report.created, report.deleted, report.changed], [2, 0, 0, false]);

  // sachézzo: [razzia, scorreria] [saccheggio] [sacco]; the last two kept
  // and renumbered from 3 and 4 to 2 and 3.
  report = await regroup(db, reviewer, sachezzo.lemma, await seenOf(db, sachezzo.lemma),
    await groupsOf(db, sachezzo.lemma, [["razzia", "scorreria"], ["saccheggio"], ["sacco"]]));
  assert.deepEqual(await shapeOf(db, sachezzo.lemma), [
    sense(1, ["it:razzia", "it:scorreria"]), sense(2, ["it:saccheggio"]), sense(3, ["it:sacco"])]);
  assert.deepEqual((await liveSenseIds(db, sachezzo.lemma)).slice(1), sachezzo.senses.slice(2));
  assert.deepEqual([report.kept, report.created, report.deleted, report.moved, report.renumbered], [2, 1, 2, 2, 2]);

  // gabìbbo: one sense.
  report = await regroup(db, reviewer, gabibbo.lemma, await seenOf(db, gabibbo.lemma),
    await groupsOf(db, gabibbo.lemma, [["gabibbo", "meridionale", "terrone"]]));
  assert.deepEqual(await shapeOf(db, gabibbo.lemma), [sense(1, ["it:gabibbo", "it:meridionale", "it:terrone"])]);
  assert.deepEqual([report.kept, report.created, report.deleted, report.moved], [0, 1, 3, 3]);

  for (const entry of [stecco, sacrifica, sacheza, sachezzo, gabibbo]) {
    assert.ok(await reviewedAt(db, entry.lemma) !== null, "marked reviewed");
  }
  assert.deepEqual(await queue(db, reviewer), [], "the queue is empty");

  // Every lemma counts 1, 2, 3, with no temporary number left.
  await actAs(db, "trusted");
  const numbers = (await db.query<{ lemma_id: number; numbers: number[] }>(
    `select lemma_id, array_agg(sense_number order by sense_number) as numbers
       from senses where deleted_at is null group by lemma_id`)).rows;
  for (const row of numbers) {
    assert.deepEqual(row.numbers, row.numbers.map((_, i) => i + 1));
  }
});

/* ====================================================================
   The list and the queue
   ==================================================================== */

test("the list is frozen: edits never drop a lemma from it, and new entries of the same shape never join it", async () => {
  const db = await createSeededDatabase();
  const added = await loaded(db, "béllo", ["bello", "carino"]);
  const defined = await loaded(db, "defî", ["definire", "stabilire"]);
  const rejected = await loaded(db, "dôppio", ["doppio", "duplice"]);
  const corrected = await loaded(db, "sôlo", ["solo", "unico"]);
  await markSplit(db);

  // A contributor's pending translation, a definition, a rejected
  // translation, a correction made from the entry page: none drops one.
  await affectedAs(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'es', 'bonito')", [added.senses[0]]);
  await affectedAs(db, reviewer, "update senses set definition_it = 'una definizione' where id = $1", [defined.senses[0]]);
  await affectedAs(db, reviewer, "insert into glosses (sense_id, language, gloss, status) values ($1, 'en', 'double', 'rejected')",
    [rejected.senses[0]]);
  await affectedAs(db, reviewer, "update glosses set language = 'es', gloss = 'único' where id = $1", [corrected.glosses[1]]);
  // A new entry split the same way, by a contributor or a later load.
  const later = await loaded(db, "nêuvo", ["nuovo", "recente"]);
  const own = (await rowsAs<{ id: number }>(db, contributor, "insert into lemmas (headword) values ('mæ') returning id"))[0]?.id;
  for (const text of ["mio", "mia"]) {
    const s = (await rowsAs<{ id: number }>(db, contributor, "insert into senses (lemma_id) values ($1) returning id", [own]))[0]?.id;
    await affectedAs(db, contributor, "insert into glosses (sense_id, language, gloss) values ($1, 'it', $2)", [s, text]);
  }

  assert.deepEqual((await queuedIds(db)).sort((a, b) => a - b),
    [added.lemma, defined.lemma, rejected.lemma, corrected.lemma].sort((a, b) => a - b));
  assert.equal(await onList(db, later.lemma), false);
  assert.equal(await onList(db, own ?? -1), false);

  // Only the trusted backend changes the list: no client, an admin
  // included, may put a lemma on it or take one off.
  for (const who of [admin, reviewer]) {
    await assert.rejects(affectedAs(db, who, "update lemmas set senses_review_needed = true where id = $1", [later.lemma]),
      /only the trusted backend may change/);
    await assert.rejects(affectedAs(db, who, "update lemmas set senses_review_needed = false where id = $1", [added.lemma]),
      /only the trusted backend may change/);
  }
  // A contributor reaches only their own pending lemma.
  await assert.rejects(affectedAs(db, contributor, "update lemmas set senses_review_needed = true where id = $1", [own]),
    /only the trusted backend may change/);
  const inserted = (await rowsAs<{ needed: boolean }>(db, admin,
    "insert into lemmas (headword, senses_review_needed) values ('nêuva', true) returning senses_review_needed as needed"))[0];
  assert.equal(inserted?.needed, false, "a client's insert has it cleared");
});

test("the queue lists the lemmas on the list not yet reviewed, fewest senses first, then by search key", async () => {
  const db = await createSeededDatabase();
  const three = await loaded(db, "àbaco", ["a", "b", "c"]);
  const twoB = await loaded(db, "béllo", ["bello", "carino"]);
  const twoA = await loaded(db, "Abàte", ["abate", "priore"]);
  await loaded(db, "sôlo", ["solo"]);
  const reviewed = await loaded(db, "vìsto", ["visto", "veduto"]);
  const gone = await loaded(db, "andæto", ["andato", "partito"]);
  await markSplit(db);
  await affectedAs(db, reviewer, "update lemmas set senses_reviewed_at = now() where id = $1", [reviewed.lemma]);
  await affectedAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [gone.lemma]);

  const rows: QueueRow[] = await queue(db, reviewer);
  assert.deepEqual(rows.map((r) => [r.headword, r.senses]), [["Abàte", 2], ["béllo", 2], ["àbaco", 3]]);
  assert.deepEqual(rows.map((r) => Number(r.queue_position)), [1, 2, 3]);
  assert.ok(rows.every((r) => Number(r.total) === 3));
  assert.deepEqual(rows[0]?.translations, [
    { sense_number: 1, language: "it", gloss: "abate" }, { sense_number: 2, language: "it", gloss: "priore" }]);
  assert.deepEqual(rows.map((r) => r.lemma_id), [twoA.lemma, twoB.lemma, three.lemma]);
  assert.match(rows[0]?.public_id ?? "", /^LIJ-/u);

  // The same queue, a lemma a page, without gap or repeat.
  const walked: number[] = [];
  let after: QueueRow | null = null;
  for (let i: number = 0; i < 5; i += 1) {
    const page: QueueRow[] = await queue(db, reviewer, after, 1);
    if (page.length > 0) {
      walked.push(page[0]?.lemma_id ?? -1);
      after = page[0] ?? null;
    }
  }
  assert.deepEqual(walked, rows.map((r) => r.lemma_id));

  // A reviewed lemma leaves; the next page after it still follows on.
  await regroup(db, reviewer, twoB.lemma, await seenOf(db, twoB.lemma), await groupsOf(db, twoB.lemma, [["bello", "carino"]]));
  const next: QueueRow[] = await queue(db, reviewer, rows[1] ?? null, 50);
  assert.deepEqual(next.map((r) => r.lemma_id), [three.lemma]);
  assert.equal(Number(next[0]?.total), 2);
  assert.equal(Number(next[0]?.queue_position), 2);

  // Clearing the review date sends a lemma on the list back.
  await affectedAs(db, reviewer, "update lemmas set senses_reviewed_at = null where id = $1", [twoB.lemma]);
  assert.ok((await queuedIds(db)).includes(twoB.lemma));
});

test("only reviewers, admins and the trusted backend may read the queue or regroup; a token without a user is refused", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  await markSplit(db);
  for (const who of [contributor, member]) {
    await assert.rejects(queue(db, who), /only reviewers and admins/);
    await assert.rejects(regroup(db, who, entry.lemma, await seenOf(db, entry.lemma),
      await groupsOf(db, entry.lemma, [["bello", "carino"]])), /only reviewers and admins/);
  }
  await assert.rejects(queue(db, "anon"), /permission denied/);
  await assert.rejects(rowsAs(db, "anon", "select public.regroup_senses(1, '{}', '[]')"), /permission denied/);

  // A client token with no user: never taken for the trusted backend.
  const noUser = async (sql: string, params: unknown[] = []): Promise<unknown> => {
    await actAs(db, "trusted");
    await db.query("select set_config('request.jwt.claims', '{\"role\": \"authenticated\"}', false)");
    await db.exec("set role authenticated;");
    try {
      return await db.query(sql, params);
    } finally {
      await actAs(db, "trusted");
    }
  };
  await assert.rejects(noUser("select * from public.sense_review_queue()"), /only reviewers and admins/);
  await assert.rejects(noUser("select public.regroup_senses($1, $2::jsonb, $3::jsonb)",
    [entry.lemma, JSON.stringify(await seenOf(db, entry.lemma)), JSON.stringify([{ glosses: entry.glosses }])]),
  /only reviewers and admins/);
  await assert.rejects(noUser("select public.split_semicolon_glosses(false)"), /only admins/);

  assert.equal((await queue(db, admin)).length, 1);
  assert.equal((await queue(db, "trusted")).length, 1);
  assert.deepEqual(await shapeOf(db, entry.lemma), [sense(1, ["it:bello"]), sense(2, ["it:carino"])], "nothing changed");
  await regroup(db, "trusted", entry.lemma, await seenOf(db, entry.lemma), await groupsOf(db, entry.lemma, [["bello", "carino"]]));
  assert.deepEqual(await shapeOf(db, entry.lemma), [sense(1, ["it:bello", "it:carino"])]);
});

/* ====================================================================
   The regrouping flag
   ==================================================================== */

test("a reviewer may soft delete only senses and translations, only inside a regrouping, and never restore", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  await markSplit(db);
  const form = (await rowsAs<{ id: number }>(db, "trusted",
    "insert into wordforms (lemma_id, form, status) values ($1, 'bélli', 'approved') returning id", [entry.lemma]))[0]?.id;
  await assert.rejects(affectedAs(db, reviewer, "update senses set deleted_at = now() where id = $1", [entry.senses[0]]),
    /only admins may delete or restore/);
  await assert.rejects(affectedAs(db, reviewer, "update glosses set deleted_at = now() where id = $1", [entry.glosses[0]]),
    /only admins may delete or restore/);

  // Under the flag [no API request can set it; these sessions set it by
  // SQL to prove the rule]: still no lemma, no form, no restore.
  await actAs(db, reviewer);
  await db.query("select set_config('ligurian.regrouping', 'on', false)");
  try {
    await assert.rejects(db.query("update lemmas set deleted_at = now() where id = $1", [entry.lemma]), /only admins may delete/);
    await assert.rejects(db.query("update wordforms set deleted_at = now() where id = $1", [form]), /only admins may delete/);
  } finally {
    await actAs(db, "trusted");
    await db.query("select set_config('ligurian.regrouping', 'off', false)");
  }

  // A restore, proved against the trigger itself: above row level
  // security, which would otherwise hide a deleted row from a reviewer.
  await affectedAs(db, "trusted", "update senses set deleted_at = now() where id = $1", [entry.senses[1]]);
  await asOwnerClaiming(db, USERS.reviewer);
  await db.query("select set_config('ligurian.regrouping', 'on', false)");
  try {
    await assert.rejects(db.query("update senses set deleted_at = null where id = $1", [entry.senses[1]]),
      /only admins may delete or restore/);
    // The flag counts only for staff: a contributor holding it is not
    // regrouping, whatever their role's own rule says.
    await db.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: USERS.contributor, role: "authenticated" })]);
    assert.deepEqual((await db.query<{ on: boolean }>("select private.regrouping() as on")).rows, [{ on: false }]);
    await db.query("select set_config('request.jwt.claims', $1, false)",
      [JSON.stringify({ sub: USERS.reviewer, role: "authenticated" })]);
    assert.deepEqual((await db.query<{ on: boolean }>("select private.regrouping() as on")).rows, [{ on: true }]);
  } finally {
    await actAs(db, "trusted");
    await db.query("select set_config('ligurian.regrouping', 'off', false)");
  }
});

test("the flag is off again as soon as a regrouping returns, within the same transaction", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  const other = await loaded(db, "brutto", ["brutto", "laido"]);
  await markSplit(db);
  const seen: Seen = await seenOf(db, entry.lemma);
  await actAs(db, reviewer);
  await db.exec("begin");
  try {
    await db.query("select public.regroup_senses($1, $2::jsonb, $3::jsonb)",
      [entry.lemma, JSON.stringify(seen), JSON.stringify([{ glosses: entry.glosses }])]);
    await assert.rejects(db.query("update senses set deleted_at = now() where id = $1", [other.senses[0]]),
      /only admins may delete or restore/);
  } finally {
    await db.exec("rollback");
    await actAs(db, "trusted");
  }
});

/* ====================================================================
   A regrouping: whole or not at all
   ==================================================================== */

test("a view that is out of date changes nothing, and is always reported as a conflict", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino", "grazioso"]);
  await markSplit(db);
  const seen: Seen = await seenOf(db, entry.lemma);
  const groups: Group[] = await groupsOf(db, entry.lemma, [["bello", "carino", "grazioso"]]);
  const before: SenseShape[] = await shapeOf(db, entry.lemma);

  // A translation edited, a sense missing from what was seen, a
  // translation added, a translation deleted: each refused whole, 40001.
  await affectedAs(db, reviewer, "update glosses set status = 'approved' where id = $1", [entry.glosses[1]]);
  await assert.rejects(regroup(db, reviewer, entry.lemma, seen, groups), hasCode("40001"));
  let fresh: Seen = await seenOf(db, entry.lemma);
  await assert.rejects(regroup(db, reviewer, entry.lemma, { ...fresh, senses: fresh.senses.slice(1) }, groups), hasCode("40001"));
  await affectedAs(db, reviewer, "insert into glosses (sense_id, language, gloss) values ($1, 'en', 'nice')", [entry.senses[2]]);
  await assert.rejects(regroup(db, reviewer, entry.lemma, fresh, groups), hasCode("40001"));
  fresh = await seenOf(db, entry.lemma);
  await affectedAs(db, admin, "update glosses set deleted_at = now() where id = $1", [entry.glosses[2]]);
  await assert.rejects(regroup(db, reviewer, entry.lemma, fresh, [{ glosses: fresh.glosses.map((g) => g.id) }]), hasCode("40001"),
    "a sense left with no translation by someone else is a conflict, not an invalid request");

  const after: SenseShape[] = await shapeOf(db, entry.lemma);
  assert.deepEqual(after.map((s) => s.n), before.map((s) => s.n));
  assert.equal(await reviewedAt(db, entry.lemma), null, "not marked reviewed");
});

test("two reviewers on the same lemma: the second, working from the same page, is refused even after a \"leave as it is\"", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  await markSplit(db);
  const seen: Seen = await seenOf(db, entry.lemma);
  const keep: Report = await regroup(db, reviewer, entry.lemma, seen,
    await groupsOf(db, entry.lemma, [["bello"], ["carino"]]));
  assert.equal(keep.changed, false);
  await assert.rejects(regroup(db, admin, entry.lemma, seen, [{ glosses: entry.glosses }]), hasCode("40001"));
  assert.deepEqual(await shapeOf(db, entry.lemma), [sense(1, ["it:bello"]), sense(2, ["it:carino"])]);
});

test("a grouping that loses, repeats or borrows a translation, or is malformed, is refused", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino", "grazioso"]);
  const other = await loaded(db, "brutto", ["brutto", "laido"]);
  await markSplit(db);
  const seen: Seen = await seenOf(db, entry.lemma);
  const [a, b, c] = entry.glosses;
  const invalid = hasCode("22023");
  const wrong: unknown[] = [
    [{ glosses: [a, b] }],                                  // c lost
    [{ glosses: [a, b, c] }, { glosses: [c] }],             // c twice
    [{ glosses: [a, b, c, other.glosses[0]] }],             // another lemma's
    [{ glosses: [a, b, c] }, { glosses: [] }],              // an empty group
    [],                                                      // no group, translations left
    [{ glosses: [a, b, c], definition: "x" }],              // unknown key
    [{ glosses: [a, b, c], definition_it: 7 }],             // not a text
    [{ glosses: [a, b, `${c}`] }],                          // an id as text
    [{ glosses: [a, b, c], definition_it: "x".repeat(1001) }],
    Array.from({ length: 101 }, () => ({ glosses: [a] })),
    { glosses: [a, b, c] },                                 // not an array
  ];
  for (const groups of wrong) {
    await assert.rejects(regroup(db, reviewer, entry.lemma, seen, groups), invalid, JSON.stringify(groups).slice(0, 60));
  }
  const badSeen: unknown[] = [
    {},
    { senses: seen.senses, glosses: seen.glosses },                                  // no lemma
    { ...seen, lemma: { id: other.lemma, version: 1 } },                             // another lemma
    { ...seen, extra: [] },                                                          // unknown key
    { ...seen, senses: [...seen.senses, seen.senses[0]] },                           // a sense twice
    { ...seen, glosses: [{ id: "1", version: 1 }] },                                 // an id as text
    [],
  ];
  for (const bad of badSeen) {
    await assert.rejects(regroup(db, reviewer, entry.lemma, bad, [{ glosses: [a, b, c] }]), invalid, JSON.stringify(bad).slice(0, 60));
  }

  // A live sense with no translation: refused, it would vanish unseen.
  const bare = await loaded(db, "nûo", ["nudo", "spoglio"]);
  await affectedAs(db, admin, "update glosses set deleted_at = now() where id = $1", [bare.glosses[1]]);
  await assert.rejects(regroup(db, reviewer, bare.lemma, await seenOf(db, bare.lemma), [{ glosses: [bare.glosses[0]] }]),
    /sense 2 of lemma \d+ has no translation/);

  // A deleted or unknown lemma.
  await affectedAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [other.lemma]);
  for (const lemma of [other.lemma, 999999]) {
    await assert.rejects(regroup(db, reviewer, lemma, { lemma: { id: lemma, version: 1 }, senses: [], glosses: [] }, [{ glosses: [1] }]),
      hasCode("P0002"));
  }
  assert.deepEqual((await shapeOf(db, entry.lemma)).map((s) => s.glosses), [["it:bello"], ["it:carino"], ["it:grazioso"]]);
});

test("a lemma on the list with no sense left is reviewed with no group at all", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  await markSplit(db);
  for (const g of entry.glosses) {
    await affectedAs(db, admin, "update glosses set deleted_at = now() where id = $1", [g]);
  }
  for (const s of entry.senses) {
    await affectedAs(db, admin, "update senses set deleted_at = now() where id = $1", [s]);
  }
  assert.deepEqual((await queue(db, reviewer)).map((r) => [r.senses, r.translations]), [[0, []]]);
  const report: Report = await regroup(db, reviewer, entry.lemma, await seenOf(db, entry.lemma), []);
  assert.deepEqual([report.kept, report.created, report.deleted, report.changed], [0, 0, 0, false]);
  assert.deepEqual(await queue(db, reviewer), []);
});

test("duplicates are merged into the best reviewed copy; a new sense is approved only when all its translations came from approved senses", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "stécco", ["stecco", "stecco", "es:palillo", "stecchino", "bastoncino"]);
  await markSplit(db);
  // The first "stecco" rejected, the second approved; "palillo" rejected;
  // "bastoncino" from a pending sense.
  await affectedAs(db, reviewer, "update glosses set status = 'rejected' where id = $1", [entry.glosses[0]]);
  await affectedAs(db, reviewer, "update glosses set status = 'rejected' where id = $1", [entry.glosses[2]]);
  await affectedAs(db, reviewer, "update senses set status = 'pending' where id = $1", [entry.senses[4]]);

  const report: Report = await regroup(db, reviewer, entry.lemma, await seenOf(db, entry.lemma), [
    { glosses: [entry.glosses[0] ?? -1, entry.glosses[1] ?? -1, entry.glosses[2] ?? -1], definition_it: "  bastoncino  " },
    { glosses: [entry.glosses[3] ?? -1, entry.glosses[4] ?? -1], definition_it: "" },
  ]);
  assert.equal(report.merged_duplicates, 1);
  assert.equal(report.moved, 4);
  assert.deepEqual(await shapeOf(db, entry.lemma), [
    sense(1, ["it:stecco", "es:palillo"], "approved", "bastoncino"),
    sense(2, ["it:stecchino", "it:bastoncino"], "pending"),
  ]);
  await actAs(db, "trusted");
  const statuses = (await db.query<{ gloss: string; status: string }>(
    `select g.gloss, g.status::text as status from glosses as g join senses as s on s.id = g.sense_id
      where s.lemma_id = $1 and s.deleted_at is null and g.deleted_at is null order by g.gloss`, [entry.lemma])).rows;
  assert.deepEqual(statuses, [
    { gloss: "bastoncino", status: "approved" }, { gloss: "palillo", status: "rejected" },
    { gloss: "stecchino", status: "approved" }, { gloss: "stecco", status: "approved" }]);
});

test("senses numbered above 100, even where temporary numbers once went, are renumbered without collision", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino", "grazioso"]);
  await markSplit(db);
  await affectedAs(db, "trusted", "update senses set sense_number = 10001 where id = $1", [entry.senses[0]]);
  await affectedAs(db, "trusted", "update senses set sense_number = 10003 where id = $1", [entry.senses[1]]);
  await regroup(db, reviewer, entry.lemma, await seenOf(db, entry.lemma), await groupsOf(db, entry.lemma,
    [["grazioso"], ["carino"], ["bello"]]));
  assert.deepEqual(await shapeOf(db, entry.lemma), [sense(1, ["it:grazioso"]), sense(2, ["it:carino"]), sense(3, ["it:bello"])]);
  assert.deepEqual(await liveSenseIds(db, entry.lemma), [entry.senses[2], entry.senses[1], entry.senses[0]]);
});

test("every change is in the history, credited to the reviewer, the review date by the database's clock", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  await markSplit(db);
  await actAs(db, "trusted");
  const start: number = (await db.query<{ id: number }>("select coalesce(max(id), 0) as id from audit_log")).rows[0]?.id ?? 0;
  const report: Report = await regroup(db, reviewer, entry.lemma, await seenOf(db, entry.lemma),
    await groupsOf(db, entry.lemma, [["bello", "carino"]]));
  await actAs(db, "trusted");
  const lines = (await db.query<{ table_name: string; action: string; actor: string | null }>(
    "select table_name, action, actor from audit_log where id > $1 order by id", [start])).rows;
  assert.ok(lines.every((l) => l.actor === USERS.reviewer), "credited to the reviewer");
  const count = (table: string, action: string): number => lines.filter((l) => l.table_name === table && l.action === action).length;
  assert.deepEqual([count("glosses", "soft_delete"), count("senses", "soft_delete"), count("senses", "insert"),
    count("glosses", "insert"), count("lemmas", "update")], [2, 2, 1, 2, 1]);
  const at: number = Date.parse(report.senses_reviewed_at);
  assert.ok(Math.abs(at - Date.now()) < 60_000, "now, by the database's clock");
});

test("senses_reviewed_at is set only by staff, always to the database's time, on an insert too", async () => {
  const db = await createSeededDatabase();
  const own = (await rowsAs<{ id: number; senses_reviewed_at: string | null }>(db, contributor,
    "insert into lemmas (headword, senses_reviewed_at) values ('mæ', '2001-01-01') returning id, senses_reviewed_at"))[0];
  assert.equal(own?.senses_reviewed_at, null, "a contributor's insert has it cleared");
  await assert.rejects(affectedAs(db, contributor, "update lemmas set senses_reviewed_at = now() where id = $1", [own?.id]),
    /only reviewers and admins may mark/);
  const staffInsert = (await rowsAs<{ at: string | null }>(db, reviewer,
    "insert into lemmas (headword, senses_reviewed_at) values ('tô', '2001-01-01') returning senses_reviewed_at::text as at"))[0];
  assert.ok(staffInsert?.at !== null && staffInsert?.at !== undefined && !staffInsert.at.startsWith("2001"),
    "a reviewer's insert gets the database's time");

  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  await markSplit(db);
  await affectedAs(db, reviewer, "update lemmas set senses_reviewed_at = '2001-01-01' where id = $1", [entry.lemma]);
  const set: string | null = await reviewedAt(db, entry.lemma);
  assert.ok(set !== null && !set.startsWith("2001"), "the database's own time, not the client's");
  // The trusted backend may write any value, as a load or a fix would.
  await affectedAs(db, "trusted", "update lemmas set senses_reviewed_at = '2001-01-01' where id = $1", [entry.lemma]);
  assert.match(await reviewedAt(db, entry.lemma) ?? "", /^2001-01-01/u);
});

/* ====================================================================
   Translations holding ";"
   ==================================================================== */

interface SplitReport {
  applied: boolean;
  split: number;
  skipped: number;
  inserted: number;
  already_present: number;
  glosses: { gloss_id: number; gloss: string; pieces: string[]; action: string; reason: string | null }[];
}

async function split(db: PGlite, who: Identity, apply: boolean): Promise<SplitReport> {
  const rows = await rowsAs<{ report: SplitReport }>(db, who, "select public.split_semicolon_glosses($1) as report", [apply]);
  const report: SplitReport | undefined = rows[0]?.report;
  assert.ok(report !== undefined);
  return report;
}

test("translations holding \";\" are split after a dry run that counts the same; a lemma on the list stays on it", async () => {
  const db = await createSeededDatabase();
  const one = await loaded(db, "lûxe", ["luce; lume ;luce;  lume  chiaro "]);
  const known = await loaded(db, "pénna", ["penna"]);
  await affectedAs(db, "trusted", "insert into glosses (sense_id, language, gloss) values ($1, 'it', 'penna;piuma')", [known.senses[0]]);
  const empty = await loaded(db, "nìnte", [" ; "]);
  const listed = await loaded(db, "béllo", ["bello;carino", "grazioso"]);
  await markSplit(db);

  for (const who of [reviewer, contributor]) {
    await assert.rejects(split(db, who, false), /only admins may split/);
  }
  const dry: SplitReport = await split(db, admin, false);
  assert.deepEqual([dry.applied, dry.split, dry.skipped, dry.inserted, dry.already_present], [false, 3, 1, 6, 1]);
  assert.deepEqual(dry.glosses.map((g) => [g.gloss, g.pieces, g.action]), [
    ["bello;carino", ["bello", "carino"], "split"],
    ["luce; lume ;luce;  lume  chiaro ", ["luce", "lume", "lume chiaro"], "split"],
    [" ; ", [], "skip"],
    ["penna;piuma", ["penna", "piuma"], "split"],
  ]);
  assert.deepEqual((await shapeOf(db, one.lemma))[0]?.glosses, ["it:luce; lume ;luce;  lume  chiaro "], "a dry run changes nothing");

  const done: SplitReport = await split(db, admin, true);
  assert.deepEqual([done.applied, done.split, done.skipped, done.inserted, done.already_present], [true, 3, 1, 6, 1]);
  assert.deepEqual((await shapeOf(db, one.lemma))[0]?.glosses, ["it:luce", "it:lume", "it:lume chiaro"]);
  assert.deepEqual((await shapeOf(db, known.lemma))[0]?.glosses, ["it:penna", "it:piuma"]);
  assert.deepEqual((await shapeOf(db, empty.lemma))[0]?.glosses, ["it: ; "]);
  assert.deepEqual((await shapeOf(db, listed.lemma)).map((s) => s.glosses), [["it:bello", "it:carino"], ["it:grazioso"]]);
  assert.deepEqual(await queuedIds(db), [listed.lemma], "still on the list, waiting for its reviewer");

  // Pieces are written as the manager's field writes them: NFC.
  const decomposed = await loaded(db, "çê", ["cielo;cièlo"]);
  await split(db, "trusted", true);
  assert.deepEqual((await shapeOf(db, decomposed.lemma))[0]?.glosses, ["it:cielo", "it:cièlo"]);
});

test("a piece repeated in two translations of one sense is counted once, in a dry run as in the real one; every kind of space is trimmed", async () => {
  const db = await createSeededDatabase();
  const water = await loaded(db, "ægua", ["acqua; agua"]);
  await affectedAs(db, "trusted", "insert into glosses (sense_id, language, gloss) values ($1, 'it', 'agua; water')", [water.senses[0]]);
  const spaced = await loaded(db, "lûxe", ["luce;\u00A0lume\u00A0;\u3000chiaro\u2009scuro"]);
  const dry: SplitReport = await split(db, admin, false);
  const done: SplitReport = await split(db, admin, true);
  assert.deepEqual([dry.inserted, dry.already_present], [done.inserted, done.already_present]);
  assert.deepEqual([done.inserted, done.already_present], [6, 1]);
  assert.deepEqual((await shapeOf(db, water.lemma))[0]?.glosses, ["it:acqua", "it:agua", "it:water"]);
  assert.deepEqual((await shapeOf(db, spaced.lemma))[0]?.glosses, ["it:luce", "it:lume", "it:chiaro scuro"]);
});

/* ====================================================================
   Backups
   ==================================================================== */

test("a backup keeps the list and the review dates; one made before them draws the list again, unchanged otherwise", async () => {
  const db = await createSeededDatabase();
  const entry = await loaded(db, "béllo", ["bello", "carino"]);
  const waiting = await loaded(db, "brutto", ["brutto", "laido"]);
  await markSplit(db);
  const later = await loaded(db, "nêuvo", ["nuovo", "recente"]);
  await regroup(db, reviewer, entry.lemma, await seenOf(db, entry.lemma), await groupsOf(db, entry.lemma, [["bello", "carino"]]));
  const at: string | null = await reviewedAt(db, entry.lemma);
  assert.ok(at !== null);
  const backup = (await rowsAs<{ backup: Record<string, unknown> }>(db, admin, "select public.export_backup() as backup"))[0]?.backup;
  assert.ok(backup !== undefined);

  const target = await createSeededDatabase();
  await rowsAs(target, admin, "select public.restore_backup($1::jsonb)", [JSON.stringify(backup)]);
  assert.equal(await reviewedAt(target, entry.lemma), at);
  assert.deepEqual([await onList(target, entry.lemma), await onList(target, waiting.lemma), await onList(target, later.lemma)],
    [true, true, false], "the list as it was, not drawn again");
  assert.deepEqual(await queuedIds(target), [waiting.lemma]);
  const again = (await rowsAs<{ backup: Record<string, unknown> }>(target, admin, "select public.export_backup() as backup"))[0]?.backup;
  assert.deepEqual((again?.["tables"] as Record<string, unknown>)?.["lemmas"], (backup["tables"] as Record<string, unknown>)["lemmas"]);

  // A backup made before 0.15.0: neither field.
  const tables = backup["tables"] as Record<string, Record<string, unknown>[]>;
  const lemmasBefore: Record<string, unknown>[] = (tables["lemmas"] ?? []).map((row) => {
    const copy: Record<string, unknown> = { ...row };
    delete copy["senses_reviewed_at"];
    delete copy["senses_review_needed"];
    return copy;
  });
  const old = { ...backup, tables: { ...tables, lemmas: lemmasBefore } };
  const older = await createSeededDatabase();
  await rowsAs(older, admin, "select public.restore_backup($1::jsonb)", [JSON.stringify(old)]);
  assert.equal(await reviewedAt(older, entry.lemma), null);
  // Drawn from the shape: the regrouped lemma has one sense now, the
  // other two are split.
  assert.deepEqual([await onList(older, entry.lemma), await onList(older, waiting.lemma), await onList(older, later.lemma)],
    [false, true, true]);
  const versions = await rowsAs<{ id: number; version: number }>(older, "trusted", "select id, version from lemmas order by id");
  assert.deepEqual(versions, lemmasBefore.map((l) => ({ id: l["id"], version: l["version"] })).sort((a, b) => Number(a.id) - Number(b.id)),
    "no version raised by drawing the list");
  const history = await rowsAs<{ n: string }>(older, "trusted", "select count(*) as n from audit_log");
  assert.equal(Number(history[0]?.n), (tables["audit_log"] ?? []).length, "no line of history added");
});

/* ====================================================================
   Speed, with no table statistics
   ==================================================================== */

/* Two plans once took minutes at the live dictionary's size [28,175
   lemmas]: a count of translations per sense left to table statistics,
   which a freshly loaded table lacks, and a regrouping that joined the
   translations to a JSON list, which kept row level security from the
   index. At 6,000 lemmas the slow plans take about 10 seconds; the
   plans of 0012 take a few dozen milliseconds. The bound is loose, for
   slow machines. */
test("without table statistics, drawing the list, a page of the queue, a regrouping and a dry run of the split stay fast", async () => {
  const db = await createSeededDatabase();
  await actAs(db, "trusted");
  await db.exec(`
    insert into lemmas (headword, status)
    select 'parola' || chr(97 + (i % 26)) || chr(97 + ((i / 26) % 26)) || chr(97 + ((i / 676) % 26)), 'approved'
    from generate_series(1, 6000) as i;
    insert into senses (lemma_id, sense_number, status) select id, 1, 'approved' from lemmas;
    insert into senses (lemma_id, sense_number, status) select id, 2, 'approved' from lemmas where id % 5 = 0;
    insert into senses (lemma_id, sense_number, status) select id, 3, 'approved' from lemmas where id % 15 = 0;
    insert into glosses (sense_id, language, gloss, status) select id, 'it', 'traduzione' || id, 'approved' from senses;
  `);
  const bound: number = 3000;
  const timed = async <T>(work: () => Promise<T>): Promise<{ ms: number; result: T }> => {
    const started: number = Date.now();
    const result: T = await work();
    return { ms: Date.now() - started, result };
  };

  const marked = await timed(() => markSplit(db));
  assert.equal(marked.result, 1200);
  assert.ok(marked.ms < bound, `drawing the list took ${marked.ms} ms`);

  const page = await timed(() => queue(db, reviewer));
  assert.equal(Number(page.result[0]?.total), 1200);
  assert.ok(page.ms < bound, `a page of the queue took ${page.ms} ms`);

  // Fewest senses first: the first page holds lemmas of two senses.
  const target: QueueRow | undefined = page.result[0];
  assert.equal(target?.senses, 2);
  assert.ok(target !== undefined);
  const seen: Seen = await seenOf(db, target.lemma_id);
  const done = await timed(() => regroup(db, reviewer, target.lemma_id, seen, [{ glosses: seen.glosses.map((g) => g.id) }]));
  assert.equal(done.result.created, 1);
  assert.ok(done.ms < bound, `a regrouping took ${done.ms} ms`);

  const dry = await timed(() => split(db, admin, false));
  assert.equal(dry.result.split, 0);
  assert.ok(dry.ms < bound, `a dry run of the split took ${dry.ms} ms`);
});
