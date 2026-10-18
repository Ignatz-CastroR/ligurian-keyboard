/*
 * public-ids-backup.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 08:47:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0006: every lemma and wordform carries a
 *           public identifier that is valid, unique across both tables,
 *           out of every client's reach and never reused; the database
 *           and the lexicon manager compute the same check symbols;
 *           entries written before 0006 receive theirs with a line of
 *           history; and a backup restores into an empty database
 *           exactly, identifiers, versions, authors and history
 *           included.
 * Contract: Every test builds its own database. A rule is tested from
 *           the side of the person who must NOT be able to break it.
 * Decision: docs/decisions/0030-public-identifiers.md and
 *           docs/decisions/0031-backups.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { checkSymbol, crockfordSymbols, isValidPublicId } from "../../admin/src/public-id.ts";
import {
  USERS, actAs, affectedAs, asUser, createDatabase, createSeededDatabase, migrationNames, rowsAs, runMigration,
} from "./harness.ts";

interface IdRow { id: number }
interface CodeRow { public_id: string }
interface Backup {
  format: string;
  format_version: number;
  created_at: string;
  license: string;
  counts: Record<string, number>;
  tables: Record<string, Record<string, unknown>[]>;
}
interface RestoreReport {
  restored: Record<string, number>;
  profiles_skipped: number;
  authors_unknown: number;
}

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);

const LEXICON_TABLES: readonly string[] = ["lemmas", "wordforms", "senses", "glosses", "audit_log"];

/* A small but complete dictionary: approved, pending, rejected and
   deleted rows, inflected forms, senses with translations, edits, and
   rows written by a contributor, so that history has several authors. */
async function fillDictionary(db: PGlite): Promise<void> {
  const penna: number = (await rowsAs<IdRow>(db, admin,
    "insert into lemmas (headword, part_of_speech, status) values ('pénna', 'noun', 'approved') returning id"))[0]?.id ?? -1;
  await affectedAs(db, admin, "insert into wordforms (lemma_id, form, grammatical_tag, freq, status) values ($1, 'pénne', 'pl.', 5, 'approved')", [penna]);
  const sense: number = (await rowsAs<IdRow>(db, admin,
    "insert into senses (lemma_id, definition_it, status) values ($1, 'strumento per scrivere', 'approved') returning id", [penna]))[0]?.id ?? -1;
  await affectedAs(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, 'it', 'penna', 'approved')", [sense]);
  await affectedAs(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, 'en', 'pen', 'approved')", [sense]);

  const zena: number = (await rowsAs<IdRow>(db, contributor,
    "insert into lemmas (headword, part_of_speech) values ('Zêna', 'proper_noun') returning id"))[0]?.id ?? -1;
  await affectedAs(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'Zenâ')", [zena]);
  await affectedAs(db, reviewer, "update lemmas set status = 'approved' where id = $1", [zena]);
  await affectedAs(db, reviewer, "update wordforms set status = 'rejected' where lemma_id = $1 and not is_base", [zena]);

  const old: number = (await rowsAs<IdRow>(db, admin,
    "insert into lemmas (headword, status) values ('cà', 'approved') returning id"))[0]?.id ?? -1;
  await affectedAs(db, admin, "update lemmas set note = 'casa' where id = $1", [old]);
  await affectedAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [old]);

  await affectedAs(db, contributor, "insert into lemmas (headword) values ('ægua')");
}

async function backupAs(db: PGlite, who: ReturnType<typeof asUser>): Promise<Backup> {
  const rows = await rowsAs<{ backup: Backup }>(db, who, "select public.export_backup() as backup");
  const backup: Backup | undefined = rows[0]?.backup;
  assert.ok(backup !== undefined);
  return backup;
}

