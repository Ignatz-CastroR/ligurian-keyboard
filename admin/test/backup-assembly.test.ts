/*
 * backup-assembly.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 17:01:12, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of assembleBackup[] in admin/src/backup.ts, on a real
 *           database: the file built from small reads holds exactly the
 *           tables export_backup[] writes, passes the manager's check,
 *           restores into a fresh database and gives back the same
 *           backup; a server that caps its pages below PAGE_SIZE loses
 *           no row; and rows written while the backup runs never leave
 *           a row without its parent.
 * Method:   The source reads as an admin, as the page does; rows come
 *           back as to_jsonb[], the same JSON the API sends.
 * Decision: docs/decisions/0031-backups.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import {
  BACKUP_TABLES, BOUND_ORDER, PAGE_SIZE, assembleBackup, checkBackupText, type BackupSource, type Row,
} from "../src/backup.ts";

const admin = asUser(USERS.admin);
const contributor = asUser(USERS.contributor);
const reviewer = asUser(USERS.reviewer);

interface Backup { format: string; format_version: number; counts: Record<string, number>; tables: Record<string, Row[]> }

// The page's reads, against the test database, as an admin. A cap
// below PAGE_SIZE imitates a server that sends shorter pages.
function source(db: PGlite, cap: number = PAGE_SIZE, afterBounds: () => Promise<void> = async () => undefined): BackupSource & { calls: string[] } {
  const calls: string[] = [];
  let bounds: number = 0;
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
      bounds += 1;
      if (bounds === BOUND_ORDER.length) {
        await afterBounds();
      }
      return max;
    },
    async page(table: string, after: number, through: number, limit: number): Promise<Row[]> {
      calls.push(`page ${table} ${after}`);
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
  assert.deepEqual(Object.keys(assembled.tables), [...BACKUP_TABLES]);
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

test("rows written while the backup runs are left out whole: no row without its parent, no history without its row", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  const before: Backup = await exported(db);
  const late = source(db, 2, async () => {
    const lemma: number = await one(db, admin, "insert into lemmas (headword, status) values ('nêuvo', 'approved') returning id");
    const sense: number = await one(db, admin, "insert into senses (lemma_id) values ($1) returning id", [lemma]);
    await one(db, admin, "insert into glosses (sense_id, language, gloss) values ($1, 'it', 'nuovo') returning id", [sense]);
  });
  const assembled = await assembleBackup(late, new Date()) as unknown as Backup;
  assert.deepEqual(assembled.counts, before.counts);
  assert.ok(!JSON.stringify(assembled.tables).includes("nêuvo"));

  // And the file restores into a fresh database exactly.
  const fresh = await createSeededDatabase();
  await rowsAs(fresh, admin, "select public.restore_backup($1::jsonb)", [JSON.stringify(assembled)]);
  const again: Backup = await exported(fresh);
  assert.deepEqual(again.counts, assembled.counts);
  assert.deepEqual(again.tables["lemmas"], assembled.tables["lemmas"]);
  assert.deepEqual(again.tables["audit_log"], assembled.tables["audit_log"]);
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
