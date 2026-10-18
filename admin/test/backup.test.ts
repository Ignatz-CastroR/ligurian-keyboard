/*
 * backup.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/18, 09:29:02, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of admin/src/backup.ts: file names, the summary of
 *           counts, and the check that refuses a wrong file before it
 *           reaches the database. A real backup written by the
 *           database must pass it.
 * Decision: docs/decisions/0031-backups.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { BACKUP_TABLES, backupFileName, checkBackupText, countsSummary } from "../src/backup.ts";
import { messagesFor } from "../src/messages.ts";

const it = messagesFor("it");
const LABELS = {
  lemmas: it.countLemmas, wordforms: it.countWordforms, senses: it.countSenses,
  glosses: it.countGlosses, history: it.countHistory,
};

test("a backup file is named by local date and time, digits only, so names sort in time order", () => {
  assert.equal(backupFileName(new Date(2026, 9, 18, 8, 5, 3)), "ligurian-backup-20261018-080503.json");
  assert.equal(backupFileName(new Date(2027, 0, 1, 23, 59, 59)), "ligurian-backup-20270101-235959.json");
  const earlier: string = backupFileName(new Date(2026, 8, 30, 23, 0, 0));
  const later: string = backupFileName(new Date(2026, 9, 1, 0, 0, 0));
  assert.ok(earlier < later);
});

test("the summary names every count, in the singular for one, and a missing count is zero", () => {
  assert.equal(countsSummary({ lemmas: 12, wordforms: 30, senses: 4, glosses: 8, audit_log: 120 }, LABELS),
    "12 lemmi · 30 forme · 4 significati · 8 traduzioni · 120 righe di cronologia");
  assert.equal(countsSummary({ lemmas: 1, wordforms: 1, senses: 1, glosses: 1, audit_log: 1 }, LABELS),
    "1 lemma · 1 forma · 1 significato · 1 traduzione · 1 riga di cronologia");
  assert.equal(countsSummary({ lemmas: 1 }, LABELS), "1 lemma · 0 forme · 0 significati · 0 traduzioni · 0 righe di cronologia");
  for (const lang of ["en", "es"] as const) {
    const m = messagesFor(lang);
    for (const text of [m.countLemmas, m.countWordforms, m.countSenses, m.countGlosses, m.countHistory]) {
      assert.notEqual(text(1), text(2).replace("2", "1"), `${lang}: ${text(2)} has no singular`);
    }
  }
});

test("a file that is not a backup is refused with the first reason that applies", () => {
  const tables: Record<string, unknown[]> = Object.fromEntries(BACKUP_TABLES.map((name) => [name, []]));
  const valid = { format: "ligurian-keyboard-backup", format_version: 1, created_at: "2026-10-18", tables };
  assert.deepEqual(checkBackupText("not json"), { ok: false, reason: "json" });
  assert.deepEqual(checkBackupText("null"), { ok: false, reason: "format" });
  assert.deepEqual(checkBackupText("[]"), { ok: false, reason: "format" });
  assert.deepEqual(checkBackupText(JSON.stringify({ ...valid, format: "other" })), { ok: false, reason: "format" });
  assert.deepEqual(checkBackupText(JSON.stringify({ ...valid, format_version: 2 })), { ok: false, reason: "version" });
  assert.deepEqual(checkBackupText(JSON.stringify({ ...valid, format_version: "1" })), { ok: false, reason: "version" });
  const { audit_log: _dropped, ...partial } = tables;
  assert.deepEqual(checkBackupText(JSON.stringify({ ...valid, tables: partial })), { ok: false, reason: "tables" });
  assert.deepEqual(checkBackupText(JSON.stringify({ ...valid, tables: { ...tables, lemmas: {} } })), { ok: false, reason: "tables" });
  const ok = checkBackupText(JSON.stringify(valid));
  assert.ok(ok.ok);
});

test("a backup written by the database passes, with its counts", async () => {
  const db = await createSeededDatabase();
  await db.query("insert into lemmas (headword, status) values ('pénna', 'approved')");
  const rows = await rowsAs<{ backup: unknown }>(db, asUser(USERS.admin), "select public.export_backup() as backup");
  const check = checkBackupText(JSON.stringify(rows[0]?.backup, null, 1));
  assert.ok(check.ok);
  if (check.ok) {
    assert.equal(check.summary.counts["lemmas"], 1);
    assert.equal(check.summary.counts["wordforms"], 1);
    assert.equal(check.summary.counts["profiles"], 5);
    assert.equal(check.summary.counts["audit_log"], 2);
  }
});