async function restoreAs(db: PGlite, who: ReturnType<typeof asUser> | "trusted", backup: unknown): Promise<RestoreReport> {
  const rows = await rowsAs<{ report: RestoreReport }>(db, who, "select public.restore_backup($1::jsonb) as report",
    [JSON.stringify(backup)]);
  const report: RestoreReport | undefined = rows[0]?.report;
  assert.ok(report !== undefined);
  return report;
}

async function allCodes(db: PGlite): Promise<string[]> {
  const rows = (await db.query<CodeRow>(
    "select public_id from lemmas union all select public_id from wordforms")).rows;
  return rows.map((r) => r.public_id);
}

/* A deterministic stream of 40-bit numbers [xorshift32 pairs], so a
   failure can be reproduced exactly. */
function* sampleValues(count: number): Generator<number> {
  let state: number = 0x9e3779b9;
  const next = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  yield 0;
  yield 2 ** 40 - 1;
  for (let i: number = 2; i < count; i += 1) {
    yield (next() % 256) * 2 ** 32 + next();
  }
}

/* ====================================================================
   Public identifiers
   ==================================================================== */

test("every lemma and wordform gets a valid code, unique across both tables and registered", async () => {
  const db = await createSeededDatabase();
  await fillDictionary(db);
  const codes: string[] = await allCodes(db);
  assert.ok(codes.length >= 10);
  for (const code of codes) {
    assert.ok(isValidPublicId(code), code);
  }
  assert.equal(new Set(codes).size, codes.length, "a code was given twice");
  const registered = (await db.query<{ n: number }>(
    "select count(*)::int as n from private.issued_public_ids where code in (select public_id from lemmas union all select public_id from wordforms)")).rows;
  assert.equal(registered[0]?.n, codes.length);
});

test("nobody chooses or changes a code: clients, admins and the trusted backend alike", async () => {
  const db = await createSeededDatabase();
  const chosen: string = `LIJ-00000000${checkSymbol("00000000") ?? ""}`;
  assert.ok(isValidPublicId(chosen));
  const id: number = (await rowsAs<IdRow>(db, admin,
    "insert into lemmas (headword, public_id) values ('mâ', $1) returning id", [chosen]))[0]?.id ?? -1;
  const given: string = (await db.query<CodeRow>("select public_id from lemmas where id = $1", [id])).rows[0]?.public_id ?? "";
  assert.notEqual(given, chosen);
  assert.ok(isValidPublicId(given));

  await affectedAs(db, admin, "update lemmas set public_id = $2 where id = $1", [id, chosen]);
  await db.query("update lemmas set public_id = $2 where id = $1", [id, chosen]);
  await db.query("update wordforms set public_id = $2 where lemma_id = $1", [id, chosen]);
  const after: string = (await db.query<CodeRow>("select public_id from lemmas where id = $1", [id])).rows[0]?.public_id ?? "";
  assert.equal(after, given);
  const form = (await db.query<CodeRow>("select public_id from wordforms where lemma_id = $1", [id])).rows;
  assert.notEqual(form[0]?.public_id, chosen);
});

test("a malformed code, or one with a wrong check symbol, is refused by the table itself", async () => {
  const db = await createSeededDatabase();
  await db.query("insert into lemmas (headword) values ('mâ')");
  // Even with the trigger out of the way, the check constraint holds.
  await db.exec("alter table lemmas disable trigger lemmas_public_id");
  const good: string = `LIJ-7K3Q9MDX${checkSymbol("7K3Q9MDX") ?? ""}`;
  const wrongCheck: string = good.slice(0, 12) + (good.endsWith("0") ? "1" : "0");
  for (const bad of [wrongCheck, "LIJ-7K3Q9MDI0", "lij-7k3q9mdx0", "LIJ7K3Q9MDXA", "LIJ-7K3Q9MD"]) {
    await assert.rejects(db.query("update lemmas set public_id = $1", [bad]), /lemmas_public_id_valid/, bad);
  }
});

