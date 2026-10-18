/*
 * backup-time-limit.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 16:18:52, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0008: export_backup[] and restore_backup[]
 *           carry a time limit of 60 seconds of their own, and nothing
 *           else about them changed. The limit itself is applied by
 *           Supabase's API, which these tests cannot run; they check
 *           what the API reads.
 * Decision: docs/decisions/0031-backups.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { USERS, asUser, createSeededDatabase, migrationNames, rowsAs } from "./harness.ts";

interface ConfigRow { name: string; config: string[] | null; definer: boolean }

const FUNCTIONS: string = `
  select p.proname as name, p.proconfig as config, p.prosecdef as definer
    from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('export_backup', 'restore_backup')
   order by p.proname`;

test("migration 0008 runs after 0007", () => {
  const names: string[] = migrationNames();
  assert.equal(names[names.indexOf("0007_batch_review.sql") + 1], "0008_backup_time_limit.sql");
});

test("a backup and a restore may each run for 60 seconds, and keep every other setting they had", async () => {
  const before: ConfigRow[] = await rowsAs<ConfigRow>(await createSeededDatabase("0007_batch_review.sql"), "trusted", FUNCTIONS);
  const after: ConfigRow[] = await rowsAs<ConfigRow>(await createSeededDatabase(), "trusted", FUNCTIONS);
  assert.deepEqual(after.map((r) => r.name), ["export_backup", "restore_backup"]);
  after.forEach((row, i) => {
    const old: ConfigRow | undefined = before[i];
    assert.ok(old !== undefined);
    assert.ok(!(old.config ?? []).some((c) => c.startsWith("statement_timeout=")), `${row.name} had no limit of its own`);
    assert.deepEqual([...(row.config ?? [])].sort(), [...(old.config ?? []), "statement_timeout=60s"].sort(), row.name);
    assert.equal(row.definer, old.definer, `${row.name} runs as it did`);
  });
});

test("the limit belongs to the functions alone: a session's own limit is unchanged after a backup", async () => {
  const db = await createSeededDatabase();
  const admin = asUser(USERS.admin);
  const before = await rowsAs<{ statement_timeout: string }>(db, admin, "show statement_timeout");
  const backup = await rowsAs<{ ok: boolean }>(db, admin,
    "select (public.export_backup() ->> 'format') = 'ligurian-keyboard-backup' as ok");
  assert.deepEqual(backup, [{ ok: true }]);
  assert.deepEqual(await rowsAs(db, admin, "show statement_timeout"), before);
});
