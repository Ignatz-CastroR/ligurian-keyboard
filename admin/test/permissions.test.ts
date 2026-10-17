/*
 * permissions.test.ts
 * Author:   Ignatz-CastroR and contributors
 * Date:     2026/10/11, 20:21:21, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove that the buttons the manager shows match what the
 *           real database accepts: for every role and kind of row, the
 *           answer of permissions.ts is compared with an actual update
 *           attempted on a fresh embedded PostgreSQL.
 * Contract: A disagreement means either a missing button or a button
 *           that always fails; both are bugs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, actAs } from "../../db/test/harness.ts";
import { canChangeStatus, canDeleteRow, canEdit } from "../src/permissions.ts";
import type { Lemma, Role } from "../src/types.ts";

const ROLE_USERS: [Role, string][] = [
  ["admin", USERS.admin],
  ["reviewer", USERS.reviewer],
  ["contributor", USERS.contributor],
  ["member", USERS.member],
];

// Rows of every kind that matters: a contributor's own pending row,
// another contributor's pending row, an approved row, a deleted row.
async function seedRows(db: PGlite): Promise<Lemma[]> {
  await actAs(db, asUser(USERS.contributor));
  await db.query("insert into lemmas (headword) values ('pénna')");
  await actAs(db, asUser(USERS.contributor2));
  await db.query("insert into lemmas (headword) values ('çitæ')");
  await actAs(db, "trusted");
  await db.query("insert into lemmas (headword, status) values ('Zêna', 'approved')");
  await db.query("insert into lemmas (headword, status) values ('canpànn-a', 'approved')");
  await db.query("update lemmas set deleted_at = now() where headword = 'canpànn-a'");
  return (await db.query<Lemma>("select * from lemmas order by id")).rows;
}

// Attempt one update as a user; true when the database stored it.
async function attempt(db: PGlite, userId: string, sql: string, id: number): Promise<boolean> {
  let stored: boolean = false;
  await db.exec("begin");
  try {
    await actAs(db, asUser(userId));
    const result = await db.query(sql, [id]);
    stored = (result.affectedRows ?? 0) > 0;
  } catch {
    stored = false;
  } finally {
    await db.exec("rollback");
    await actAs(db, "trusted");
  }
  return stored;
}

test("editing: the interface and the database agree for every role and row", async () => {
  const db = await createSeededDatabase();
  const rows: Lemma[] = await seedRows(db);
  for (const [role, userId] of ROLE_USERS) {
    for (const row of rows) {
      const shown: boolean = canEdit(role, row, userId);
      const stored: boolean = await attempt(db, userId, "update lemmas set note = 'nota' where id = $1", row.id);
      assert.equal(shown, stored, `${role} editing ${row.headword} [${row.status}${row.deleted_at === null ? "" : ", deleted"}]`);
    }
  }
});

test("approving: the interface and the database agree for every role and row", async () => {
  const db = await createSeededDatabase();
  const rows: Lemma[] = await seedRows(db);
  for (const [role, userId] of ROLE_USERS) {
    for (const row of rows) {
      const target: string = row.status === "approved" ? "rejected" : "approved";
      const shown: boolean = canChangeStatus(role, "lemmas", row, false);
      const stored: boolean = await attempt(db, userId, `update lemmas set status = '${target}' where id = $1`, row.id);
      if (row.deleted_at === null) {
        assert.equal(shown, stored, `${role} setting ${row.headword} to ${target}`);
      } else {
        // Deliberately stricter than the database: an admin could
        // change the status of a deleted row, but the interface asks
        // for a restore first, so that nothing is approved unseen.
        assert.equal(shown, false, `${role} offered a status button on deleted ${row.headword}`);
      }
    }
  }
});

test("deleting and restoring: the interface and the database agree", async () => {
  const db = await createSeededDatabase();
  const rows: Lemma[] = await seedRows(db);
  for (const [role, userId] of ROLE_USERS) {
    for (const row of rows) {
      const sql: string = row.deleted_at === null
        ? "update lemmas set deleted_at = now() where id = $1"
        : "update lemmas set deleted_at = null where id = $1";
      const shown: boolean = canDeleteRow(role, "lemmas", false);
      const stored: boolean = await attempt(db, userId, sql, row.id);
      assert.equal(shown, stored, `${role} ${row.deleted_at === null ? "deleting" : "restoring"} ${row.headword}`);
    }
  }
});

test("a base form is never offered status or deletion buttons, and the database agrees", async () => {
  const db = await createSeededDatabase();
  await db.query("insert into lemmas (headword, status) values ('Zêna', 'approved')");
  const base = (await db.query<{ id: number }>("select id from wordforms where is_base")).rows[0];
  assert.ok(base !== undefined);
  assert.equal(canChangeStatus("admin", "wordforms", { id: base.id, status: "approved", version: 1, created_by: null, created_at: "", updated_at: "", deleted_at: null }, true), false);
  assert.equal(canDeleteRow("admin", "wordforms", true), false);
  assert.equal(await attempt(db, USERS.admin, "update wordforms set status = 'rejected' where id = $1", base.id), false);
  assert.equal(await attempt(db, USERS.admin, "update wordforms set deleted_at = now() where id = $1", base.id), false);
  assert.equal(await attempt(db, USERS.admin, "update wordforms set freq = 9 where id = $1", base.id), true);
});