test("the database and the lexicon manager compute the same check symbols", async () => {
  const db = await createDatabase();
  const bodies: string[] = [...sampleValues(400)].map((v) => crockfordSymbols(v, 8));
  const rows = (await db.query<{ body: string; check: string; ok: boolean }>(
    `select b as body, private.public_id_check_symbol(b) as check,
            private.public_id_is_valid('LIJ-' || b || private.public_id_check_symbol(b)) as ok
       from unnest($1::text[]) as b`, [bodies])).rows;
  assert.equal(rows.length, bodies.length);
  for (const row of rows) {
    assert.equal(row.check, checkSymbol(row.body), row.body);
    assert.equal(row.ok, true, row.body);
  }
  // Codes drawn by the database itself pass the manager's check.
  const drawn = (await db.query<{ code: string }>("select private.new_public_id() as code from generate_series(1, 200)")).rows;
  for (const { code } of drawn) {
    assert.ok(isValidPublicId(code), code);
  }
});

test("entries written before 0006 receive their codes when it runs, each with one line of history", async () => {
  const before: string = migrationNames().filter((n) => n < "0006").at(-1) ?? "";
  const after: string[] = migrationNames().filter((n) => n >= "0006");
  assert.equal(after[0], "0006_public_ids_and_backups.sql");
  const db = await createSeededDatabase(before);
  await db.query("insert into lemmas (headword, status) values ('pénna', 'approved')");
  await db.query("insert into wordforms (lemma_id, form, status) select id, 'pénne', 'approved' from lemmas");
  const historyBefore: number = (await db.query<{ n: number }>("select count(*)::int as n from audit_log")).rows[0]?.n ?? 0;

  for (const name of after) {
    await runMigration(db, name);
  }

  const rows = (await db.query<{ public_id: string; version: number }>(
    "select public_id, version from lemmas union all select public_id, version from wordforms")).rows;
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.ok(isValidPublicId(row.public_id));
    assert.equal(row.version, 2);
  }
  const added = (await db.query<{ action: string; code: string | null }>(
    "select action, new_row ->> 'public_id' as code from audit_log order by id offset $1", [historyBefore])).rows;
  assert.equal(added.length, 3);
  for (const line of added) {
    assert.equal(line.action, "update");
    assert.ok(isValidPublicId(line.code ?? ""));
  }
});

/* ====================================================================
   Backups
   ==================================================================== */

test("only admins download a backup; reviewers, contributors and visitors are refused", async () => {
  const db = await createSeededDatabase();
  await fillDictionary(db);
  const backup: Backup = await backupAs(db, admin);
  assert.equal(backup.format, "ligurian-keyboard-backup");
  assert.equal(backup.format_version, 1);
  for (const table of ["varieties", "orthographies", "gloss_languages", "profiles", ...LEXICON_TABLES]) {
    assert.ok(Array.isArray(backup.tables[table]), table);
    assert.equal(backup.counts[table], backup.tables[table]?.length, table);
  }
  assert.equal(backup.tables["profiles"]?.length, 5);
  assert.ok(Object.keys(backup.tables["profiles"]?.[0] ?? {}).every((k) => k !== "email"));

  await assert.rejects(rowsAs(db, reviewer, "select public.export_backup()"), /only admins/);
  await assert.rejects(rowsAs(db, contributor, "select public.export_backup()"), /only admins/);
  await assert.rejects(rowsAs(db, "anon", "select public.export_backup()"), /permission denied/);
});

