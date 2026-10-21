/*
 * backup-assembly.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 17:01:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of assembleBackup[] in admin/src/backup.ts, on a real
 *           database: the file built from small reads holds exactly the
 *           tables export_backup[] writes, passes the manager's check,
 *           restores into a fresh database and gives back the same
 *           backup; a server that caps its pages below PAGE_SIZE loses
 *           no row; a change while the backup runs makes it start
 *           again, so the file always restores; a dictionary that never
 *           rests is refused; a failed read is tried again.
 * Updated:  2026/10/21, 12:57:30: the tables written include the six
 *           grammar lists of migration 0013 [WRITTEN_TABLES].
 * Method:   The source reads as an admin, as the page does; rows come
 *           back as to_jsonb[], the same JSON the API sends.
 * Decision: docs/decisions/0031-backups.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import {
  ATTEMPTS, BOUND_ORDER, WRITTEN_TABLES, BackupBusyError, PAGE_SIZE, READ_TRIES, assembleBackup, checkBackupText,
  type BackupSource, type Row,
} from "../src/backup.ts";

const admin = asUser(USERS.admin);
const contributor = asUser(USERS.contributor);
const reviewer = asUser(USERS.reviewer);

interface Backup { format: string; format_version: number; counts: Record<string, number>; tables: Record<string, Row[]> }

// The page's reads, against the test database, as an admin. A cap
// below PAGE_SIZE imitates a server that sends shorter pages.
function source(db: PGlite, cap: number = PAGE_SIZE, afterBounds: (attempt: number) => Promise<void> = async () => undefined,
  failures: number = 0): BackupSource & { calls: string[] } {
  const calls: string[] = [];
  let attempt: number = 0;
  let toFail: number = failures;
  return {
    calls,
    async all(table: string, order: readonly string[]): Promise<Row[]> {
      calls.push(`all ${table}`);
      return (await rowsAs<{ r: Row }>(db, admin,
        `select to_jsonb(t) as r from public.${table} as t order by ${order.map((c) => `t.${c}`).join(", ")}`)).map((x) => x.r);
    },
    async maxId(table: string): Promise<number> {
      calls.push(`max ${table}`);
      const max: number = Number((await rowsAs<{ m: number }>(db, admin, `select coalesce(max(id), 0) as m from public.${table}`))[0]?.m ?? 0);
      // The last bound of each attempt is the lemmas'.
      if (table === "lemmas") {
        attempt += 1;
        await afterBounds(attempt);
      }
      return max;
    },
    async page(table: string, after: number, through: number, limit: number): Promise<Row[]> {
      calls.push(`page ${table} ${after}`);
      if (toFail > 0) {
        toFail -= 1;
        throw new Error("network");
      }
      return (await rowsAs<{ r: Row }>(db, admin,
        `select to_jsonb(t) as r from public.${table} as t where t.id > $1 and t.id <= $2 order by t.id limit $3`,
        [after, through, Math.min(limit, cap)])).map((x) => x.r);
    },
  };
}

async function one(db: PGlite, who: ReturnType<typeof asUser>, sql: string, params: unknown[] = []): Promise<number> {
  return (await rowsAs<{ id: number }>(db, who, sql, params))[0]?.id ?? -1;
}

// Approved, pending, rejected and deleted rows, edits and two authors.
async function fill(db: PGlite): Promise<void> {
  for (const [headword, status] of [["pénna", "approved"], ["cà", "approved"], ["zenéize", "pending"], ["ægua", "rejected"]] as const) {
    const lemma: number = await one(db, admin, "insert into lemmas (headword, status) values ($1, $2) returning id", [headword, status]);
    const sense: number = await one(db, admin, "insert into senses (lemma_id, definition_it, status) values ($1, 'senso', $2) returning id", [lemma, status]);
    await one(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, 'es', $2, $3) returning id", [sense, `x${headword}`, status]);
  }
  const zena: number = await one(db, contributor, "insert into lemmas (headword) values ('Zêna') returning id");
  await one(db, contributor, "insert into wordforms (lemma_id, form) values ($1, 'Zenâ') returning id", [zena]);
  await rowsAs(db, reviewer, "update lemmas set status = 'approved' where id = $1", [zena]);
  await rowsAs(db, admin, "update lemmas set note = 'nota' where headword = 'cà'");
  await rowsAs(db, admin, "update lemmas set deleted_at = now() where headword = 'ægua'");
}

async function exported(db: PGlite): Promise<Backup> {
  const backup: Backup | undefined = (await rowsAs<{ b: Backup }>(db, admin, "select public.export_backup() as b"))[0]?.b;
  assert.ok(backup !== undefined);
  return backup;
}

test("the assembled backup holds exactly the tables export_backup writes, and passes the manager's check", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  const progress: number[] = [];
  const assembled = await assembleBackup(source(db), new Date(2026, 9, 18, 17, 0, 0), (n) => progress.push(n)) as unknown as Backup;
  const reference: Backup = await exported(db);
  assert.deepEqual(assembled.tables, reference.tables);
  assert.deepEqual(assembled.counts, reference.counts);
  assert.deepEqual(Object.keys(assembled.tables), [...WRITTEN_TABLES]);
  assert.deepEqual([assembled.format, assembled.format_version], [reference.format, reference.format_version]);
  assert.ok(checkBackupText(JSON.stringify(assembled, null, 1)).ok);
  assert.deepEqual([...progress].sort((a, b) => a - b), progress, "progress only grows");
  const total: number = Object.values(reference.counts).reduce((a, b) => a + b, 0);
  assert.equal(progress.at(-1), total);
});

test("pages capped by the server below PAGE_SIZE lose no row, and every table ends on an empty page or its bound", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  const capped = source(db, 3);
  const assembled = await assembleBackup(capped, new Date()) as unknown as Backup;
  assert.deepEqual(assembled.tables, (await exported(db)).tables);
  assert.ok(capped.calls.filter((c) => c.startsWith("page audit_log")).length > 3);
  assert.deepEqual(capped.calls.slice(0, BOUND_ORDER.length), BOUND_ORDER.map((t) => `max ${t}`));
});

async function addEntry(db: PGlite, headword: string): Promise<void> {
  const lemma: number = await one(db, admin, "insert into lemmas (headword, status) values ($1, 'approved') returning id", [headword]);
  const sense: number = await one(db, admin, "insert into senses (lemma_id) values ($1) returning id", [lemma]);
  await one(db, admin, "insert into glosses (sense_id, language, gloss) values ($1, 'it', 'nuovo') returning id", [sense]);
}

test("a change while the backup runs makes it start again, and the file it gives holds the change and restores", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  const retries: number[] = [];
  const changing = source(db, 2, async (attempt) => {
    if (attempt === 1) {
      await addEntry(db, "nêuvo");
    }
  });
  const assembled = await assembleBackup(changing, new Date(), () => undefined, (n) => retries.push(n)) as unknown as Backup;
  assert.deepEqual(retries, [2]);
  assert.deepEqual(assembled.tables, (await exported(db)).tables);
  assert.ok(JSON.stringify(assembled.tables).includes("nêuvo"));

  const fresh = await createSeededDatabase();
  await rowsAs(fresh, admin, "select public.restore_backup($1::jsonb)", [JSON.stringify(assembled)]);
  // The fresh database has profiles of its own; the lexicon and its
  // history come back exactly.
  const again: Backup = await exported(fresh);
  for (const table of ["lemmas", "wordforms", "senses", "glosses", "audit_log"]) {
    assert.deepEqual(again.tables[table], assembled.tables[table], table);
  }
});

test("two lemmas renamed into each other's spelling mid backup never reach the file; a dictionary that never rests is refused", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  // The swap that, read across pages, gave two live lemmas one spelling.
  const swapping = source(db, 1, async (attempt) => {
    if (attempt === 1) {
      await rowsAs(db, admin, "update lemmas set headword = 'zzzèta' where headword = 'pénna'");
      await rowsAs(db, admin, "update lemmas set headword = 'pénna' where headword = 'cà'");
    }
  });
  const assembled = await assembleBackup(swapping, new Date()) as unknown as Backup;
  const fresh = await createSeededDatabase();
  await rowsAs(fresh, admin, "select public.restore_backup($1::jsonb)", [JSON.stringify(assembled)]);

  let n: number = 0;
  const restless = source(db, PAGE_SIZE, async () => {
    n += 1;
    await addEntry(db, `nêuvo${"a".repeat(n)}`);
  });
  await assert.rejects(assembleBackup(restless, new Date()), BackupBusyError);
  assert.equal(n, ATTEMPTS);
});

test("a read that fails is tried again; one that keeps failing stops the backup with its error", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  const flaky = source(db, PAGE_SIZE, async () => undefined, READ_TRIES - 1);
  assert.deepEqual((await assembleBackup(flaky, new Date()) as unknown as Backup).tables, (await exported(db)).tables);
  const broken = source(db, PAGE_SIZE, async () => undefined, READ_TRIES);
  await assert.rejects(assembleBackup(broken, new Date()), /network/u);
});

test("an empty dictionary gives a complete backup with empty tables, without reading a single page", async () => {
  const db = await createSeededDatabase();
  const empty = source(db);
  const assembled = await assembleBackup(empty, new Date()) as unknown as Backup;
  assert.ok(checkBackupText(JSON.stringify(assembled)).ok);
  assert.equal(assembled.counts["lemmas"], 0);
  assert.equal(assembled.counts["profiles"], 5);
  assert.equal(empty.calls.filter((c) => c.startsWith("page")).length, 0);
});
