/*
 * site-sections.test.ts
 * Author:   Eng. José Ignacio Castro de R. and contributors
 * Date:     2026/10/20, 01:50:30, DESAMPARADOS CENTRO, SAN JOSE, COSTA RICA
 * Purpose:  Prove migration 0011: the dictionary's size and its lookup
 *           of Ligurian words count and show published rows only, to
 *           everyone alike; a Ligurian word is found typed with or
 *           without accents, by its headword or by a form, through
 *           the search key indexes of 0004; and each
 *           person's history is complete, in pages, readable by staff
 *           for anyone and by everyone else for themselves only.
 * Contract: Every test builds its own database.
 * Decision: docs/decisions/0035-site-in-five-sections.md
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { USERS, asUser, createSeededDatabase, migrationNames, rowsAs, type Identity } from "./harness.ts";

const admin = asUser(USERS.admin);
const reviewer = asUser(USERS.reviewer);
const contributor = asUser(USERS.contributor);
const contributor2 = asUser(USERS.contributor2);
const member = asUser(USERS.member);

interface Lookup { headword: string; matched_form: string | null; rank: number; glosses: unknown[] }
interface Change { id: number; table_name: string; action: string; label: string | null; status: string; lemma_id: number; changed: string[] | null }

async function one(db: PGlite, who: Identity, sql: string, params: unknown[] = []): Promise<number> {
  return (await rowsAs<{ id: number }>(db, who, sql, params))[0]?.id ?? -1;
}

async function fill(db: PGlite): Promise<Record<string, number>> {
  const zena: number = await one(db, admin, "insert into lemmas (headword, status) values ('Zêna', 'approved') returning id");
  const sense: number = await one(db, admin, "insert into senses (lemma_id, status) values ($1, 'approved') returning id", [zena]);
  await one(db, admin, "insert into glosses (sense_id, language, gloss, status) values ($1, 'it', 'Genova', 'approved') returning id", [sense]);
  const penna: number = await one(db, admin, "insert into lemmas (headword, status) values ('pénna', 'approved') returning id");
  await one(db, admin, "insert into wordforms (lemma_id, form, status) values ($1, 'pénne', 'approved') returning id", [penna]);
  await one(db, admin, "insert into wordforms (lemma_id, form, status) values ($1, 'pennin', 'pending') returning id", [penna]);
  const pending: number = await one(db, contributor, "insert into lemmas (headword) values ('zenéize') returning id");
  const gone: number = await one(db, admin, "insert into lemmas (headword, status) values ('zetta', 'approved') returning id");
  await rowsAs(db, admin, "update lemmas set deleted_at = now() where id = $1", [gone]);
  return { zena, penna, pending, gone };
}

test("migration 0011 runs after 0010", () => {
  const names: string[] = migrationNames();
  assert.equal(names[names.indexOf("0010_review_queue_pages.sql") + 1], "0011_site_sections.sql");
});

test("the dictionary's size counts published lemmas, forms and translations, the same for everyone", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  for (const who of ["anon", member, contributor, reviewer] as Identity[]) {
    const stats = (await rowsAs<{ lemmas: number; forms: number; translations: number }>(db, who,
      "select lemmas::int as lemmas, forms::int as forms, translations::int as translations from public.dictionary_stats()"))[0];
    // Zêna and pénna with their base forms and pénne; one translation.
    assert.deepEqual(stats, { lemmas: 2, forms: 3, translations: 1 }, JSON.stringify(who));
  }
});

test("a Ligurian word is found with or without accents, by headword or by form, published entries only", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  const lookup = async (query: string, who: Identity = "anon"): Promise<Lookup[]> =>
    rowsAs<Lookup>(db, who, "select headword, matched_form, rank, glosses from public.dictionary_lookup($1)", [query]);
  for (const query of ["zena", "Zena", "Zêna", "ZÊNA", " zena "]) {
    assert.deepEqual((await lookup(query)).map((r) => [r.headword, r.rank]), [["Zêna", 0]], query);
  }
  assert.deepEqual((await lookup("zen")).map((r) => [r.headword, r.rank]), [["Zêna", 2]]);
  assert.deepEqual((await lookup("penne")).map((r) => [r.headword, r.matched_form, r.rank]), [["pénna", "pénne", 1]]);
  assert.deepEqual((await lookup("pen")).map((r) => [r.headword, r.matched_form, r.rank]), [["pénna", null, 2]]);
  // A pending form, a pending lemma and a deleted one are never found,
  // not even by a reviewer.
  assert.deepEqual(await lookup("pennin", reviewer), []);
  assert.deepEqual(await lookup("zenei", reviewer), []);
  assert.deepEqual(await lookup("zetta", reviewer), []);
  assert.equal((await lookup("zena"))[0]?.glosses.length, 1);
  for (const query of ["", "  ", "%", "_", "123"]) {
    assert.deepEqual(await lookup(query), [], JSON.stringify(query));
  }
});

test("each person's history is complete and in pages, newest first, naming what changed", async () => {
  const db = await createSeededDatabase();
  const ids = await fill(db);
  await rowsAs(db, contributor, "update lemmas set note = 'città' where id = $1", [ids["pending"]]);
  const history = async (who: Identity, user: string | null, before: number | null = null, limit: number = 100): Promise<Change[]> =>
    rowsAs<Change>(db, who, "select * from public.user_history($1, $2, $3)", [user, before, limit]);

  const own: Change[] = await history(reviewer, USERS.contributor);
  assert.deepEqual(own.map((c) => [c.table_name, c.action, c.label, c.lemma_id]), [
    ["lemmas", "update", "zenéize", ids["pending"]],
    ["wordforms", "insert", "zenéize", ids["pending"]],
    ["lemmas", "insert", "zenéize", ids["pending"]],
  ]);
  assert.deepEqual(own[0]?.changed, ["note"]);

  const all: Change[] = await history(reviewer, USERS.admin);
  const paged: Change[] = [];
  let before: number | null = null;
  let page: Change[] = await history(reviewer, USERS.admin, before, 3);
  while (page.length > 0) {
    paged.push(...page);
    before = page.at(-1)?.id ?? null;
    page = await history(reviewer, USERS.admin, before, 3);
  }
  assert.deepEqual(paged.map((c) => c.id), all.map((c) => c.id));
  assert.ok(all.length >= 10);
  assert.ok(all.every((c, i) => i === 0 || c.id < (all[i - 1]?.id ?? 0)));
  const gloss: Change | undefined = all.find((c) => c.table_name === "glosses");
  assert.deepEqual([gloss?.label, gloss?.lemma_id], ["Genova", ids["zena"]]);
});

test("staff read anyone's history and the SQL Editor's; everyone else only their own; visitors nothing", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  await db.exec("insert into lemmas (headword, status) values ('ægua', 'approved')");
  const refused = (error: unknown): boolean => (error as { code?: string }).code === "42501";

  const sql = await rowsAs<Change>(db, admin, "select * from public.user_history(null)");
  assert.deepEqual(sql.map((c) => c.label), ["ægua", "ægua"]);
  const summary = await rowsAs<{ table_name: string; action: string; changes: number }>(db, reviewer,
    "select table_name, action, changes::int as changes from public.user_summary($1)", [USERS.contributor]);
  assert.deepEqual(summary, [{ table_name: "lemmas", action: "insert", changes: 1 }, { table_name: "wordforms", action: "insert", changes: 1 }]);

  assert.equal((await rowsAs(db, contributor, "select * from public.user_history($1)", [USERS.contributor])).length, 2);
  await assert.rejects(rowsAs(db, contributor, "select * from public.user_history($1)", [USERS.admin]), refused);
  await assert.rejects(rowsAs(db, contributor, "select * from public.user_history(null)"), refused);
  await assert.rejects(rowsAs(db, contributor2, "select * from public.user_summary($1)", [USERS.contributor]), refused);
  await assert.rejects(rowsAs(db, member, "select * from public.people_activity()"), refused);
  await assert.rejects(rowsAs(db, "anon", "select * from public.user_history(null)"), refused);

  const people = await rowsAs<{ user_id: string | null; changes: number }>(db, reviewer,
    "select user_id::text as user_id, changes::int as changes from public.people_activity()");
  const byUser: Map<string | null, number> = new Map(people.map((p) => [p.user_id, p.changes]));
  assert.equal(byUser.get(USERS.contributor), 2);
  assert.equal(byUser.get(null), 2);
  assert.ok((byUser.get(USERS.admin) ?? 0) >= 10);
});

test("the lookup of Ligurian words is served by the search key indexes, not by reading every lemma", async () => {
  const db = await createSeededDatabase();
  await fill(db);
  // Enough lemmas that the planner weighs its indexes as on the live
  // dictionary, each with its base form and a plural.
  await db.exec(`insert into lemmas (headword, status)
    select translate(md5(n::text), '0123456789', 'ghijklmnop'), 'approved' from generate_series(1, 3000) as n`);
  await db.exec(`insert into wordforms (lemma_id, form, status)
    select id, headword || 'i', 'approved' from lemmas where length(headword) = 32`);
  await db.exec("analyze");
  // The two halves of the query dictionary_lookup builds, with the key
  // as a literal, as its dynamic SQL writes it; sequential scans are
  // discouraged so that a plan that could not use an index shows.
  const plan = async (sql: string): Promise<string> => {
    await db.exec("set enable_seqscan = off");
    try {
      return (await rowsAs<{ "QUERY PLAN": string }>(db, "trusted", `explain ${sql}`)).map((r) => r["QUERY PLAN"]).join("\n");
    } finally {
      await db.exec("reset enable_seqscan");
    }
  };
  assert.match(await plan(`select id from public.lemmas where headword_key like 'zen%'
    and status = 'approved' and deleted_at is null`), /lemmas_headword_key/u);
  assert.match(await plan(`select lemma_id from public.wordforms where form_key like 'pen%' and not is_base
    and status = 'approved' and deleted_at is null`), /wordforms_form_key/u);
  // And the function's own text builds exactly that shape.
  const source: string = (await rowsAs<{ src: string }>(db, "trusted",
    "select prosrc as src from pg_proc where proname = 'dictionary_lookup'"))[0]?.src ?? "";
  assert.match(source, /l\.headword_key like %2\$L/u);
  assert.match(source, /w\.form_key like %2\$L/u);
});

test("a whole word typed is never pushed out by longer words that begin with it", async () => {
  const db = await createSeededDatabase();
  // andâ has the form va; sixty headwords begin with va.
  const anda: number = await one(db, admin, "insert into lemmas (headword, status) values ('andâ', 'approved') returning id");
  await one(db, admin, "insert into wordforms (lemma_id, form, status) values ($1, 'va', 'approved') returning id", [anda]);
  await db.exec(`insert into lemmas (headword, status)
    select 'va' || translate(lpad(n::text, 3, '0'), '0123456789', 'abcdefghij'), 'approved' from generate_series(1, 60) as n`);
  const found = await rowsAs<Lookup>(db, "anon", "select headword, matched_form, rank, glosses from public.dictionary_lookup('va', 50)");
  assert.equal(found.length, 50);
  assert.deepEqual(found.slice(0, 1).map((r) => [r.headword, r.matched_form, r.rank]), [["andâ", "va", 1]]);
  assert.ok(found.slice(1).every((r) => r.rank === 2));
});