test("a backup restores into an empty database exactly: ids, codes, versions, authors and history", async () => {
  const source = await createSeededDatabase();
  await fillDictionary(source);
  const backup: Backup = await backupAs(source, admin);
  const tsvBefore = (await source.query<{ tsv: string }>("select export_lexicon_tsv() as tsv")).rows[0]?.tsv;

  const target = await createSeededDatabase();
  // Roles must come back from the backup, not from the seeding.
  await target.query("update profiles set role = 'member' where user_id <> $1", [USERS.admin]);
  const report: RestoreReport = await restoreAs(target, admin, backup);
  assert.deepEqual(report.restored, {
    lemmas: backup.counts["lemmas"], wordforms: backup.counts["wordforms"], senses: backup.counts["senses"],
    glosses: backup.counts["glosses"], audit_log: backup.counts["audit_log"],
  });
  assert.equal(report.profiles_skipped, 0);
  assert.equal(report.authors_unknown, 0);

  const again: Backup = await backupAs(target, admin);
  for (const table of [...LEXICON_TABLES, "varieties", "orthographies", "gloss_languages"]) {
    assert.deepEqual(again.tables[table], backup.tables[table], table);
  }
  const roles = (b: Backup): unknown[] => (b.tables["profiles"] ?? [])
    .map((p) => [p["user_id"], p["role"], p["display_name"]]).sort();
  assert.deepEqual(roles(again), roles(backup));

  const tsvAfter = (await target.query<{ tsv: string }>("select export_lexicon_tsv() as tsv")).rows[0]?.tsv;
  assert.equal(tsvAfter, tsvBefore);
});

test("after a restore, ids continue past the highest one and no restored code is ever drawn again", async () => {
  const source = await createSeededDatabase();
  await fillDictionary(source);
  const backup: Backup = await backupAs(source, admin);
  const target = await createSeededDatabase();
  await restoreAs(target, admin, backup);

  const maxId: number = Math.max(...(backup.tables["lemmas"] ?? []).map((l) => Number(l["id"])));
  const fresh = (await rowsAs<IdRow & CodeRow>(target, admin,
    "insert into lemmas (headword, status) values ('mâ', 'approved') returning id, public_id"))[0];
  assert.ok(fresh !== undefined && fresh.id > maxId);
  const restoredCodes: Set<string> = new Set([
    ...(backup.tables["lemmas"] ?? []), ...(backup.tables["wordforms"] ?? []),
  ].map((r) => String(r["public_id"])));
  assert.ok(!restoredCodes.has(fresh.public_id));
  const registered = (await target.query<{ code: string }>("select code from private.issued_public_ids")).rows.map((r) => r.code);
  for (const code of restoredCodes) {
    assert.ok(registered.includes(code), code);
  }
  // The restore wrote no history of its own; the new lemma did.
  const history = (await target.query<{ n: number }>("select count(*)::int as n from audit_log")).rows[0]?.n;
  assert.equal(history, (backup.counts["audit_log"] ?? 0) + 2);
});

test("a restore refuses a dictionary that is not empty, a non admin, and a file that is not a backup", async () => {
  const source = await createSeededDatabase();
  await fillDictionary(source);
  const backup: Backup = await backupAs(source, admin);

  await assert.rejects(restoreAs(source, admin, backup), /only into an empty dictionary/);

  const target = await createSeededDatabase();
  await assert.rejects(restoreAs(target, reviewer, backup), /only admins/);
  await assert.rejects(restoreAs(target, contributor, backup), /only admins/);
  await assert.rejects(rowsAs(target, "anon", "select public.restore_backup('{}'::jsonb)"), /permission denied/);
  await assert.rejects(restoreAs(target, admin, { format: "something-else", format_version: 1, tables: {} }), /not a complete ligurian-keyboard backup/);
  await assert.rejects(restoreAs(target, admin, { ...backup, format_version: 2 }), /not a complete ligurian-keyboard backup/);
  await assert.rejects(restoreAs(target, admin, { ...backup, format_version: "1" }), /not a complete ligurian-keyboard backup/);
  await assert.rejects(restoreAs(target, admin, { ...backup, tables: {} }), /not a complete ligurian-keyboard backup/);
  const { audit_log: _history, ...noHistory } = backup.tables;
  await assert.rejects(restoreAs(target, admin, { ...backup, tables: noHistory }), /not a complete ligurian-keyboard backup/);
});

