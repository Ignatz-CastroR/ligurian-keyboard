/*
 * users.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 02:44:10, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Tests of the Users section apart from the browser: the
 *           addresses of its views, what each change of a history was,
 *           read from rows the real database writes, the link to the
 *           entry, and the three languages of its texts.
 * Updated:  2026/10/21, 12:40:15: a review date cleared reads as the
 *           senses sent back to review, not as a review [migration 0013].
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { USERS, asUser, createSeededDatabase, rowsAs } from "../../db/test/harness.ts";
import { LANGUAGES } from "../../admin/src/messages.ts";
import type { Change } from "../../admin/src/db.ts";
import { userMessagesFor, type UserMessages } from "../src/messages.ts";
import { SQL_EDITOR, describeChange, entryHref, parseRoute, routeHash, type Route } from "../src/model.ts";

test("every view has an address, read back exactly; anything else is the first page", () => {
  const routes: Route[] = [
    { view: "people" }, { view: "signin" }, { view: "person", userId: null },
    { view: "person", userId: USERS.contributor },
  ];
  for (const route of routes) {
    assert.deepEqual(parseRoute(routeHash(route)), route, JSON.stringify(route));
  }
  assert.equal(routeHash({ view: "person", userId: null }), `#/persona/${SQL_EDITOR}`);
  assert.deepEqual(parseRoute(`#/persona/${USERS.admin.toUpperCase()}`), { view: "person", userId: USERS.admin });
  for (const other of ["", "#/", "#/persona/", "#/persona/12345", "#/persona/sql'--", "#/users"]) {
    assert.deepEqual(parseRoute(other), { view: "people" }, other);
  }
});

test("a review reads as approved, rejected or sent back; any other edit names its fields", () => {
  const c = (action: Change["action"], status: Change["status"], changed: string[] | null) => ({ action, status, changed });
  assert.deepEqual(describeChange(c("insert", "pending", null)), { verb: "insert", fields: [] });
  assert.deepEqual(describeChange(c("update", "approved", ["status"])), { verb: "approve", fields: [] });
  assert.deepEqual(describeChange(c("update", "rejected", ["status"])), { verb: "reject", fields: [] });
  assert.deepEqual(describeChange(c("update", "pending", ["status"])), { verb: "unreview", fields: [] });
  assert.deepEqual(describeChange(c("update", "pending", ["headword", "status"])), { verb: "update", fields: ["headword", "status"] });
  assert.deepEqual(describeChange(c("update", "approved", [])), { verb: "update", fields: [] });
  assert.deepEqual(describeChange(c("soft_delete", "approved", null)), { verb: "soft_delete", fields: [] });
  assert.deepEqual(describeChange(c("restore", "approved", null)), { verb: "restore", fields: [] });
  assert.equal(entryHref(42), "../admin/#/entry/42");
  assert.equal(entryHref(null), null);
});

test("on the real database, a person's history reads as what they did, in order, each change linked to its entry", async () => {
  const db = await createSeededDatabase();
  const admin = asUser(USERS.admin);
  const contributor = asUser(USERS.contributor);
  const lemma: number = (await rowsAs<{ id: number }>(db, contributor,
    "insert into lemmas (headword) values ('zenéize') returning id"))[0]?.id ?? -1;
  await rowsAs(db, contributor, "update lemmas set note = 'abitante di Genova' where id = $1", [lemma]);
  await rowsAs(db, admin, "update lemmas set status = 'approved' where id = $1", [lemma]);
  await rowsAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [lemma]);
  await rowsAs(db, admin, "update lemmas set deleted_at = null where id = $1", [lemma]);

  const own: Change[] = await rowsAs<Change>(db, contributor, "select * from public.user_history($1)", [USERS.contributor]);
  assert.deepEqual(own.map((c) => [c.table_name, describeChange(c).verb, describeChange(c).fields]),
    [["lemmas", "update", ["note"]], ["wordforms", "insert", []], ["lemmas", "insert", []]]);
  const reviews: Change[] = (await rowsAs<Change>(db, admin, "select * from public.user_history($1)", [USERS.admin]))
    .filter((c) => c.lemma_id === lemma);
  const verbs: string[] = reviews.map((c) => describeChange(c).verb);
  // Approving the lemma approves its base form too; then the lemma is
  // deleted and restored.
  assert.deepEqual(verbs.filter((v) => v !== "approve"), ["restore", "soft_delete"]);
  assert.ok(verbs.includes("approve"));
  assert.ok(reviews.every((c) => entryHref(c.lemma_id) === `../admin/#/entry/${lemma}`));
});

test("a review date set reads as senses reviewed, the same date cleared as senses sent back, on the real database too", async () => {
  const c = (cleared: string[] | null) => ({ action: "update" as const, status: "approved" as const, changed: ["senses_reviewed_at"], cleared });
  assert.deepEqual(describeChange(c([])), { verb: "review_senses", fields: [] });
  assert.deepEqual(describeChange(c(null)), { verb: "review_senses", fields: [] });
  assert.deepEqual(describeChange(c(["senses_reviewed_at"])), { verb: "unreview_senses", fields: [] });

  const db = await createSeededDatabase();
  const reviewer = asUser(USERS.reviewer);
  const lemma: number = (await rowsAs<{ id: number }>(db, "trusted",
    "insert into lemmas (headword, status) values ('béllo', 'approved') returning id"))[0]?.id ?? -1;
  await rowsAs(db, reviewer, "update lemmas set senses_reviewed_at = now() where id = $1", [lemma]);
  await rowsAs(db, reviewer, "update lemmas set senses_reviewed_at = null where id = $1", [lemma]);
  const history: Change[] = await rowsAs<Change>(db, reviewer, "select * from public.user_history($1)", [USERS.reviewer]);
  assert.deepEqual(history.map((h) => describeChange(h).verb), ["unreview_senses", "review_senses"]);
  for (const lang of LANGUAGES) {
    const verbs = userMessagesFor(lang.code).verbs;
    assert.notEqual(verbs.unreview_senses, verbs.review_senses, lang.code);
  }
});

test("every text exists in the three languages, keeps its placeholder, and Spanish is really translated", () => {
  const texts = (m: UserMessages): Map<string, string> => {
    const result: Map<string, string> = new Map();
    for (const [key, value] of Object.entries(m) as [string, unknown][]) {
      if (typeof value === "function") {
        result.set(key, String((value as (a: unknown, b: unknown) => string)("§7§", "§8§")));
      } else if (typeof value === "object" && value !== null) {
        for (const [inner, text] of Object.entries(value as Record<string, string>)) {
          result.set(`${key}.${inner}`, text);
        }
      } else {
        result.set(key, String(value));
      }
    }
    return result;
  };
  const it = texts(userMessagesFor("it"));
  const en = texts(userMessagesFor("en"));
  for (const { code } of LANGUAGES) {
    const m: UserMessages = userMessagesFor(code);
    const mine: Map<string, string> = texts(m);
    assert.deepEqual([...mine.keys()], [...it.keys()], code);
    for (const [key, text] of mine) {
      assert.ok(text.trim() !== "", `${code}.${key}`);
      if (typeof (m as unknown as Record<string, unknown>)[key] === "function") {
        assert.ok(text.includes("§7§"), `${code}.${key} drops its argument`);
      }
    }
  }
  assert.ok(texts(userMessagesFor("es")).get("summaryRange")?.includes("§8§"));
  const sameByNature: Set<string> = new Set(["kinds.wordforms", "colKind"]);
  const copies: string[] = [...texts(userMessagesFor("es"))].filter(([key, text]) =>
    !sameByNature.has(key) && (text === it.get(key) || text === en.get(key))).map(([key]) => key);
  assert.deepEqual(copies, []);
});
