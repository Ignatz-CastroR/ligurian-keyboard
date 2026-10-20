/*
 * links.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:41:40, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  The way from a lemma in the lexicon manager to the same
 *           entry in the dictionary for readers: offered exactly when
 *           the dictionary would show it, as the database decides on a
 *           real database, and otherwise the reason it is not there.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { dictionaryLink } from "../src/links.ts";
import type { Status } from "../src/types.ts";

test("a published lemma links to its page in the dictionary; any other says why it is not there", () => {
  const lemma = (status: Status, deleted: boolean = false) =>
    ({ public_id: "LIJ-7K3Q9MDXK", status, deleted_at: deleted ? "2026-10-20T08:00:00Z" : null });
  assert.deepEqual(dictionaryLink(lemma("approved")), { kind: "published", href: "../dizionario/#/voce/LIJ-7K3Q9MDXK" });
  assert.deepEqual(dictionaryLink(lemma("pending")), { kind: "absent", reason: "pending" });
  assert.deepEqual(dictionaryLink(lemma("rejected")), { kind: "absent", reason: "rejected" });
  assert.deepEqual(dictionaryLink(lemma("approved", true)), { kind: "absent", reason: "deleted" });
  assert.deepEqual(dictionaryLink(lemma("pending", true)), { kind: "absent", reason: "deleted" });
  // The address resolves from the manager's folder to the dictionary's.
  assert.equal(new URL("../dizionario/#/voce/X", "https://example.org/admin/").pathname, "/dizionario/");
});

test("the link is offered exactly for the lemmas the dictionary shows its readers", async () => {
  const db = await createSeededDatabase();
  const admin = asUser(USERS.admin);
  const cases: [string, Status, boolean][] = [["zêna", "approved", false], ["pénna", "pending", false],
    ["çê", "rejected", false], ["ægua", "approved", true]];
  for (const [headword, status, deleted] of cases) {
    const row = (await rowsAs<{ public_id: string; status: Status; deleted_at: string | null }>(db, admin,
      "insert into lemmas (headword, status) values ($1, $2) returning public_id, status, deleted_at", [headword, status]))[0];
    let lemma = row ?? { public_id: "", status, deleted_at: null };
    if (deleted) {
      lemma = (await rowsAs<typeof lemma>(db, admin,
        "update lemmas set deleted_at = now() where public_id = $1 returning public_id, status, deleted_at::text", [lemma.public_id]))[0] ?? lemma;
    }
    const shown: unknown = (await rowsAs<{ entry: unknown }>(db, "anon",
      "select public.dictionary_entry($1) as entry", [lemma.public_id]))[0]?.entry ?? null;
    assert.equal(dictionaryLink(lemma).kind === "published", shown !== null, headword);
  }
});