test("a restore that fails halfway leaves nothing behind, not even the flag", async () => {
  const source = await createSeededDatabase();
  await fillDictionary(source);
  const backup: Backup = await backupAs(source, admin);
  // A form that carries its lemma's code: refused only once loading has begun.
  const lemmaCode: unknown = backup.tables["lemmas"]?.[0]?.["public_id"];
  const forms = (backup.tables["wordforms"] ?? []).map((w, i) => (i === 0 ? { ...w, public_id: lemmaCode } : w));
  const target = await createSeededDatabase();
  await assert.rejects(restoreAs(target, admin, { ...backup, tables: { ...backup.tables, wordforms: forms } }), /appears twice/);
  const nullCode = (backup.tables["wordforms"] ?? []).map((w, i) => (i === 0 ? { ...w, public_id: null } : w));
  await assert.rejects(restoreAs(target, admin, { ...backup, tables: { ...backup.tables, wordforms: nullCode } }), /invalid public identifier/);
  const left = (await target.query<{ n: number; flag: string | null; codes: number }>(
    `select (select count(*)::int from lemmas) as n, current_setting('ligurian.restoring', true) as flag,
            (select count(*)::int from private.issued_public_ids) as codes`)).rows[0];
  assert.equal(left?.n, 0);
  assert.notEqual(left?.flag, "on");
  assert.equal(left?.codes, 0);
});

test("a backup restores into the same project after its data was lost", async () => {
  const db = await createSeededDatabase();
  await fillDictionary(db);
  const backup: Backup = await backupAs(db, admin);
  // Lost data: the tables emptied behind the database's back. The registry still knows every code.
  await db.exec("truncate audit_log, glosses, senses, wordforms, lemmas");
  const report: RestoreReport = await restoreAs(db, admin, backup);
  assert.equal(report.restored["lemmas"], backup.counts["lemmas"]);
  assert.equal(report.authors_unknown, 0);
  const again: Backup = await backupAs(db, admin);
  for (const table of LEXICON_TABLES) {
    assert.deepEqual(again.tables[table], backup.tables[table], table);
  }
});

test("codes and the restore flag are out of every client's reach", async () => {
  const db = await createSeededDatabase();
  for (const who of [contributor, reviewer, admin] as const) {
    await assert.rejects(rowsAs(db, who, "select code from private.issued_public_ids"), /permission denied/);
    await assert.rejects(rowsAs(db, who, "select private.new_public_id()"), /permission denied/);
  }
  await assert.rejects(rowsAs(db, "anon", "select private.new_public_id()"), /permission denied/);
  // Even a contributor who managed to set the flag still meets every rule.
  await actAs(db, contributor);
  try {
    await db.exec("begin");
    await db.query("select set_config('ligurian.restoring', 'on', true)");
    await db.query("insert into lemmas (headword, status, version) values ('mâ', 'approved', 99)");
    const row = (await db.query<{ status: string; version: number; created_by: string }>(
      "select status, version, created_by from lemmas where headword = 'mâ'")).rows[0];
    assert.deepEqual(row, { status: "pending", version: 1, created_by: USERS.contributor });
    await db.exec("rollback");
  } finally {
    await actAs(db, "trusted");
  }
});

test("authors with no account here become null and are counted; their profiles are skipped", async () => {
  const source = await createSeededDatabase();
  await fillDictionary(source);
  const backup: Backup = await backupAs(source, admin);

  // A new project where only the trusted backend restores: nobody has signed up yet.
  const target = await createDatabase();
  const report: RestoreReport = await restoreAs(target, "trusted", backup);
  assert.equal(report.profiles_skipped, 5);
  assert.ok(report.authors_unknown > 0);
  const authors = (await target.query<{ n: number }>(
    "select count(*)::int as n from lemmas where created_by is not null")).rows[0]?.n;
  assert.equal(authors, 0);
  // History still names every author by id.
  const actors = (await target.query<{ n: number }>(
    "select count(distinct actor)::int as n from audit_log where actor is not null")).rows[0]?.n;
  assert.ok((actors ?? 0) >= 3);
});
